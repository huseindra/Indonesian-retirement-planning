import { getDb, type Database } from "../db/client";

export const ASSET_CATEGORIES = [
  "cash",
  "deposit",
  "mutual_fund",
  "stock",
  "bond",
  "pension",
  "other",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export interface AssetAccount {
  id: number;
  userId: number;
  name: string;
  category: AssetCategory;
  institution: string | null;
  /** Whole Rupiah. */
  balance: number;
  updatedAt: string;
}

interface AssetAccountRow {
  id: number;
  user_id: number;
  name: string;
  category: AssetCategory;
  institution: string | null;
  balance: number;
  updated_at: string;
}

export function listAssetAccountsByUserId(
  userId: number,
  db: Database = getDb(),
): AssetAccount[] {
  const rows = db
    .prepare(
      `SELECT id, user_id, name, category, institution, balance, updated_at
         FROM asset_accounts
        WHERE user_id = ?
        ORDER BY balance DESC, id`,
    )
    .all(userId) as AssetAccountRow[];

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    category: row.category,
    institution: row.institution,
    balance: row.balance,
    updatedAt: row.updated_at,
  }));
}
