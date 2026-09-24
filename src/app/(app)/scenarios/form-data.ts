import { formatRupiah } from "@/lib/format/currency";
import { formatRate } from "@/lib/projection/compound";
import type { Scenario } from "@/lib/repositories/scenarios";
import type { ScenarioBaseline } from "@/lib/scenarios/resolve";
import type { BaselineHints, ScenarioFormDefaults } from "./scenario-form";

/** Rate in bps → the text a user would type, e.g. 350 → "3,5". */
function rateInput(bps: number | null): string {
  return bps === null ? "" : (bps / 100).toLocaleString("id-ID", { maximumFractionDigits: 2, useGrouping: false });
}

const text = (value: number | null) => (value === null ? "" : String(value));

export function formDefaults(scenario: Scenario | null): ScenarioFormDefaults {
  if (!scenario) {
    return {
      name: "",
      description: "",
      retirementAge: "",
      monthlySpending: "",
      inflationBps: "",
      investmentReturnBps: "",
      retirementYears: "",
      includeProperty: false,
      propertyPrice: "",
      propertyPurchaseAge: "",
      propertyGrowthBps: "",
    };
  }
  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description ?? "",
    retirementAge: text(scenario.retirementAge),
    monthlySpending: text(scenario.monthlySpending),
    inflationBps: rateInput(scenario.inflationBps),
    investmentReturnBps: rateInput(scenario.investmentReturnBps),
    retirementYears: text(scenario.retirementYears),
    includeProperty: scenario.includeProperty,
    propertyPrice: text(scenario.propertyPrice),
    propertyPurchaseAge: text(scenario.propertyPurchaseAge),
    propertyGrowthBps: rateInput(scenario.propertyGrowthBps),
  };
}

export function baselineHints(baseline: ScenarioBaseline): BaselineHints {
  const b = baseline.input;
  const property = baseline.targetProperty;
  return {
    currentAge: b.currentAge,
    retirementAge: `${b.retirementAge}`,
    monthlySpending: formatRupiah(b.monthlyLivingCost),
    inflation: formatRate(b.inflationBps),
    investmentReturn: formatRate(b.investmentReturnBps),
    retirementYears: `${b.planUntilAge - b.retirementAge} years (to age ${b.planUntilAge})`,
    housingGrowth: formatRate(baseline.housingGrowthBps),
    property: property
      ? {
          price: formatRupiah(property.currentPrice),
          purchaseAge: `${property.purchaseAge}`,
          growth: formatRate(property.growthBps ?? baseline.housingGrowthBps),
        }
      : null,
  };
}
