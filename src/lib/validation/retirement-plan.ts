import { PLAN_UNTIL_LIMITS } from "../domain/assumptions";
import { text, wholeNumber, type RawInput, type ValidationResult } from "./common";

export type RetirementSettingsField = "planUntilAge";

/**
 * Validates the plan-until (life-expectancy) age. When the user has a
 * profile, it must be later than their target retirement age.
 */
export function validateRetirementSettings(
  raw: RawInput,
  retirementAge: number | null,
): ValidationResult<{ planUntilAge: number }, RetirementSettingsField> {
  const value = wholeNumber(raw.planUntilAge);
  let error: string | null = null;

  if (text(raw.planUntilAge) === "") error = "Enter the age your money should last until.";
  else if (value === null) error = "Enter the age as a whole number of years.";
  else if (value < PLAN_UNTIL_LIMITS.min || value > PLAN_UNTIL_LIMITS.max)
    error = `Enter an age between ${PLAN_UNTIL_LIMITS.min} and ${PLAN_UNTIL_LIMITS.max}.`;
  else if (retirementAge !== null && value <= retirementAge)
    error = `Must be later than your target retirement age (${retirementAge}).`;

  return error ? { ok: false, errors: { planUntilAge: error } } : { ok: true, data: { planUntilAge: value! } };
}
