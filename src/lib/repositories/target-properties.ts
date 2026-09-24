import { getDb, type Database } from "../db/client";

export interface TargetPropertyInput {
  name: string;
  /** Today's price, whole Rupiah. */
  currentPrice: number;
  purchaseAge: number;
  /** Annual growth in bps, or null to use the housing-growth assumption. */
  growthBps: number | null;
}

export interface TargetProperty extends TargetPropertyInput {
  userId: number;
  updatedAt: string;
}

interface TargetPropertyRow {
  user_id: number;
  name: string;
  current_price: number;
  purchase_age: number;
  growth_bps: number | null;
  updated_at: string;
}

export function findTargetPropertyByUserId(
  userId: number,
  db: Database = getDb(),
): TargetProperty | null {
  const row = db
    .prepare(
      `SELECT user_id, name, current_price, purchase_age, growth_bps, updated_at
         FROM target_properties WHERE user_id = ?`,
    )
    .get(userId) as TargetPropertyRow | undefined;

  return row
    ? {
        userId: row.user_id,
        name: row.name,
        currentPrice: row.current_price,
        purchaseAge: row.purchase_age,
        growthBps: row.growth_bps,
        updatedAt: row.updated_at,
      }
    : null;
}

export function upsertTargetProperty(
  userId: number,
  input: TargetPropertyInput,
  db: Database = getDb(),
): void {
  db.prepare(
    `INSERT INTO target_properties (user_id, name, current_price, purchase_age, growth_bps)
     VALUES (@userId, @name, @currentPrice, @purchaseAge, @growthBps)
     ON CONFLICT (user_id) DO UPDATE SET
       name          = excluded.name,
       current_price = excluded.current_price,
       purchase_age  = excluded.purchase_age,
       growth_bps    = excluded.growth_bps,
       updated_at    = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  ).run({ userId, ...input });
}

export function deleteTargetProperty(userId: number, db: Database = getDb()): boolean {
  return db.prepare("DELETE FROM target_properties WHERE user_id = ?").run(userId).changes > 0;
}
