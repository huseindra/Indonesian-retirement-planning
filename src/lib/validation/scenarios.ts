import { ASSUMPTION_LABELS, ASSUMPTION_LIMITS } from "../domain/assumptions";
import { SCENARIO_LIMITS, type ScenarioInput } from "../domain/scenarios";
import { money, text, wholeNumber, type FieldErrors, type RawInput, type ValidationResult } from "./common";
import { parsePercentToBps } from "./cost-projection";

export type ScenarioField =
  | "name"
  | "description"
  | "retirementAge"
  | "monthlySpending"
  | "inflationBps"
  | "investmentReturnBps"
  | "retirementYears"
  | "propertyPrice"
  | "propertyPurchaseAge"
  | "propertyGrowthBps";

type Optional = { value: number | null } | { error: string };

/** Every override is optional: a blank field means "use the baseline". */
function optionalRate(raw: unknown, label: string, limits: { minBps: number; maxBps: number }): Optional {
  if (text(raw) === "") return { value: null };
  const bps = parsePercentToBps(raw);
  if (bps === null) return { error: `Enter ${label.toLowerCase()} as a percentage, e.g. 3 or 3,5 — or leave blank.` };
  if (bps < limits.minBps || bps > limits.maxBps) {
    return { error: `${label} must be between ${limits.minBps / 100}% and ${limits.maxBps / 100}%.` };
  }
  return { value: bps };
}

function optionalAge(raw: unknown, label: string, min: number, max: number, minReason: string): Optional {
  if (text(raw) === "") return { value: null };
  const age = wholeNumber(raw);
  if (age === null) return { error: `Enter ${label} as a whole number of years — or leave blank.` };
  if (age < min) return { error: minReason };
  if (age > max) return { error: `${label[0].toUpperCase()}${label.slice(1)} must be ${max} or less.` };
  return { value: age };
}

/**
 * Validates a scenario form. `currentAge` comes from the baseline profile so
 * ages in the past are rejected; cross-field consistency (e.g. property age
 * after retirement) is reported by the engine as a calculation error.
 */
export function validateScenario(
  raw: RawInput,
  currentAge: number,
): ValidationResult<ScenarioInput, ScenarioField> {
  const errors: FieldErrors<ScenarioField> = {};
  const set = (field: ScenarioField, result: Optional | { value: number } | { error: string }): number | null => {
    if ("error" in result) {
      errors[field] = result.error;
      return null;
    }
    return result.value;
  };

  const name = text(raw.name);
  if (!name) errors.name = "Give the scenario a name, e.g. “Retire at 55”.";
  else if (name.length > SCENARIO_LIMITS.maxNameLength)
    errors.name = `Name must be ${SCENARIO_LIMITS.maxNameLength} characters or fewer.`;

  const description = text(raw.description);
  if (description.length > SCENARIO_LIMITS.maxDescriptionLength)
    errors.description = `Description must be ${SCENARIO_LIMITS.maxDescriptionLength} characters or fewer.`;

  const retirementAge = set(
    "retirementAge",
    optionalAge(raw.retirementAge, "the retirement age", currentAge + 1, SCENARIO_LIMITS.maxRetirementAge,
      `Retirement age must be later than your current age (${currentAge}).`),
  );

  const monthlySpending =
    text(raw.monthlySpending) === ""
      ? null
      : set("monthlySpending", money(raw.monthlySpending, "monthly spending"));

  const inflationBps = set("inflationBps", optionalRate(raw.inflationBps, ASSUMPTION_LABELS.inflationBps, ASSUMPTION_LIMITS.inflationBps));
  const investmentReturnBps = set(
    "investmentReturnBps",
    optionalRate(raw.investmentReturnBps, ASSUMPTION_LABELS.investmentReturnBps, ASSUMPTION_LIMITS.investmentReturnBps),
  );

  const retirementYears = set(
    "retirementYears",
    optionalAge(raw.retirementYears, "the retirement duration", SCENARIO_LIMITS.minRetirementYears,
      SCENARIO_LIMITS.maxRetirementYears, `Retirement must last at least ${SCENARIO_LIMITS.minRetirementYears} year.`),
  );

  const includeProperty = raw.includeProperty === "on" || raw.includeProperty === "true";
  let propertyPrice: number | null = null;
  let propertyPurchaseAge: number | null = null;
  let propertyGrowthBps: number | null = null;
  if (includeProperty) {
    propertyPrice =
      text(raw.propertyPrice) === ""
        ? null
        : set("propertyPrice", money(raw.propertyPrice, "the property price", { positive: true }));
    propertyPurchaseAge = set(
      "propertyPurchaseAge",
      optionalAge(raw.propertyPurchaseAge, "the purchase age", currentAge, 100,
        `Purchase age can't be earlier than your current age (${currentAge}).`),
    );
    propertyGrowthBps = set(
      "propertyGrowthBps",
      optionalRate(raw.propertyGrowthBps, "Property-price growth", ASSUMPTION_LIMITS.housingGrowthBps),
    );
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      name,
      description: description || null,
      retirementAge,
      monthlySpending,
      inflationBps,
      investmentReturnBps,
      retirementYears,
      includeProperty,
      propertyPrice,
      propertyPurchaseAge,
      propertyGrowthBps,
    },
  };
}
