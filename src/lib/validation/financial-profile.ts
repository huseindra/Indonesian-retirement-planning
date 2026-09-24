import {
  HOUSING_STATUS_LABELS,
  LIMITS,
  isAssetCategory,
  isHousingStatus,
} from "../domain/financial-profile";
import { money, text, wholeNumber, type FieldErrors, type RawInput, type ValidationResult } from "./common";

export { parseRupiah, type FieldErrors, type RawInput, type ValidationResult } from "./common";
import type { AssetAccountInput } from "../repositories/asset-accounts";
import type { FinancialProfileInput } from "../repositories/financial-profiles";

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
