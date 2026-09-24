import { getDb, type Database } from "../db/client";
import type { HousingStatus } from "../domain/financial-profile";
import { getFinancialOverview, type AssetGroupSummary } from "./financial-profile";
import { getRetirementPlan, type RetirementPlanView } from "./retirement-plan";

export interface DashboardSummary {
  /** Null until the user has completed their financial profile. */
  profile: {
    currentAge: number;
    targetRetirementAge: number;
    yearsToRetirement: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    housingStatus: HousingStatus;
    monthlyRent: number | null;
    propertyValue: number | null;
  } | null;
  savings: {
    /** Cash & savings plus investments. */
    currentSavings: number;
    /** BPJS JHT plus other pension funds. */
    pensionAssets: number;
    accountCount: number;
    groups: AssetGroupSummary[];
  };
  /** Retirement readiness from the shared simulation engine. */
  retirement: RetirementPlanView;
}

/**
 * Assembles everything the dashboard shows for a user from their persisted
 * financial profile, plus the retirement simulation from the same service
 * the Retirement Plan page uses (no formulas are duplicated here).
 */
export function getDashboardSummary(userId: number, db: Database = getDb()): DashboardSummary {
  const overview = getFinancialOverview(userId, db);
  const { profile } = overview;

  return {
    profile: profile
      ? {
          currentAge: profile.currentAge,
          targetRetirementAge: profile.targetRetirementAge,
          yearsToRetirement: profile.targetRetirementAge - profile.currentAge,
          monthlyIncome: profile.monthlyIncome,
          monthlyExpenses: profile.monthlyExpenses,
          housingStatus: profile.housingStatus,
          monthlyRent: profile.monthlyRent,
          propertyValue: profile.propertyValue,
        }
      : null,
    savings: {
      currentSavings: overview.totals.savings,
      pensionAssets: overview.totals.pension,
      accountCount: overview.accountCount,
      groups: overview.groups,
    },
    retirement: getRetirementPlan(userId, db),
  };
}
