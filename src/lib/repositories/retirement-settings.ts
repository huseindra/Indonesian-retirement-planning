import { getDb, type Database } from "../db/client";

export interface RetirementSettings {
  userId: number;
  planUntilAge: number;
  updatedAt: string;
}

interface RetirementSettingsRow {
  user_id: number;
  plan_until_age: number;
  updated_at: string;
}

export function findRetirementSettingsByUserId(
  userId: number,
  db: Database = getDb(),
): RetirementSettings | null {
  const row = db
    .prepare("SELECT user_id, plan_until_age, updated_at FROM retirement_settings WHERE user_id = ?")
    .get(userId) as RetirementSettingsRow | undefined;
  return row ? { userId: row.user_id, planUntilAge: row.plan_until_age, updatedAt: row.updated_at } : null;
}

export function upsertRetirementSettings(
  userId: number,
  planUntilAge: number,
  db: Database = getDb(),
): void {
  db.prepare(
    `INSERT INTO retirement_settings (user_id, plan_until_age) VALUES (?, ?)
     ON CONFLICT (user_id) DO UPDATE SET
       plan_until_age = excluded.plan_until_age,
       updated_at     = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  ).run(userId, planUntilAge);
}
