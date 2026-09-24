import { getDb, type Database } from "../db/client";
import { calculateAge } from "../domain/age";
import {
  listAssetAccountsByUserId,
  type AssetAccount,
} from "../repositories/asset-accounts";
import { findFinancialProfileByUserId } from "../repositories/financial-profiles";

export interface DashboardSummary {
  profile: {
    currentAge: number;
    targetRetirementAge: number;
    yearsToRetirement: number;
    city: string;
    monthlyIncome: number;
    monthlyExpenses: number;
  } | null;
  savings: {
    /** Sum of non-pension assets (cash, deposits, investments). */
    currentSavings: number;
    /** Sum of pension assets (BPJS JHT, DPLK, …). */
    pensionAssets: number;
    accounts: AssetAccount[];
  };
  /**
   * Not calculated until the retirement simulation exists. Kept in the
   * summary shape so the UI does not change when it is implemented.
   */
  estimatedRetirementFund: number | null;
}

/**
 * Assembles everything the dashboard shows for a user. This is plain
 * aggregation of stored data — no projections or retirement maths.
 */
export function getDashboardSummary(
  userId: number,
  today: Date = new Date(),
  db: Database = getDb(),
): DashboardSummary {
  const profile = findFinancialProfileByUserId(userId, db);
  const accounts = listAssetAccountsByUserId(userId, db);

  let currentSavings = 0;
  let pensionAssets = 0;
  for (const account of accounts) {
    if (account.category === "pension") pensionAssets += account.balance;
    else currentSavings += account.balance;
  }

  let profileSummary: DashboardSummary["profile"] = null;
  if (profile) {
    const currentAge = calculateAge(profile.dateOfBirth, today);
    profileSummary = {
      currentAge,
      targetRetirementAge: profile.targetRetirementAge,
      yearsToRetirement: Math.max(profile.targetRetirementAge - currentAge, 0),
      city: profile.city,
      monthlyIncome: profile.monthlyIncome,
      monthlyExpenses: profile.monthlyExpenses,
    };
  }

  return {
    profile: profileSummary,
    savings: { currentSavings, pensionAssets, accounts },
    estimatedRetirementFund: null,
  };
}
