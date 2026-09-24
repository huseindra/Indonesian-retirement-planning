import {
  ASSUMPTION_LABELS,
  ASSUMPTION_LIMITS,
  PROPERTY_LIMITS,
  type AssumptionKey,
  type EconomicAssumptions,
} from "../domain/assumptions";
import type { TargetPropertyInput } from "../repositories/target-properties";
import { money, text, wholeNumber, type FieldErrors, type RawInput, type ValidationResult } from "./common";

/**
 * Parses a percentage typed by a user into basis points. Accepts `3`,
 * `3.5`, `3,5` (Indonesian decimal comma), `3,25%` and negative values;
 * at most two decimal places. Returns null when it cannot be parsed.
 */
export function parsePercentToBps(value: unknown): number | null {
  const s = text(value).replace(/\s|%/g, "").replace("−", "-").replace(",", ".");
  const match = /^(-?)(\d{1,3})(?:\.(\d{1,2}))?$/.exec(s);
  if (!match) return null;
  const [, sign, whole, fraction = ""] = match;
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return sign === "-" && bps !== 0 ? -bps : bps;
}

function percentText(bps: number): string {
  return `${(bps / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
}

function rateField(
  raw: unknown,
  label: string,
  limits: { minBps: number; maxBps: number },
): { value: number } | { error: string } {
  if (text(raw) === "") return { error: `Enter a rate for ${label.toLowerCase()}.` };
  const bps = parsePercentToBps(raw);
  if (bps === null) return { error: `Enter ${label.toLowerCase()} as a percentage, e.g. 3 or 3,5.` };
  if (bps < limits.minBps || bps > limits.maxBps) {
    return {
      error: `${label} must be between ${percentText(limits.minBps)} and ${percentText(limits.maxBps)}.`,
    };
  }
  return { value: bps };
}

const ASSUMPTION_KEYS: AssumptionKey[] = ["inflationBps", "housingGrowthBps", "investmentReturnBps"];

export function validateAssumptions(raw: RawInput): ValidationResult<EconomicAssumptions, AssumptionKey> {
  const errors: FieldErrors<AssumptionKey> = {};
  const data = {} as EconomicAssumptions;

  for (const key of ASSUMPTION_KEYS) {
    const result = rateField(raw[key], ASSUMPTION_LABELS[key], ASSUMPTION_LIMITS[key]);
    if ("error" in result) errors[key] = result.error;
    else data[key] = result.value;
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, data };
}

export type PropertyField = "name" | "currentPrice" | "purchaseAge" | "growthBps";

/**
 * Validates the target property. `currentAge` comes from the user's
 * financial profile; the purchase cannot be planned in the past.
 */
export function validateTargetProperty(
  raw: RawInput,
  currentAge: number,
): ValidationResult<TargetPropertyInput, PropertyField> {
  const errors: FieldErrors<PropertyField> = {};

  const name = text(raw.name);
  if (!name) errors.name = "Describe the property, e.g. “3-bedroom house in Depok”.";
  else if (name.length > PROPERTY_LIMITS.maxNameLength)
    errors.name = `Description must be ${PROPERTY_LIMITS.maxNameLength} characters or fewer.`;

  const price = money(raw.currentPrice, "the property's current price", { positive: true });
  if ("error" in price) errors.currentPrice = price.error;

  const purchaseAge = wholeNumber(raw.purchaseAge);
  if (text(raw.purchaseAge) === "") errors.purchaseAge = "Enter the age you expect to buy.";
  else if (purchaseAge === null) errors.purchaseAge = "Enter the purchase age as a whole number of years.";
  else if (purchaseAge < currentAge)
    errors.purchaseAge = `Purchase age can't be earlier than your current age (${currentAge}).`;
  else if (purchaseAge > PROPERTY_LIMITS.maxPurchaseAge)
    errors.purchaseAge = `Purchase age must be ${PROPERTY_LIMITS.maxPurchaseAge} or less.`;

  // Blank growth means "use my housing-growth assumption".
  let growthBps: number | null = null;
  if (text(raw.growthBps) !== "") {
    const growth = rateField(raw.growthBps, "Property-price growth", ASSUMPTION_LIMITS.housingGrowthBps);
    if ("error" in growth) errors.growthBps = growth.error;
    else growthBps = growth.value;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      name,
      currentPrice: (price as { value: number }).value,
      purchaseAge: purchaseAge!,
      growthBps,
    },
  };
}
