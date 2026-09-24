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
];

export function runMigrations(db: Database): void {
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

  for (const migration of migrations) {
    if (!isApplied.get(migration.id)) {
      // IMMEDIATE takes the write lock before the re-check above.
      apply.immediate(migration);
    }
  }
}
