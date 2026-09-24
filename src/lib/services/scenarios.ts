import { getDb, type Database } from "../db/client";
import { PLAN_UNTIL_LIMITS } from "../domain/assumptions";
import {
  APPLICABLE_FIELDS,
  EXAMPLE_SCENARIOS,
  SCENARIO_LIMITS,
  type ApplicableField,
  type ScenarioInput,
} from "../domain/scenarios";
import { RetirementInputError, simulateRetirement, type RetirementResult } from "../projection/retirement";
import { upsertAssumptions } from "../repositories/economic-assumptions";
import { findFinancialProfileByUserId, upsertFinancialProfile } from "../repositories/financial-profiles";
import { upsertRetirementSettings } from "../repositories/retirement-settings";
import {
  deleteScenarioRow,
  findScenario,
  insertScenario,
  listScenariosByUserId,
  scenarioNameExists,
  updateScenarioRow,
  type Scenario,
} from "../repositories/scenarios";
import { findTargetPropertyByUserId, upsertTargetProperty } from "../repositories/target-properties";
import { resolveScenario, type ResolvedScenario, type ScenarioBaseline } from "../scenarios/resolve";
import type { RawInput } from "../validation/common";
import { validateScenario, type ScenarioField } from "../validation/scenarios";
import { getAssumptions } from "./cost-projection";
import { getFinancialOverview, type MutationResult } from "./financial-profile";
import { buildRetirementInput, getRetirementSettings } from "./retirement-plan";

/**
 * Scenarios are stored overrides on top of the user's baseline plan. This
 * service only ever READS the baseline tables, except in
 * applyScenarioToBaseline(), which the user must trigger explicitly.
 */

/** The baseline exactly as the Retirement Plan page builds it, or null without a profile. */
export function getScenarioBaseline(userId: number, db: Database = getDb()): ScenarioBaseline | null {
  const assumptions = getAssumptions(userId, db);
  const input = buildRetirementInput(getFinancialOverview(userId, db), assumptions, getRetirementSettings(userId, db));
  if (!input) return null;
  const property = findTargetPropertyByUserId(userId, db);
  return {
    input,
    housingGrowthBps: assumptions.values.housingGrowthBps,
    targetProperty: property
      ? {
          name: property.name,
          currentPrice: property.currentPrice,
          purchaseAge: property.purchaseAge,
          growthBps: property.growthBps,
        }
      : null,
  };
}

export type ScenarioOutcome =
  | { status: "ready"; result: RetirementResult }
  | { status: "error"; message: string };

export interface EvaluatedScenario {
  scenario: Scenario;
  resolved: ResolvedScenario;
  outcome: ScenarioOutcome;
}

/** Runs the same Stage 4 engine used by the Retirement Plan page. */
function evaluate(scenario: Scenario, baseline: ScenarioBaseline): EvaluatedScenario {
  const resolved = resolveScenario(baseline, scenario);
  if (resolved.configurationError) {
    return { scenario, resolved, outcome: { status: "error", message: resolved.configurationError } };
  }
  try {
    return { scenario, resolved, outcome: { status: "ready", result: simulateRetirement(resolved.input) } };
  } catch (error) {
    if (error instanceof RetirementInputError) {
      return { scenario, resolved, outcome: { status: "error", message: error.message } };
    }
    throw error;
  }
}

export type ScenarioComparison =
  | { status: "incomplete"; scenarios: Scenario[] }
  | {
      status: "ready";
      baseline: ScenarioBaseline;
      baselineOutcome: ScenarioOutcome;
      scenarios: EvaluatedScenario[];
    };

export function compareScenarios(userId: number, db: Database = getDb()): ScenarioComparison {
  const scenarios = listScenariosByUserId(userId, db);
  const baseline = getScenarioBaseline(userId, db);
  if (!baseline) return { status: "incomplete", scenarios };

  let baselineOutcome: ScenarioOutcome;
  try {
    baselineOutcome = { status: "ready", result: simulateRetirement(baseline.input) };
  } catch (error) {
    if (!(error instanceof RetirementInputError)) throw error;
    baselineOutcome = { status: "error", message: error.message };
  }
  return { status: "ready", baseline, baselineOutcome, scenarios: scenarios.map((s) => evaluate(s, baseline)) };
}

