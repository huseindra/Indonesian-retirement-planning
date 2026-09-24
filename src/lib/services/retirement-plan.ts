import { getDb, type Database } from "../db/client";
import { DEFAULT_PLAN_UNTIL_AGE } from "../domain/assumptions";
import {
  RetirementInputError,
  simulateRetirement,
  type RetirementInput,
  type RetirementResult,
} from "../projection/retirement";
import {
  findRetirementSettingsByUserId,
  upsertRetirementSettings,
} from "../repositories/retirement-settings";
import type { RawInput } from "../validation/common";
import { validateRetirementSettings, type RetirementSettingsField } from "../validation/retirement-plan";
import { getAssumptions, type AssumptionsView } from "./cost-projection";
import { getFinancialOverview, type FinancialOverview, type MutationResult } from "./financial-profile";

export interface RetirementSettingsView {
  planUntilAge: number;
  /** True when the user has not saved their own plan-until age. */
  isDefault: boolean;
}

interface PlanContext {
  settings: RetirementSettingsView;
  assumptions: AssumptionsView;
}

/**
 * The outcome of building and running a user's retirement simulation:
 * - `incomplete`: required inputs (the financial profile) are missing
 * - `error`: inputs exist but are inconsistent, e.g. plan-until age ≤ retirement age
 * - `ready`: the simulation ran
 */
export type RetirementPlanView =
  | (PlanContext & { status: "incomplete"; missing: "profile" })
  | (PlanContext & { status: "error"; message: string; field: string })
  | (PlanContext & { status: "ready"; result: RetirementResult; hasAssets: boolean });

export function getRetirementSettings(userId: number, db: Database = getDb()): RetirementSettingsView {
  const stored = findRetirementSettingsByUserId(userId, db);
  return stored
    ? { planUntilAge: stored.planUntilAge, isDefault: false }
    : { planUntilAge: DEFAULT_PLAN_UNTIL_AGE, isDefault: true };
}

/**
 * Maps persisted data from earlier stages onto the engine's plain input.
 * Exported so scenario comparison can start from the same baseline.
 */
export function buildRetirementInput(
  overview: FinancialOverview,
  assumptions: AssumptionsView,
  settings: RetirementSettingsView,
): RetirementInput | null {
  const { profile } = overview;
  if (!profile) return null;
  const total = (group: string) => overview.groups.find((g) => g.group === group)?.total ?? 0;

  return {
    currentAge: profile.currentAge,
    retirementAge: profile.targetRetirementAge,
    planUntilAge: settings.planUntilAge,
    monthlyLivingCost: profile.monthlyExpenses,
    assets: {
      cashAndSavings: total("cash"),
      investments: total("investments"),
      jht: total("jht"),
      otherPension: total("pension"),
    },
    inflationBps: assumptions.values.inflationBps,
    investmentReturnBps: assumptions.values.investmentReturnBps,
  };
}

export function getRetirementPlan(userId: number, db: Database = getDb()): RetirementPlanView {
  const settings = getRetirementSettings(userId, db);
  const assumptions = getAssumptions(userId, db);
  const overview = getFinancialOverview(userId, db);
  const input = buildRetirementInput(overview, assumptions, settings);

  if (!input) return { status: "incomplete", missing: "profile", settings, assumptions };

  try {
    return {
      status: "ready",
      result: simulateRetirement(input),
      hasAssets: overview.accountCount > 0,
      settings,
      assumptions,
    };
  } catch (error) {
    if (error instanceof RetirementInputError) {
      return { status: "error", message: error.message, field: error.field, settings, assumptions };
    }
    throw error;
  }
}

export function saveRetirementSettings(
  userId: number,
  raw: RawInput,
  db: Database = getDb(),
): MutationResult<RetirementSettingsField> {
  const profile = getFinancialOverview(userId, db).profile;
  const result = validateRetirementSettings(raw, profile?.targetRetirementAge ?? null);
  if (!result.ok) return { ok: false, errors: result.errors };
  upsertRetirementSettings(userId, result.data.planUntilAge, db);
  return { ok: true };
}
