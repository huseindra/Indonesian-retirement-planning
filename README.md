# Indonesian Retirement Planning

A retirement planning application tailored to the Indonesian context. It will
help users understand whether their income, savings, pension assets (BPJS
Ketenagakerjaan JHT, DPLK), living costs, inflation and future housing costs
are enough to reach their retirement goals.

**Current stage: 1 — Foundation.** Login, a persistent SQLite database with
seeded demo data, and a responsive dashboard shell. Retirement calculations,
projections, scenarios and AI features come in later stages.

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
| `npm run test:e2e`  | Browser tests (Playwright, desktop + mobile)        |
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
| `financial_profiles` | Date of birth, target retirement age, city, monthly income/expenses |
| `asset_accounts`     | Savings, deposits, investments and pension balances      |
| `schema_migrations`  | Applied migration ids                                    |

Money is stored as integer Rupiah. Schema changes are added as new entries in
`src/lib/db/migrations.ts`; never edit a migration that has been merged.

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
