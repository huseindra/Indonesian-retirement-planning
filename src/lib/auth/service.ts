import { createHash, randomBytes } from "node:crypto";
import { getDb, type Database } from "../db/client";
import {
  deleteExpiredSessions,
  deleteSession,
  findUserBySessionId,
  insertSession,
} from "../repositories/sessions";
import { findUserByUsername, type User } from "../repositories/users";
import { verifyPassword } from "./password";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Sessions are stored by hash so a leaked database cannot be replayed. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Returns the user when the credentials are valid, otherwise null. */
export function authenticate(
  username: string,
  password: string,
  db: Database = getDb(),
): User | null {
  const user = findUserByUsername(username.trim(), db);
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return { id: user.id, username: user.username, fullName: user.fullName };
}

export function createSession(
  userId: number,
  now: Date = new Date(),
  db: Database = getDb(),
): { token: string; expiresAt: Date } {
  deleteExpiredSessions(now, db);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  insertSession(hashToken(token), userId, expiresAt, db);
  return { token, expiresAt };
}

export function getUserForSessionToken(
  token: string,
  now: Date = new Date(),
  db: Database = getDb(),
): User | null {
  return findUserBySessionId(hashToken(token), now, db);
}

export function revokeSession(token: string, db: Database = getDb()): void {
  deleteSession(hashToken(token), db);
}