export type ScenarioDetail =
  | { status: "not-found" }
  | { status: "incomplete"; scenario: Scenario }
  | ({ status: "ready"; baseline: ScenarioBaseline } & EvaluatedScenario);

export function getScenarioDetail(userId: number, id: number, db: Database = getDb()): ScenarioDetail {
  const scenario = findScenario(userId, id, db);
  if (!scenario) return { status: "not-found" };
  const baseline = getScenarioBaseline(userId, db);
  if (!baseline) return { status: "incomplete", scenario };
  return { status: "ready", baseline, ...evaluate(scenario, baseline) };
}

export function getScenario(userId: number, id: number, db: Database = getDb()): Scenario | null {
  return findScenario(userId, id, db);
}

const NEEDS_PROFILE = "Create your financial profile first — scenarios start from your baseline plan.";
const NOT_FOUND = "That scenario no longer exists. It may have been deleted.";

function validateForUser(
  userId: number,
  raw: RawInput,
  exceptId: number | null,
  db: Database,
): { ok: true; data: ScenarioInput } | Extract<MutationResult<ScenarioField>, { ok: false }> {
  const profile = findFinancialProfileByUserId(userId, db);
  if (!profile) return { ok: false, formError: NEEDS_PROFILE };
  const result = validateScenario(raw, profile.currentAge);
  if (!result.ok) return { ok: false, errors: result.errors };
  if (scenarioNameExists(userId, result.data.name, exceptId, db)) {
    return { ok: false, errors: { name: "You already have a scenario with this name." } };
  }
  return { ok: true, data: result.data };
}

export function createScenario(
  userId: number,
  raw: RawInput,
  db: Database = getDb(),
): MutationResult<ScenarioField> & { id?: number } {
  const valid = validateForUser(userId, raw, null, db);
  if (!valid.ok) return valid;
  return { ok: true, id: insertScenario(userId, valid.data, db) };
}

export function updateScenario(
  userId: number,
  id: number,
  raw: RawInput,
  db: Database = getDb(),
): MutationResult<ScenarioField> {
  if (!findScenario(userId, id, db)) return { ok: false, formError: NOT_FOUND };
  const valid = validateForUser(userId, raw, id, db);
  if (!valid.ok) return valid;
  updateScenarioRow(userId, id, valid.data, db);
  return { ok: true };
}

export function deleteScenario(userId: number, id: number, db: Database = getDb()): MutationResult<never> {
  return deleteScenarioRow(userId, id, db) ? { ok: true } : { ok: false, formError: NOT_FOUND };
}

/** "Copy of X", then "Copy of X (2)", … trimmed to the name limit. */
function uniqueCopyName(userId: number, name: string, db: Database): string {
  const base = `Copy of ${name}`.slice(0, SCENARIO_LIMITS.maxNameLength);
  if (!scenarioNameExists(userId, base, null, db)) return base;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = `${base.slice(0, SCENARIO_LIMITS.maxNameLength - suffix.length)}${suffix}`;
    if (!scenarioNameExists(userId, candidate, null, db)) return candidate;
  }
}

export function duplicateScenario(
  userId: number,
  id: number,
  db: Database = getDb(),
): MutationResult<never> & { id?: number } {
  const source = findScenario(userId, id, db);
  if (!source) return { ok: false, formError: NOT_FOUND };
  const copy: ScenarioInput = { ...source, name: uniqueCopyName(userId, source.name, db) };
  return { ok: true, id: insertScenario(userId, copy, db) };
}

/** Adds the Base, Conservative and Optimistic examples (skipping names already used). */
export function addExampleScenarios(userId: number, db: Database = getDb()): number {
  return db.transaction(() => {
    let added = 0;
    for (const example of EXAMPLE_SCENARIOS) {
      if (!scenarioNameExists(userId, example.name, null, db)) {
        insertScenario(userId, example, db);
        added++;
      }
    }
    return added;
  })();
}

