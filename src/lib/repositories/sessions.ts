import { getDb, type Database } from "../db/client";
import type { User } from "./users";

interface SessionUserRow {
  id: number;
  username: string;
  full_name: string;
}

export function insertSession(
  sessionId: string,
  userId: number,
  expiresAt: Date,
  db: Database = getDb(),
): void {
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
    sessionId,
    userId,
    expiresAt.toISOString(),
  );
}

/** Returns the user for a session that exists and has not expired. */
export function findUserBySessionId(
  sessionId: string,
  now: Date = new Date(),
  db: Database = getDb(),
): User | null {
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.full_name
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.expires_at > ?`,
    )
    .get(sessionId, now.toISOString()) as SessionUserRow | undefined;

  return row ? { id: row.id, username: row.username, fullName: row.full_name } : null;
}

export function deleteSession(sessionId: string, db: Database = getDb()): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function deleteExpiredSessions(now: Date = new Date(), db: Database = getDb()): void {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now.toISOString());
}
