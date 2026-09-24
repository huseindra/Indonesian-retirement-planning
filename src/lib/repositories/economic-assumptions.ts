import { getDb, type Database } from "../db/client";
import type { EconomicAssumptions } from "../domain/assumptions";

export interface StoredAssumptions extends EconomicAssumptions {
  userId: number;
  updatedAt: string;
}

interface AssumptionsRow {
  user_id: number;
  inflation_bps: number;
  housing_growth_bps: number;
  investment_return_bps: number;
  updated_at: string;
}

export function findAssumptionsByUserId(
  userId: number,
  db: Database = getDb(),
): StoredAssumptions | null {
  const row = db
    .prepare(
      `SELECT user_id, inflation_bps, housing_growth_bps, investment_return_bps, updated_at
         FROM economic_assumptions WHERE user_id = ?`,
    )
    .get(userId) as AssumptionsRow | undefined;

  return row
    ? {
        userId: row.user_id,
        inflationBps: row.inflation_bps,
        housingGrowthBps: row.housing_growth_bps,
        investmentReturnBps: row.investment_return_bps,
        updatedAt: row.updated_at,
      }
    : null;
}

export function upsertAssumptions(
  userId: number,
  input: EconomicAssumptions,
  db: Database = getDb(),
): void {
  db.prepare(
    `INSERT INTO economic_assumptions (user_id, inflation_bps, housing_growth_bps, investment_return_bps)
     VALUES (@userId, @inflationBps, @housingGrowthBps, @investmentReturnBps)
     ON CONFLICT (user_id) DO UPDATE SET
       inflation_bps         = excluded.inflation_bps,
       housing_growth_bps    = excluded.housing_growth_bps,
       investment_return_bps = excluded.investment_return_bps,
       updated_at            = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  ).run({ userId, ...input });
}

export function deleteAssumptions(userId: number, db: Database = getDb()): boolean {
  return db.prepare("DELETE FROM economic_assumptions WHERE user_id = ?").run(userId).changes > 0;
}
