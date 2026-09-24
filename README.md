# Indonesian Retirement Planning

A retirement planning application tailored to the Indonesian context. It will
help users understand whether their income, savings, pension assets (BPJS
Ketenagakerjaan JHT, DPLK), living costs, inflation and future housing costs
are enough to reach their retirement goals.

**Current stage: 7 — Production Polish.** All seven stages are complete:
foundation and auth, financial profile, living-cost projections, retirement
simulation, scenario planning, AI Insights, and this final integration pass
(cross-page navigation, state/accessibility audit, consistent Rupiah
formatting, and richer demo data covering the whole journey). The complete
user journey is Login → Dashboard → Financial Profile → Living Costs →
Retirement Plan → Scenarios → AI Insights → Logout, and every page links
forward to the next relevant one instead of relying on the sidebar alone.

## Getting started

Requirements: Node.js 20.9+ (tested on 22) and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

Sign in with the demo account:

| Username | Password  |
| -------- | --------- |
| `demo`   | `demo123` |

The SQLite database is created automatically at `data/app.db` on first use,
migrated, and seeded with the demo user. Set `DATABASE_PATH` to use another
file (see `.env.example`). To start over, run `npm run db:reset`.

The demo account (`demo` / `demo123`) is seeded with a complete Indonesian
financial profile, seven asset accounts across every category, economic
assumptions, a target property, four example scenarios and a starting set of
AI Insights — so the full Login → … → AI Insights journey can be evaluated
immediately, without creating a single record by hand.

