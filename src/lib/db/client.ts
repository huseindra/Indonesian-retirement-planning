import fs from "node:fs";
import path from "node:path";
import BetterSqlite3, { type Database } from "better-sqlite3";
import { runMigrations } from "./migrations";
import { seedDemoData } from "./seed";

export type { Database };

const DEFAULT_DATABASE_PATH = path.join(process.cwd(), "data", "app.db");

export function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH;
  if (configured) return path.resolve(configured);
  // Serverless platforms such as Vercel only allow writes under /tmp. The
  // database there is recreated and re-seeded on each cold start, so data
  // does not persist between instances (fine for the demo, not for real use).
  if (process.env.VERCEL) return path.join("/tmp", "app.db");
  return DEFAULT_DATABASE_PATH;
}

/**
 * Opens a SQLite database, applies pending migrations and seeds the demo
 * data if it is missing. Pass ":memory:" for an isolated test database.
 */
export function openDatabase(filename: string): Database {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new BetterSqlite3(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  runMigrations(db);
  seedDemoData(db);
  return db;
}

// Cached on globalThis so Next.js hot reloads in development reuse a single
// connection instead of leaking a new one on every module re-evaluation.
const globalForDb = globalThis as unknown as { __irpDb?: Database };

export function getDb(): Database {
  if (!globalForDb.__irpDb) {
    globalForDb.__irpDb = openDatabase(resolveDatabasePath());
  }
  return globalForDb.__irpDb;
}
