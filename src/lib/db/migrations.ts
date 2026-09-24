import type { Database } from "better-sqlite3";

export interface Migration {
  id: number;
  name: string;
  up: string;
}

/**
 * Ordered, append-only list of schema migrations.
 *
 * Never edit a migration that has already been merged into `main`; add a new
 * one with the next id instead. Monetary values are stored as INTEGER whole
 * Rupiah to avoid floating-point rounding.
 */
export const migrations: Migration[] = [
  {
    id: 1,
    name: "initial_schema",
    up: `
      CREATE TABLE users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT    NOT NULL,
        full_name     TEXT    NOT NULL,
        created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      -- The primary key is a SHA-256 hash of the session token; the raw token
      -- only ever lives in the user's HTTP-only cookie.
      CREATE TABLE sessions (
        id         TEXT    PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        expires_at TEXT    NOT NULL
      );
      CREATE INDEX idx_sessions_user_id ON sessions(user_id);

      CREATE TABLE financial_profiles (
        user_id               INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        date_of_birth         TEXT    NOT NULL,
        target_retirement_age INTEGER NOT NULL CHECK (target_retirement_age BETWEEN 40 AND 80),
        city                  TEXT    NOT NULL,
        monthly_income        INTEGER NOT NULL CHECK (monthly_income >= 0),
        monthly_expenses      INTEGER NOT NULL CHECK (monthly_expenses >= 0),
        updated_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE asset_accounts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        TEXT    NOT NULL,
        category    TEXT    NOT NULL CHECK (category IN
                      ('cash', 'deposit', 'mutual_fund', 'stock', 'bond', 'pension', 'other')),
        institution TEXT,
        balance     INTEGER NOT NULL CHECK (balance >= 0),
        updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX idx_asset_accounts_user_id ON asset_accounts(user_id);
    `,
  },
  {
    id: 2,
    name: "financial_profile_module",
    // SQLite cannot alter column constraints in place, so both tables are
    // rebuilt with the documented copy-and-rename procedure. Existing rows
    // are carried over; nothing references these tables by foreign key.
    up: `
      CREATE TABLE financial_profiles_v2 (
        user_id               INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        current_age           INTEGER NOT NULL CHECK (current_age BETWEEN 18 AND 100),
        target_retirement_age INTEGER NOT NULL CHECK (target_retirement_age BETWEEN 19 AND 100),
        monthly_income        INTEGER NOT NULL CHECK (monthly_income >= 0),
        -- Day-to-day living costs, excluding rent (captured separately).
        monthly_expenses      INTEGER NOT NULL CHECK (monthly_expenses >= 0),
        housing_status        TEXT    NOT NULL CHECK (housing_status IN ('own', 'rent', 'family')),
        property_value        INTEGER CHECK (property_value IS NULL OR property_value >= 0),
        monthly_rent          INTEGER CHECK (monthly_rent IS NULL OR monthly_rent >= 0),
        city                  TEXT,
        created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (target_retirement_age > current_age),
        CHECK (housing_status = 'own'  OR property_value IS NULL),
        CHECK (housing_status = 'rent' OR monthly_rent IS NULL)
      );

      -- Age is derived from the stored date of birth at migration time.
      -- Housing was not captured before, so existing profiles start as
      -- 'family' (no amounts required) until the user updates them.
      INSERT INTO financial_profiles_v2
        (user_id, current_age, target_retirement_age, monthly_income, monthly_expenses,
         housing_status, city, created_at, updated_at)
      SELECT user_id,
             MIN(MAX(age, 18), target_retirement_age - 1),
             target_retirement_age, monthly_income, monthly_expenses,
             'family', city, updated_at, updated_at
        FROM (
          SELECT *,
                 CAST(strftime('%Y', 'now') AS INTEGER) - CAST(substr(date_of_birth, 1, 4) AS INTEGER)
                   - (strftime('%m-%d', 'now') < substr(date_of_birth, 6, 5)) AS age
            FROM financial_profiles
        );

      DROP TABLE financial_profiles;
      ALTER TABLE financial_profiles_v2 RENAME TO financial_profiles;

      CREATE TABLE asset_accounts_v2 (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        TEXT    NOT NULL,
        category    TEXT    NOT NULL CHECK (category IN
                      ('cash', 'deposit', 'mutual_fund', 'stock', 'bond', 'other',
                       'bpjs_jht', 'pension')),
        institution TEXT,
        balance     INTEGER NOT NULL CHECK (balance >= 0),
        created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      -- BPJS Ketenagakerjaan JHT balances were previously stored as generic
      -- pensions; give them their own category.
      INSERT INTO asset_accounts_v2
        (id, user_id, name, category, institution, balance, created_at, updated_at)
      SELECT id, user_id, name,
             CASE WHEN category = 'pension'
                   AND (institution LIKE '%BPJS%' OR name LIKE '%JHT%') THEN 'bpjs_jht'
                  ELSE category END,
             institution, balance, updated_at, updated_at
        FROM asset_accounts;

      DROP TABLE asset_accounts;
      ALTER TABLE asset_accounts_v2 RENAME TO asset_accounts;
      CREATE INDEX idx_asset_accounts_user_id ON asset_accounts(user_id);
    `,
  },
  {
    id: 3,
    name: "cost_projection_module",
    // Rates are integer basis points (300 = 3.00%). A user without an
    // economic_assumptions row uses the application defaults.
    up: `
      CREATE TABLE economic_assumptions (
        user_id               INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        inflation_bps         INTEGER NOT NULL CHECK (inflation_bps BETWEEN 0 AND 3000),
        housing_growth_bps    INTEGER NOT NULL CHECK (housing_growth_bps BETWEEN -1000 AND 3000),
        investment_return_bps INTEGER NOT NULL CHECK (investment_return_bps BETWEEN -1000 AND 3000),
        created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      -- One target property per user. growth_bps NULL means "use the
      -- housing-price growth from economic_assumptions".
      CREATE TABLE target_properties (
        user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        name          TEXT    NOT NULL,
        current_price INTEGER NOT NULL CHECK (current_price > 0),
        purchase_age  INTEGER NOT NULL CHECK (purchase_age BETWEEN 18 AND 100),
        growth_bps    INTEGER CHECK (growth_bps IS NULL OR growth_bps BETWEEN -1000 AND 3000),
        created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `,
  },
];

export function runMigrations(db: Database, pending: Migration[] = migrations): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const isApplied = db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?");
  const record = db.prepare("INSERT INTO schema_migrations (id, name) VALUES (?, ?)");

  const apply = db.transaction((migration: Migration) => {
    // Re-checked inside the write lock: another process (e.g. a parallel
    // build worker) may have applied it after we started.
    if (isApplied.get(migration.id)) return;
    db.exec(migration.up);
    record.run(migration.id, migration.name);
  });

  for (const migration of pending) {
    if (!isApplied.get(migration.id)) {
      // IMMEDIATE takes the write lock before the re-check above.
      apply.immediate(migration);
    }
  }
}