AI Insights needs a provider to *generate new* suggestions. Without one
configured, the rest of the app still works, the demo account's seeded
insights are still visible, and the AI Insights page shows an "unavailable"
state instead of failing when you try to generate more. See
[AI Insights module](#ai-insights-module) for the environment variables.

## Scripts

| Command             | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Start the development server                        |
| `npm run build`     | Production build                                    |
| `npm start`         | Serve the production build                          |
| `npm run lint`      | ESLint                                              |
| `npm run typecheck` | TypeScript type check                               |
| `npm test`          | Unit tests (Vitest)                                 |
| `npm run test:e2e`  | Browser tests (Playwright, desktop + mobile); uses a fresh `data/e2e.db` |
| `npm run db:reset`  | Delete and re-seed the local database               |

For end-to-end tests with a preinstalled Chromium, set
`PLAYWRIGHT_CHROMIUM_PATH` to its executable; otherwise run
`npx playwright install chromium` once.

## Architecture

Next.js 15 (App Router, React Server Components, Server Actions), TypeScript,
Tailwind CSS 4 and SQLite via `better-sqlite3`.

```
src/
  app/
    login/                  Login page + client form (pending/error states)
    (app)/                  Authenticated route group; layout validates the session and renders the app shell
      dashboard/            Overview: readiness, cash flow, assets, quick links, AI teaser
      financial-profile/    Profile + assets CRUD (edit/, assets/new, assets/[id]/edit)
      living-costs/         Assumptions + housing projection (assumptions/, property/)
      retirement-plan/      The deterministic retirement simulation
      scenarios/            What-if scenarios (new/, [id]/, [id]/edit)
      ai-insights/          AI-interpreted suggestions, accept/edit/reject/dismiss/apply
    actions/                One file per module; server actions parse FormData and call services
  components/                Presentational UI: app shell, forms, charts, confirm dialogs, per-module widgets
  config/                    Navigation and status-message → banner-text mappings
  lib/
    db/                      Connection, migrations (schema_migrations), demo/e2e seed data
    repositories/            All SQL lives here; returns typed domain objects, nothing else touches SQL
    services/                Use-case logic composed from repositories; the only thing UI code calls
    validation/              Server-side field validation, separate from services
    projection/, scenarios/  Pure calculation engines (no database, UI or AI)
    ai/                      Signals, context allowlist, provider interface + implementations, response validation
    auth/                    Password hashing, sessions, cookie helpers
    domain/, format/         Pure helpers (enums/labels, age, Rupiah formatting)
  middleware.ts              Redirects cookie-less requests to /login
```

Data flows one way: **UI → services → repositories → SQLite**. Components never
import the database directly, so later stages can add tables and services
without changing the UI architecture.

### Data model

| Table                | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| `users`              | Accounts; scrypt-hashed passwords                        |
| `sessions`           | Login sessions keyed by a SHA-256 hash of the cookie token |
| `financial_profiles` | One per user: current and target retirement age, monthly income, living expenses (excl. rent), housing status, property value (own) or monthly rent (rent), optional city |
| `asset_accounts`     | Asset records: `cash`, `deposit` (cash & savings); `mutual_fund`, `stock`, `bond`, `other` (investments); `bpjs_jht` (JHT); `pension` (other pension funds) |
| `economic_assumptions` | Per-user inflation, housing-price growth and investment return in basis points (300 = 3.00%); no row = demo defaults 3% / 5% / 7% |
| `target_properties`  | One target property per user: description, today's price, purchase age, optional growth rate (NULL = use the housing-growth assumption) |
| `retirement_settings` | Per-user plan-until (life-expectancy) age, 50–120; no row = 85 |
| `scenarios`          | Named what-if scenarios. Every override column is nullable, and NULL means "use the baseline": retirement age, monthly spending, inflation, return, retirement duration, property purchase (flag, price, age, growth) |
| `ai_insights`        | AI-generated suggestions: kind, observation, reasoning, cited values, confidence, a whitelisted action type/payload, the user's edited version (if any), and status (`pending`/`edited`/`accepted`/`applied`/`rejected`/`dismissed`) |
| `ai_insight_events`  | Audit trail: one row per state transition (`generated`, `edited`, `accepted`, `rejected`, `dismissed`, `applied`), with a JSON detail (e.g. the created scenario id, or the before/after assumptions) |
| `schema_migrations`  | Applied migration ids                                    |

Money is stored as integer Rupiah. Schema changes are added as new entries in
`src/lib/db/migrations.ts`; never edit a migration that has been merged.
CHECK constraints mirror the validation rules (e.g. target age > current age,
rent only when renting). Migration 2 upgrades Stage 1 databases in place:
age is derived from the stored date of birth, housing starts as
family-owned, and BPJS JHT records move to the `bpjs_jht` category.

### Financial profile module

| Route                                   | Purpose                                   |
| --------------------------------------- | ----------------------------------------- |
| `/financial-profile`                    | View profile and assets; delete records   |
| `/financial-profile/edit`               | Create or edit the profile                |
| `/financial-profile/assets/new`         | Add an asset (`?group=` pre-selects type) |
| `/financial-profile/assets/[id]/edit`   | Edit or delete an asset                   |

Validation lives in `src/lib/validation/financial-profile.ts` and runs on the
server for every save; server actions return field errors with the submitted
values. Services in `src/lib/services/financial-profile.ts` scope every read
and write to the signed-in user.

### Living costs & projections

| Route                       | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `/living-costs`             | Assumptions, living-cost and housing projections     |
| `/living-costs/assumptions` | Edit the three rates, or reset them to the defaults  |
| `/living-costs/property`    | Create or edit the target property                   |

All projections are deterministic functions in `src/lib/projection/` — no AI
model is involved. Rates are integer basis points and amounts whole Rupiah,
rounded only at the end:

- **Living cost at retirement** = monthly living expenses ×
  (1 + inflation)^(retirement age − current age); annual = 12 × monthly.
- **Future property price** (nominal) = today's price ×
  (1 + property growth)^(purchase age − current age).
- **In today's money** = future amount ÷ (1 + inflation)^years. This shows the
  falling purchasing power of money, which is separate from the property's
  price rising; the page never describes rising prices as the asset losing value.

`src/lib/projection/projection.test.ts` pins results to values computed
independently with Python's `decimal` module.

### Retirement simulation

`simulateRetirement()` in `src/lib/projection/retirement.ts` is a pure function
(plain numbers in and out, no database, UI or AI). The Retirement Plan page and
the dashboard both call it through `src/lib/services/retirement-plan.ts`, and
later scenario and AI features can reuse it. With current age *a*, retirement
age *R*, plan-until age *L*, inflation *i* and expected return *r*:

1. **Annual living cost at retirement** *E* = 12 × monthly expenses × (1 + i)^(R − a)
2. **Required fund** = *E* × Σ_{k=0}^{L−R−1} ((1 + i) / (1 + r))^k, so each
   year's cost is paid at the start of the year, rises with inflation, and the
   rest keeps earning *r*
3. **Projected assets** = (cash & savings + investments + JHT + other pensions)
   × (1 + r)^(R − a), with no future contributions
4. **Gap or surplus** = projected assets − required fund. The page also shows
   the monthly saving that would close a gap and the age the money runs out.

Results are estimates from these assumptions, not guaranteed outcomes.
`retirement.test.ts` pins them to independently computed values.

### Scenarios

| Route                    | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `/scenarios`             | Side-by-side comparison, trajectories chart, manage list   |
| `/scenarios/new`         | Create a scenario (blank fields inherit the baseline)      |
| `/scenarios/[id]`        | Scenario vs your plan, result, and apply-to-plan           |
| `/scenarios/[id]/edit`   | Edit and recalculate                                       |

- **One engine.** `resolveScenario()` (`src/lib/scenarios/resolve.ts`) only
  substitutes a scenario's overrides into the baseline input that the
  Retirement Plan builds. Results then come from the same
  `simulateRetirement()`. The engine takes an optional property purchase,
  paid from assets at the purchase age, so housing can be compared. Without a
  purchase, results are identical to Stage 4.
- **Isolation.** Scenario operations only read the baseline tables.
  `applyScenarioToBaseline()` is the only write path. It copies only the
  values the user ticks, after an explicit confirmation. A unit test
  snapshots every baseline table before and after creating, editing,
  duplicating, deleting and comparing scenarios.
- **Examples.** Base, Conservative and Optimistic are assumption sets, not
  forecasts. The demo user also gets a home-purchase scenario, and other users
  can add the examples from the empty state.

### AI Insights module

| Route          | Purpose                                                          |
| -------------- | ----------------------------------------------------------------- |
| `/ai-insights` | Generate, review and act on AI-interpreted observations about the plan |

- **The AI explains, it never calculates.** `computeFinancialSignals()`
  (`src/lib/ai/signals.ts`) is the only bridge between the deterministic
  engine and the AI: it re-runs `simulateRetirement()` and the Stage 5
  scenario helpers with one input changed at a time (e.g. retirement age +2
  years, inflation ±1 point) and hands the AI structured numbers, never the
  other way around. `buildAiContext()` (`src/lib/ai/context.ts`) is a strict
  allowlist of those numbers plus a few profile fields — no name, city,
  account or property descriptions ever reach the provider.
- **Two providers, one interface.** `AiInsightProvider`
  (`src/lib/ai/provider.ts`) is implemented by `AnthropicInsightProvider`
  (`src/lib/ai/anthropic-provider.ts`, forced tool-use for structured JSON)
  and `MockInsightProvider` (`src/lib/ai/mock-provider.ts`, deterministic
  templates, no network). `getAiProvider()` picks one from environment
  variables and never throws — an unconfigured or failing AI degrades to an
  "unavailable" or "error" state; the rest of the app keeps working.
- **Untrusted by default.** Every provider response passes through
  `validateAiResponse()` (`src/lib/ai/validate-response.ts`), which drops
  malformed entries, restricts each suggestion's `kind` to signals actually
  sent, clamps `confidence` and `actionType` to fixed enums, and caps the
  count and text length. The AI's own prose is always labeled ("AI
  interpretation") and shown separately from the deterministic figures it
  cites.
- **A suggestion can never silently change the plan.** `actionType` is
  restricted to three values — `none`, `create_scenario`,
  `update_assumptions` — each mapping to an existing, already-validated
  write path (Stage 5's `createScenario`, Stage 3's `saveAssumptions`); no
  new unchecked write exists. Applying requires two separate steps: **Accept**
  (no write) and then a confirmed **Apply**, which first shows the exact
  values that would be written. Suggestions can also be **Edit**ed (the
  proposed values only, never the AI's own explanation) or **Reject**ed /
  **Dismiss**ed, all logged to `ai_insight_events` for an audit trail.
- **Environment variables** (see `.env.example`):

  | Variable             | Effect                                                  |
  | --------------------- | -------------------------------------------------------- |
  | `AI_PROVIDER=mock`    | Deterministic, network-free provider (used by `npm run test:e2e`) |
  | `AI_PROVIDER=disabled`| AI Insights reports "unavailable"; rest of the app unaffected |
  | `ANTHROPIC_API_KEY`   | Enables the real Anthropic provider (used when `AI_PROVIDER` is unset) |
  | `ANTHROPIC_MODEL`     | Overrides the default model                              |

  With nothing set, the page shows an "unavailable" state rather than an
  error.

### Deploying to Vercel

`vercel.json` sets the framework to Next.js. Vercel functions can only write
under `/tmp`, so when `VERCEL` is set and `DATABASE_PATH` is not, the SQLite file
is created at `/tmp/app.db` and seeded with the demo data on each cold start.
That storage is **temporary**: changes are lost when an instance is recycled.
For data that lasts, point `DATABASE_PATH` at durable storage or move to a hosted
database.

### Authentication

Credentials are checked against the `users` table. A successful login creates
a random session token, stores its hash in `sessions` (7-day expiry) and sets
it in an HTTP-only, SameSite=Lax cookie. Logout deletes the session row and
the cookie.

### Calculation & AI boundaries

- **All financial math lives in `src/lib/projection/` and `src/lib/scenarios/`.**
  The retirement engine, living-cost/housing projections and scenario
  resolution are pure functions with no database, UI or AI involvement (see
  [Living costs & projections](#living-costs--projections),
  [Retirement simulation](#retirement-simulation) and
  [Scenarios](#scenarios) above for the exact formulas). Nothing outside
  these modules is allowed to reimplement or approximate them.
- **The AI never calculates — it interprets.** `computeFinancialSignals()` is
  the only bridge from the deterministic engine to the AI, and it only ever
  *re-runs* `simulateRetirement()` with one input changed; the AI itself
  receives already-computed numbers and narrates them. See
  [AI Insights module](#ai-insights-module) for the full boundary (context
  allowlist, response validation, the three-value action whitelist, and the
  accept-then-apply write path).
- **Nothing here is financial advice.** Every projection page states that
  results are estimates from fixed assumptions, not guaranteed outcomes, and
  every AI suggestion is visually distinguished from the deterministic
  figures it cites. Confidence labels on AI suggestions describe how strongly
  the *underlying numbers* support an observation, not a prediction about the
  future.

### Known limitations

- **SQLite, single file.** Fine for a single-instance deployment or demo; not
  built for concurrent writers across multiple server instances. On Vercel,
  the database is ephemeral per cold start (see
  [Deploying to Vercel](#deploying-to-vercel)).
- **No password reset, email verification, or multi-factor auth.** Sessions
  are cookie-based with a fixed 7-day expiry; there is no "remember me" or
  session-revocation UI beyond logout.
- **Single-currency, single-locale.** Amounts are always Indonesian Rupiah
  formatted with `Intl.NumberFormat("id-ID", …)`; there is no multi-currency
  or multi-language support.
- **The retirement engine is intentionally simplified.** It does not model
  BPJS Jaminan Pensiun's monthly annuity, taxes, fees, or year-to-year
  variance in returns/inflation — see "Not included" on the Retirement Plan
  page for the full, user-visible list.
- **The real AI provider (`ANTHROPIC_API_KEY`) requires network access** and
  is subject to the usual LLM caveats (latency, occasional malformed output —
  mitigated by `validateAiResponse()`, but not eliminated). The mock provider
  is deterministic and recommended for demos, CI and offline development.
- **No automated accessibility test run** (e.g. axe-core) is wired into CI;
  accessibility was reviewed manually (labels, focus management, semantic
  structure, contrast) rather than verified by an automated audit.

## Development workflow

`main` is the canonical, stable branch. Product work is never committed
directly to `main`; each stage is developed on its own feature branch created
from the latest accepted `main`, reviewed, and then merged back.

| Stage | Branch                                   |
| ----- | ---------------------------------------- |
| 1     | `feature/stage-1-foundation`             |
| 2     | `feature/stage-2-financial-profile`      |
| 3     | `feature/stage-3-cost-projection`        |
| 4     | `feature/stage-4-retirement-simulation`  |
| 5     | `feature/stage-5-scenario-planning`      |
| 6     | `feature/stage-6-ai-advisor`             |
| 7     | `feature/stage-7-production-polish`      |

Feature branches are never chained: each one starts from `main` after the
previous stage has been merged.