export type ApplyField = ApplicableField;

/** The fields of a scenario that differ from the baseline and could be applied. */
export function applicableFields(scenario: Scenario): ApplicableField[] {
  return APPLICABLE_FIELDS.filter((field) =>
    field === "property"
      ? scenario.includeProperty &&
        (scenario.propertyPrice !== null || scenario.propertyPurchaseAge !== null || scenario.propertyGrowthBps !== null)
      : scenario[field] !== null,
  );
}

/**
 * Copies the selected scenario values into the baseline plan. This is the
 * ONLY path by which a scenario changes the profile, assumptions, plan
 * settings or target property, and it runs only for fields the user ticked.
 */
export function applyScenarioToBaseline(
  userId: number,
  id: number,
  fields: string[],
  db: Database = getDb(),
): MutationResult<never> & { applied?: ApplicableField[] } {
  const scenario = findScenario(userId, id, db);
  if (!scenario) return { ok: false, formError: NOT_FOUND };
  const baseline = getScenarioBaseline(userId, db);
  const profile = findFinancialProfileByUserId(userId, db);
  if (!baseline || !profile) return { ok: false, formError: NEEDS_PROFILE };

  const allowed = applicableFields(scenario);
  const selected = allowed.filter((f) => fields.includes(f));
  if (selected.length === 0) return { ok: false, formError: "Choose at least one assumption to apply." };

  const resolved = resolveScenario(baseline, scenario);
  const retirementAge = selected.includes("retirementAge") ? resolved.values.retirementAge.value : profile.targetRetirementAge;
  const planUntil = retirementAge + resolved.values.retirementYears.value;

  if (selected.includes("retirementYears") && (planUntil < PLAN_UNTIL_LIMITS.min || planUntil > PLAN_UNTIL_LIMITS.max)) {
    return { ok: false, formError: `That duration would plan until age ${planUntil}, outside ${PLAN_UNTIL_LIMITS.min}–${PLAN_UNTIL_LIMITS.max}.` };
  }
  if (selected.includes("retirementAge") && !selected.includes("retirementYears") && baseline.input.planUntilAge <= retirementAge) {
    return {
      ok: false,
      formError: `Your plan-until age (${baseline.input.planUntilAge}) would no longer be after retirement at ${retirementAge}. Apply the retirement duration too, or change the plan-until age first.`,
    };
  }

  const apply = db.transaction(() => {
    if (selected.includes("retirementAge") || selected.includes("monthlySpending")) {
      upsertFinancialProfile(
        userId,
        {
          currentAge: profile.currentAge,
          targetRetirementAge: retirementAge,
          monthlyIncome: profile.monthlyIncome,
          monthlyExpenses: selected.includes("monthlySpending")
            ? resolved.values.monthlySpending.value
            : profile.monthlyExpenses,
          housingStatus: profile.housingStatus,
          propertyValue: profile.propertyValue,
          monthlyRent: profile.monthlyRent,
          city: profile.city,
        },
        db,
      );
    }
    if (selected.includes("inflationBps") || selected.includes("investmentReturnBps")) {
      const current = getAssumptions(userId, db).values;
      upsertAssumptions(
        userId,
        {
          ...current,
          inflationBps: selected.includes("inflationBps") ? resolved.values.inflationBps.value : current.inflationBps,
          investmentReturnBps: selected.includes("investmentReturnBps")
            ? resolved.values.investmentReturnBps.value
            : current.investmentReturnBps,
        },
        db,
      );
    }
    if (selected.includes("retirementYears")) upsertRetirementSettings(userId, planUntil, db);
    if (selected.includes("property") && resolved.property) {
      upsertTargetProperty(
        userId,
        {
          name: baseline.targetProperty?.name ?? `Target property from “${scenario.name}”`,
          currentPrice: resolved.property.currentPrice.value,
          purchaseAge: resolved.property.purchaseAge.value,
          growthBps: scenario.propertyGrowthBps ?? baseline.targetProperty?.growthBps ?? null,
        },
        db,
      );
    }
  });
  apply();
  return { ok: true, applied: selected };
}
