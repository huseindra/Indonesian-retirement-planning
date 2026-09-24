import {
  HOUSING_STATUS_LABELS,
  LIMITS,
  isAssetCategory,
  isHousingStatus,
} from "../domain/financial-profile";
import type { AssetAccountInput } from "../repositories/asset-accounts";
import type { FinancialProfileInput } from "../repositories/financial-profiles";

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type ValidationResult<T, K extends string> =
  | { ok: true; data: T }
  | { ok: false; errors: FieldErrors<K> };

/** Raw form values, e.g. `Object.fromEntries(formData)`. */
export type RawInput = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Parses a whole-Rupiah amount typed by a user. Accepts `25000000`,
 * `25.000.000`, `Rp 25.000.000` and `25,000,000`; rejects decimals.
 */
export function parseRupiah(value: unknown): number | null {
  let s = text(value).replace(/^rp\.?\s*/i, "").replace(/\s/g, "");
  if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+$/.test(s)) return null;
  const amount = Number(s);
  return Number.isSafeInteger(amount) ? amount : null;
}

function money(
  value: unknown,
  label: string,
  { positive = false }: { positive?: boolean } = {},
): { value: number } | { error: string } {
  if (text(value) === "") return { error: `Enter ${label}.` };
  const amount = parseRupiah(value);
  if (amount === null) return { error: `Enter ${label} as a whole Rupiah amount, e.g. 5.000.000.` };
  if (amount > LIMITS.maxMoney) return { error: `${capitalise(label)} is too large.` };
  if (positive && amount === 0) return { error: `${capitalise(label)} must be more than Rp 0.` };
  return { value: amount };
}

function wholeNumber(value: unknown): number | null {
  const s = text(value);
  if (!/^\d{1,3}$/.test(s)) return null;
  return Number(s);
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type ProfileField =
  | "currentAge"
  | "targetRetirementAge"
  | "monthlyIncome"
  | "monthlyExpenses"
  | "housingStatus"
  | "propertyValue"
  | "monthlyRent"
  | "city";

export function validateFinancialProfile(
  raw: RawInput,
): ValidationResult<FinancialProfileInput, ProfileField> {
  const errors: FieldErrors<ProfileField> = {};

  const currentAge = wholeNumber(raw.currentAge);
  if (text(raw.currentAge) === "") errors.currentAge = "Enter your current age.";
  else if (currentAge === null) errors.currentAge = "Enter your age as a whole number of years.";
  else if (currentAge < LIMITS.minAge || currentAge > LIMITS.maxAge - 1)
    errors.currentAge = `Age must be between ${LIMITS.minAge} and ${LIMITS.maxAge - 1}.`;

  const targetRetirementAge = wholeNumber(raw.targetRetirementAge);
  if (text(raw.targetRetirementAge) === "")
    errors.targetRetirementAge = "Enter the age you want to retire.";
  else if (targetRetirementAge === null)
    errors.targetRetirementAge = "Enter the retirement age as a whole number of years.";
  else if (targetRetirementAge > LIMITS.maxAge)
    errors.targetRetirementAge = `Retirement age must be ${LIMITS.maxAge} or less.`;
  else if (currentAge !== null && !errors.currentAge && targetRetirementAge <= currentAge)
    errors.targetRetirementAge = "Retirement age must be later than your current age.";

  const income = money(raw.monthlyIncome, "your monthly income");
  if ("error" in income) errors.monthlyIncome = income.error;

  const expenses = money(raw.monthlyExpenses, "your monthly living expenses");
  if ("error" in expenses) errors.monthlyExpenses = expenses.error;

  const housingStatus = text(raw.housingStatus);
  let propertyValue: number | null = null;
  let monthlyRent: number | null = null;
  if (!isHousingStatus(housingStatus)) {
    errors.housingStatus = `Choose one: ${Object.values(HOUSING_STATUS_LABELS).join(", ")}.`;
  } else if (housingStatus === "own") {
    const result = money(raw.propertyValue, "the current value of your property", { positive: true });
    if ("error" in result) errors.propertyValue = result.error;
    else propertyValue = result.value;
  } else if (housingStatus === "rent") {
    const result = money(raw.monthlyRent, "your monthly rent", { positive: true });
    if ("error" in result) errors.monthlyRent = result.error;
    else monthlyRent = result.value;
  }

  const city = text(raw.city);
  if (city.length > LIMITS.maxCityLength)
    errors.city = `City must be ${LIMITS.maxCityLength} characters or fewer.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      currentAge: currentAge!,
      targetRetirementAge: targetRetirementAge!,
      monthlyIncome: (income as { value: number }).value,
      monthlyExpenses: (expenses as { value: number }).value,
      housingStatus: housingStatus as FinancialProfileInput["housingStatus"],
      propertyValue,
      monthlyRent,
      city: city || null,
    },
  };
}

export type AssetField = "name" | "category" | "institution" | "balance";

export function validateAssetAccount(raw: RawInput): ValidationResult<AssetAccountInput, AssetField> {
  const errors: FieldErrors<AssetField> = {};

  const category = text(raw.category);
  if (!isAssetCategory(category)) errors.category = "Choose the type of asset.";

  const name = text(raw.name);
  if (!name) errors.name = "Give this record a name, e.g. “BCA savings”.";
  else if (name.length > LIMITS.maxNameLength)
    errors.name = `Name must be ${LIMITS.maxNameLength} characters or fewer.`;

  const institution = text(raw.institution);
  if (institution.length > LIMITS.maxNameLength)
    errors.institution = `Institution must be ${LIMITS.maxNameLength} characters or fewer.`;

  const balance = money(raw.balance, "the current balance");
  if ("error" in balance) errors.balance = balance.error;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      name,
      category: category as AssetAccountInput["category"],
      institution: institution || null,
      balance: (balance as { value: number }).value,
    },
  };
}
