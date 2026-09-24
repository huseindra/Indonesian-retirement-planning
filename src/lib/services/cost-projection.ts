import { getDb, type Database } from "../db/client";
import { DEFAULT_ASSUMPTIONS, type EconomicAssumptions } from "../domain/assumptions";
import { projectProperty, type PropertyProjection } from "../projection/housing";
import { projectLivingCost, type LivingCostProjection } from "../projection/living-costs";
import {
  deleteAssumptions,
  findAssumptionsByUserId,
  upsertAssumptions,
} from "../repositories/economic-assumptions";
import { findFinancialProfileByUserId } from "../repositories/financial-profiles";
import {
  deleteTargetProperty,
  findTargetPropertyByUserId,
  upsertTargetProperty,
  type TargetProperty,
} from "../repositories/target-properties";
import type { RawInput } from "../validation/common";
import {
  validateAssumptions,
  validateTargetProperty,
  type PropertyField,
} from "../validation/cost-projection";
import type { AssumptionKey } from "../domain/assumptions";
import type { MutationResult } from "./financial-profile";

export interface AssumptionsView {
  values: EconomicAssumptions;
  /** True when the user has not saved their own assumptions yet. */
  isDefault: boolean;
  updatedAt: string | null;
}

export function getAssumptions(userId: number, db: Database = getDb()): AssumptionsView {
  const stored = findAssumptionsByUserId(userId, db);
  if (!stored) return { values: { ...DEFAULT_ASSUMPTIONS }, isDefault: true, updatedAt: null };
  const { inflationBps, housingGrowthBps, investmentReturnBps, updatedAt } = stored;
  return { values: { inflationBps, housingGrowthBps, investmentReturnBps }, isDefault: false, updatedAt };
}

export function saveAssumptions(
  userId: number,
  raw: RawInput,
  db: Database = getDb(),
): MutationResult<AssumptionKey> {
  const result = validateAssumptions(raw);
  if (!result.ok) return { ok: false, errors: result.errors };
  upsertAssumptions(userId, result.data, db);
  return { ok: true };
}

/** Removes the user's saved assumptions so the defaults apply again. */
export function resetAssumptions(userId: number, db: Database = getDb()): MutationResult<never> {
  deleteAssumptions(userId, db);
  return { ok: true };
}

const NEEDS_PROFILE = "Create your financial profile first — we need your current age to plan a purchase.";

export function saveTargetProperty(
  userId: number,
  raw: RawInput,
  db: Database = getDb(),
): MutationResult<PropertyField> {
  const profile = findFinancialProfileByUserId(userId, db);
  if (!profile) return { ok: false, formError: NEEDS_PROFILE };
  const result = validateTargetProperty(raw, profile.currentAge);
  if (!result.ok) return { ok: false, errors: result.errors };
  upsertTargetProperty(userId, result.data, db);
  return { ok: true };
}

export function removeTargetProperty(userId: number, db: Database = getDb()): MutationResult<never> {
  return deleteTargetProperty(userId, db)
    ? { ok: true }
    : { ok: false, formError: "There is no target property to delete." };
}

export function getTargetProperty(userId: number, db: Database = getDb()): TargetProperty | null {
  return findTargetPropertyByUserId(userId, db);
}

export interface PropertyView {
  property: TargetProperty;
  /** Where the growth rate used in the projection came from. */
  growthSource: "property" | "assumption";
  growthBps: number;
  /** Null when the purchase age is now earlier than the user's current age. */
  projection: PropertyProjection | null;
}

export interface CostProjectionOverview {
  assumptions: AssumptionsView;
  profile: {
    currentAge: number;
    targetRetirementAge: number;
    monthlyExpenses: number;
    housingStatus: string;
    monthlyRent: number | null;
  } | null;
  livingCost: LivingCostProjection | null;
  property: PropertyView | null;
}

/**
 * Everything the Living Costs page shows. All figures come from the
 * deterministic projection functions; nothing here is estimated by AI.
 */
export function getCostProjectionOverview(userId: number, db: Database = getDb()): CostProjectionOverview {
  const assumptions = getAssumptions(userId, db);
  const profile = findFinancialProfileByUserId(userId, db);
  const property = findTargetPropertyByUserId(userId, db);
  const { inflationBps, housingGrowthBps } = assumptions.values;

  const livingCost = profile
    ? projectLivingCost({
        monthlyCost: profile.monthlyExpenses,
        currentAge: profile.currentAge,
        retirementAge: profile.targetRetirementAge,
        inflationBps,
      })
    : null;

  let propertyView: PropertyView | null = null;
  if (property) {
    const growthBps = property.growthBps ?? housingGrowthBps;
    const canProject = profile !== null && property.purchaseAge >= profile.currentAge;
    propertyView = {
      property,
      growthSource: property.growthBps === null ? "assumption" : "property",
      growthBps,
      projection: canProject
        ? projectProperty({
            currentPrice: property.currentPrice,
            currentAge: profile.currentAge,
            purchaseAge: property.purchaseAge,
            growthBps,
            inflationBps,
          })
        : null,
    };
  }

  return {
    assumptions,
    profile: profile
      ? {
          currentAge: profile.currentAge,
          targetRetirementAge: profile.targetRetirementAge,
          monthlyExpenses: profile.monthlyExpenses,
          housingStatus: profile.housingStatus,
          monthlyRent: profile.monthlyRent,
        }
      : null,
    livingCost,
    property: propertyView,
  };
}
