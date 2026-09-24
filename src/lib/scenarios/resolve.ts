import type { ScenarioOverrides } from "../domain/scenarios";
import type { PropertyPurchaseInput, RetirementInput } from "../projection/retirement";

/**
 * Turns a scenario's overrides into an input for the Stage 4 retirement
 * engine. This is substitution only — no financial formulas live here —
 * so scenarios are always calculated by exactly the same engine as the
 * baseline Retirement Plan.
 */

export interface ScenarioBaseline {
  /** The baseline plan exactly as the Retirement Plan page runs it. */
  input: RetirementInput;
  /** Housing-growth assumption, used when a property has no own rate. */
  housingGrowthBps: number;
  /** The user's target property from Living Costs, if any. */
  targetProperty: { name: string; currentPrice: number; purchaseAge: number; growthBps: number | null } | null;
}

export type ValueSource = "scenario" | "baseline";

export interface ResolvedValue {
  value: number;
  /** The baseline plan's value, for side-by-side display. */
  baseline: number | null;
  source: ValueSource;
}

export interface ResolvedScenario {
  input: RetirementInput;
  values: {
    retirementAge: ResolvedValue;
    monthlySpending: ResolvedValue;
    inflationBps: ResolvedValue;
    investmentReturnBps: ResolvedValue;
    retirementYears: ResolvedValue;
    planUntilAge: ResolvedValue;
  };
  property: {
    currentPrice: ResolvedValue;
    purchaseAge: ResolvedValue;
    growthBps: ResolvedValue;
  } | null;
  /** Set when the overrides cannot be turned into a valid input. */
  configurationError: string | null;
}

function pick(override: number | null, baseline: number | null): ResolvedValue {
  if (override !== null) return { value: override, baseline, source: "scenario" };
  return { value: baseline ?? 0, baseline, source: "baseline" };
}

export function resolveScenario(baseline: ScenarioBaseline, overrides: ScenarioOverrides): ResolvedScenario {
  const b = baseline.input;
  const baselineYears = b.planUntilAge - b.retirementAge;

  const retirementAge = pick(overrides.retirementAge, b.retirementAge);
  const monthlySpending = pick(overrides.monthlySpending, b.monthlyLivingCost);
  const inflationBps = pick(overrides.inflationBps, b.inflationBps);
  const investmentReturnBps = pick(overrides.investmentReturnBps, b.investmentReturnBps);

  // Duration: an explicit number of years from the scenario's retirement age;
  // otherwise the baseline plan-until (life-expectancy) age is kept.
  const planUntilAge: ResolvedValue =
    overrides.retirementYears !== null
      ? { value: retirementAge.value + overrides.retirementYears, baseline: b.planUntilAge, source: "scenario" }
      : { value: b.planUntilAge, baseline: b.planUntilAge, source: "baseline" };
  const retirementYears: ResolvedValue = {
    value: planUntilAge.value - retirementAge.value,
    baseline: baselineYears,
    source: overrides.retirementYears !== null ? "scenario" : "baseline",
  };

  let property: ResolvedScenario["property"] = null;
  let propertyPurchase: PropertyPurchaseInput | null = null;
  let configurationError: string | null = null;

  if (overrides.includeProperty) {
    const target = baseline.targetProperty;
    property = {
      currentPrice: pick(overrides.propertyPrice, target?.currentPrice ?? null),
      purchaseAge: pick(overrides.propertyPurchaseAge, target?.purchaseAge ?? null),
      growthBps: pick(overrides.propertyGrowthBps, target ? (target.growthBps ?? baseline.housingGrowthBps) : baseline.housingGrowthBps),
    };
    if (property.currentPrice.baseline === null && overrides.propertyPrice === null) {
      configurationError = "This scenario includes a property purchase but has no price. Set one here or add a target property in Living Costs.";
    } else if (property.purchaseAge.baseline === null && overrides.propertyPurchaseAge === null) {
      configurationError = "This scenario includes a property purchase but has no purchase age. Set one here or add a target property in Living Costs.";
    } else {
      propertyPurchase = {
        currentPrice: property.currentPrice.value,
        purchaseAge: property.purchaseAge.value,
        growthBps: property.growthBps.value,
      };
    }
  }

  return {
    input: {
      ...b,
      assets: { ...b.assets },
      retirementAge: retirementAge.value,
      planUntilAge: planUntilAge.value,
      monthlyLivingCost: monthlySpending.value,
      inflationBps: inflationBps.value,
      investmentReturnBps: investmentReturnBps.value,
      propertyPurchase,
    },
    values: { retirementAge, monthlySpending, inflationBps, investmentReturnBps, retirementYears, planUntilAge },
    property,
    configurationError,
  };
}
