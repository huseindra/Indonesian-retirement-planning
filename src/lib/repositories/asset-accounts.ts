import { getDb, type Database } from "../db/client";
import type { AssetCategory } from "../domain/financial-profile";

export { ASSET_CATEGORIES, type AssetCategory } from "../domain/financial-profile";

export interface AssetAccountInput {
  name: string;
  category: AssetCategory;
  institution: string | null;
  /** Whole Rupiah. */
  balance: number;
}

export interface AssetAccount extends AssetAccountInput {
  id: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

interface AssetAccountRow {
  id: number;
  user_id: number;
  name: string;
  category: AssetCategory;
  institution: string | null;
  balance: number;
  created_at: string;
  updated_at: string;
}

const COLUMNS = "id, user_id, name, category, institution, balance, created_at, updated_at";

function toAssetAccount(row: AssetAccountRow): AssetAccount {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    category: row.category,
    institution: row.institution,
    balance: row.balance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listAssetAccountsByUserId(
  userId: number,
  db: Database = getDb(),
): AssetAccount[] {
  const rows = db
    .prepare(
      `SELECT ${COLUMNS} FROM asset_accounts WHERE user_id = ? ORDER BY balance DESC, id`,
    )
    .all(userId) as AssetAccountRow[];
  return rows.map(toAssetAccount);
}

/** Scoped by user so one user can never read another user's record. */
export function findAssetAccount(
  userId: number,
  id: number,
  db: Database = getDb(),
): AssetAccount | null {
  const row = db
    .prepare(`SELECT ${COLUMNS} FROM asset_accounts WHERE id = ? AND user_id = ?`)
    .get(id, userId) as AssetAccountRow | undefined;
  return row ? toAssetAccount(row) : null;
}

export function insertAssetAccount(
  userId: number,
  input: AssetAccountInput,
  db: Database = getDb(),
): number {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO asset_accounts (user_id, name, category, institution, balance)
       VALUES (@userId, @name, @category, @institution, @balance)`,
    )
    .run({ userId, ...input });
  return Number(lastInsertRowid);
}

/** Returns false when no record with that id belongs to the user. */
export function updateAssetAccount(
  userId: number,
  id: number,
  input: AssetAccountInput,
  db: Database = getDb(),
): boolean {
  const result = db
    .prepare(
      `UPDATE asset_accounts
          SET name = @name, category = @category, institution = @institution,
              balance = @balance, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = @id AND user_id = @userId`,
    )
    .run({ id, userId, ...input });
  return result.changes > 0;
}

/** Returns false when no record with that id belongs to the user. */
export function deleteAssetAccount(userId: number, id: number, db: Database = getDb()): boolean {
  return (
    db.prepare("DELETE FROM asset_accounts WHERE id = ? AND user_id = ?").run(id, userId)
      .changes > 0
  );
}

export function deleteAssetAccountsByUserId(userId: number, db: Database = getDb()): number {
  return db.prepare("DELETE FROM asset_accounts WHERE user_id = ?").run(userId).changes;
}
