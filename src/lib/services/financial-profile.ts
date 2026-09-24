import { getDb, type Database } from "../db/client";
import {
  ASSET_GROUPS,
  ASSET_GROUP_OF,
  isPensionGroup,
  type AssetGroup,
} from "../domain/financial-profile";
import {
  deleteAssetAccount,
  deleteAssetAccountsByUserId,
  findAssetAccount,
  insertAssetAccount,
  listAssetAccountsByUserId,
  updateAssetAccount,
  type AssetAccount,
} from "../repositories/asset-accounts";
import {
  deleteFinancialProfile,
  findFinancialProfileByUserId,
  upsertFinancialProfile,
  type FinancialProfile,
} from "../repositories/financial-profiles";
import {
  validateAssetAccount,
  validateFinancialProfile,
  type AssetField,
  type FieldErrors,
  type ProfileField,
  type RawInput,
} from "../validation/financial-profile";

export interface AssetGroupSummary {
  group: AssetGroup;
  total: number;
  accounts: AssetAccount[];
}

export interface FinancialOverview {
  profile: FinancialProfile | null;
  groups: AssetGroupSummary[];
  accountCount: number;
  totals: {
    /** Cash & savings + investments. */
    savings: number;
    /** JHT + other pension funds. */
    pension: number;
    all: number;
  };
}

export function getFinancialOverview(userId: number, db: Database = getDb()): FinancialOverview {
  const profile = findFinancialProfileByUserId(userId, db);
  const accounts = listAssetAccountsByUserId(userId, db);

  const groups: AssetGroupSummary[] = ASSET_GROUPS.map((group) => {
    const inGroup = accounts.filter((a) => ASSET_GROUP_OF[a.category] === group);
    return { group, accounts: inGroup, total: inGroup.reduce((sum, a) => sum + a.balance, 0) };
  });

  let savings = 0;
  let pension = 0;
  for (const g of groups) {
    if (isPensionGroup(g.group)) pension += g.total;
    else savings += g.total;
  }

  return {
    profile,
    groups,
    accountCount: accounts.length,
    totals: { savings, pension, all: savings + pension },
  };
}

export type MutationResult<K extends string> =
  | { ok: true }
  | { ok: false; errors?: FieldErrors<K>; formError?: string };

export function saveFinancialProfile(
  userId: number,
  raw: RawInput,
  db: Database = getDb(),
): MutationResult<ProfileField> & { created?: boolean } {
  const result = validateFinancialProfile(raw);
  if (!result.ok) return { ok: false, errors: result.errors };

  const created = findFinancialProfileByUserId(userId, db) === null;
  upsertFinancialProfile(userId, result.data, db);
  return { ok: true, created };
}

/** Deletes the profile and every asset record, atomically. */
export function deleteFinancialData(userId: number, db: Database = getDb()): MutationResult<never> {
  const removed = db.transaction(() => {
    const assets = deleteAssetAccountsByUserId(userId, db);
    const profile = deleteFinancialProfile(userId, db);
    return assets > 0 || profile;
  })();
  return removed ? { ok: true } : { ok: false, formError: "There is no financial profile to delete." };
}

const NEEDS_PROFILE = "Create your financial profile before adding assets.";
const NOT_FOUND = "That record no longer exists. It may have been deleted.";

export function createAsset(
  userId: number,
  raw: RawInput,
  db: Database = getDb(),
): MutationResult<AssetField> {
  if (!findFinancialProfileByUserId(userId, db)) return { ok: false, formError: NEEDS_PROFILE };
  const result = validateAssetAccount(raw);
  if (!result.ok) return { ok: false, errors: result.errors };
  insertAssetAccount(userId, result.data, db);
  return { ok: true };
}

export function updateAsset(
  userId: number,
  id: number,
  raw: RawInput,
  db: Database = getDb(),
): MutationResult<AssetField> {
  const result = validateAssetAccount(raw);
  if (!result.ok) return { ok: false, errors: result.errors };
  return updateAssetAccount(userId, id, result.data, db)
    ? { ok: true }
    : { ok: false, formError: NOT_FOUND };
}

export function removeAsset(userId: number, id: number, db: Database = getDb()): MutationResult<never> {
  return deleteAssetAccount(userId, id, db) ? { ok: true } : { ok: false, formError: NOT_FOUND };
}

export function getAsset(userId: number, id: number, db: Database = getDb()): AssetAccount | null {
  return findAssetAccount(userId, id, db);
}
