/**
 * Deletes the local SQLite database and recreates it with the schema and
 * demo seed data. Usage: `npm run db:reset`.
 */
import fs from "node:fs";
import { openDatabase, resolveDatabasePath } from "../src/lib/db/client";

const databasePath = resolveDatabasePath();

for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  fs.rmSync(`${databasePath}${suffix}`, { force: true });
}

const db = openDatabase(databasePath);
db.close();

console.log(`Database reset and seeded at ${databasePath}`);
