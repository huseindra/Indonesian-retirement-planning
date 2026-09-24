import { getDb, type Database } from "../db/client";

export interface User {
  id: number;
  username: string;
  fullName: string;
}

export interface UserWithPasswordHash extends User {
  passwordHash: string;
}

interface UserRow {
  id: number;
  username: string;
  full_name: string;
  password_hash: string;
}

export function findUserByUsername(
  username: string,
  db: Database = getDb(),
): UserWithPasswordHash | null {
  const row = db
    .prepare("SELECT id, username, full_name, password_hash FROM users WHERE username = ?")
    .get(username) as UserRow | undefined;

  return row
    ? { id: row.id, username: row.username, fullName: row.full_name, passwordHash: row.password_hash }
    : null;
}
