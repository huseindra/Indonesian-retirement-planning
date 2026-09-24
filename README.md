# Indonesian Retirement Planning

A retirement planning application tailored to the Indonesian context. It will
help users understand whether their income, savings, pension assets (BPJS
Ketenagakerjaan JHT, DPLK), living costs, inflation and future housing costs
are enough to reach their retirement goals.

**Current stage: 2 — Financial Profile.** On top of the Stage 1 foundation
(login, SQLite persistence, responsive dashboard), users can create, view, edit
and delete their financial profile: age and target retirement age, monthly
income and living expenses, housing (own / rent / family-owned), and asset
records grouped as cash & savings, investments, JHT (BPJS Ketenagakerjaan) and
other pension funds. The dashboard reads this persisted data and guides users
to complete their profile when none exists. Retirement projections, scenarios
and AI features come in later stages.

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
    (app)/                  Authenticated route group; layout validates the session
      dashboard/            Dashboard page + loading skeleton
      financial-profile/ …  Upcoming sections (placeholder pages)
    actions/auth.ts         login / logout server actions
  components/               Presentational UI (app shell, cards, placeholders)
  config/                   Navigation and display labels
  lib/
    db/                     Connection, migrations, seed data
    repositories/           All SQL lives here; returns typed domain objects
    services/               Use-case logic composed from repositories
    auth/                   Password hashing, sessions, cookie helpers
    domain/, format/        Pure helpers (age, Rupiah formatting)
  middleware.ts             Redirects cookie-less requests to /login
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

### Authentication

Credentials are checked against the `users` table. A successful login creates
a random session token, stores its hash in `sessions` (7-day expiry) and sets
it in an HTTP-only, SameSite=Lax cookie. Logout deletes the session row and
the cookie.

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
