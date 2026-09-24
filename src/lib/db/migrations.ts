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
  {
    id: 4,
    name: "retirement_plan_module",
    // Life-expectancy / planning-horizon assumption for the retirement
    // simulation. No row = the application default (plan until age 85).
    up: `
      CREATE TABLE retirement_settings (
        user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        plan_until_age INTEGER NOT NULL CHECK (plan_until_age BETWEEN 50 AND 120),
        created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `,
  },
  {
    id: 5,
    name: "scenario_planning_module",
    // Each column other than name/description/include_property is an
    // optional override: NULL means "use the baseline plan's value".
    // Scenarios never modify the baseline tables.
    up: `
      CREATE TABLE scenarios (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name                  TEXT    NOT NULL,
        description           TEXT,
        retirement_age        INTEGER CHECK (retirement_age IS NULL OR retirement_age BETWEEN 19 AND 100),
        monthly_spending      INTEGER CHECK (monthly_spending IS NULL OR monthly_spending >= 0),
        inflation_bps         INTEGER CHECK (inflation_bps IS NULL OR inflation_bps BETWEEN 0 AND 3000),
        investment_return_bps INTEGER CHECK (investment_return_bps IS NULL OR investment_return_bps BETWEEN -1000 AND 3000),
        retirement_years      INTEGER CHECK (retirement_years IS NULL OR retirement_years BETWEEN 1 AND 60),
        include_property      INTEGER NOT NULL DEFAULT 0 CHECK (include_property IN (0, 1)),
        property_price        INTEGER CHECK (property_price IS NULL OR property_price > 0),
        property_purchase_age INTEGER CHECK (property_purchase_age IS NULL OR property_purchase_age BETWEEN 18 AND 100),
        property_growth_bps   INTEGER CHECK (property_growth_bps IS NULL OR property_growth_bps BETWEEN -1000 AND 3000),
        created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (user_id, name)
      );
      CREATE INDEX idx_scenarios_user_id ON scenarios(user_id);
    `,
  },
  {
    id: 6,
    name: "ai_insights_module",
    // AI Insights: cited_values/action_payload/edited_action_payload hold
    // JSON text (arrays/objects), validated in application code before
    // being written — SQLite has no native JSON column type. action_type
    // is restricted to a fixed whitelist; applying an insight always goes
    // through the same validated write paths as manual edits (Stage 2/3/5).
    up: `
      CREATE TABLE ai_insights (
        id                     INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        batch_id               TEXT    NOT NULL,
        provider               TEXT    NOT NULL,
        model                  TEXT,
        kind                   TEXT    NOT NULL CHECK (kind IN
                                  ('funding_gap', 'inflation_sensitivity', 'delay_retirement',
                                   'increase_savings', 'property_purchase', 'scenario_comparison')),
        observation            TEXT    NOT NULL,
        reasoning              TEXT    NOT NULL,
        cited_values           TEXT    NOT NULL,
        confidence             TEXT    NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
        action_type            TEXT    NOT NULL CHECK (action_type IN
                                  ('none', 'create_scenario', 'update_assumptions')),
        action_label           TEXT    NOT NULL,
        action_payload         TEXT    NOT NULL,
        edited_action_label    TEXT,
        edited_action_payload  TEXT,
        status                 TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN
                                  ('pending', 'edited', 'accepted', 'applied', 'rejected', 'dismissed')),
        created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX idx_ai_insights_user_id ON ai_insights(user_id);
      CREATE INDEX idx_ai_insights_batch_id ON ai_insights(batch_id);

      -- Audit trail: one row per state change (generated/edited/accepted/
      -- rejected/dismissed/applied). Kept even if the insight itself is
      -- deleted from under it in the future, so history survives — hence
      -- no ON DELETE CASCADE tie to ai_insights beyond the FK for lookups.
      CREATE TABLE ai_insight_events (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        insight_id   INTEGER NOT NULL REFERENCES ai_insights(id) ON DELETE CASCADE,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type   TEXT    NOT NULL CHECK (event_type IN
                        ('generated', 'edited', 'accepted', 'rejected', 'dismissed', 'applied')),
        detail       TEXT,
        created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX idx_ai_insight_events_insight_id ON ai_insight_events(insight_id);
      CREATE INDEX idx_ai_insight_events_user_id ON ai_insight_events(user_id);
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
