import { getDb, type Database } from "../db/client";
import type { HousingStatus } from "../domain/financial-profile";

export interface FinancialProfileInput {
  currentAge: number;
  targetRetirementAge: number;
  /** Whole Rupiah. */
  monthlyIncome: number;
  /** Whole Rupiah, excluding rent. */
  monthlyExpenses: number;
  housingStatus: HousingStatus;
  /** Whole Rupiah; only when housingStatus is "own". */
  propertyValue: number | null;
  /** Whole Rupiah; only when housingStatus is "rent". */
  monthlyRent: number | null;
  city: string | null;
}

export interface FinancialProfile extends FinancialProfileInput {
  userId: number;
  createdAt: string;
  updatedAt: string;
}

interface FinancialProfileRow {
  user_id: number;
  current_age: number;
  target_retirement_age: number;
  monthly_income: number;
  monthly_expenses: number;
  housing_status: HousingStatus;
  property_value: number | null;
  monthly_rent: number | null;
  city: string | null;
  created_at: string;
  updated_at: string;
}

export function findFinancialProfileByUserId(
  userId: number,
  db: Database = getDb(),
): FinancialProfile | null {
  const row = db
    .prepare(
      `SELECT user_id, current_age, target_retirement_age, monthly_income, monthly_expenses,
              housing_status, property_value, monthly_rent, city, created_at, updated_at
         FROM financial_profiles
        WHERE user_id = ?`,
    )
    .get(userId) as FinancialProfileRow | undefined;

  if (!row) return null;
  return {
    userId: row.user_id,
    currentAge: row.current_age,
    targetRetirementAge: row.target_retirement_age,
    monthlyIncome: row.monthly_income,
    monthlyExpenses: row.monthly_expenses,
    housingStatus: row.housing_status,
    propertyValue: row.property_value,
    monthlyRent: row.monthly_rent,
    city: row.city,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Creates the profile, or replaces every field of an existing one. */
export function upsertFinancialProfile(
  userId: number,
  input: FinancialProfileInput,
  db: Database = getDb(),
): void {
  db.prepare(
    `INSERT INTO financial_profiles
       (user_id, current_age, target_retirement_age, monthly_income, monthly_expenses,
        housing_status, property_value, monthly_rent, city)
     VALUES (@userId, @currentAge, @targetRetirementAge, @monthlyIncome, @monthlyExpenses,
             @housingStatus, @propertyValue, @monthlyRent, @city)
     ON CONFLICT (user_id) DO UPDATE SET
       current_age           = excluded.current_age,
       target_retirement_age = excluded.target_retirement_age,
       monthly_income        = excluded.monthly_income,
       monthly_expenses      = excluded.monthly_expenses,
       housing_status        = excluded.housing_status,
       property_value        = excluded.property_value,
       monthly_rent          = excluded.monthly_rent,
       city                  = excluded.city,
       updated_at            = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  ).run({ userId, ...input });
}

/** Returns true when a profile was deleted. */
export function deleteFinancialProfile(userId: number, db: Database = getDb()): boolean {
  return db.prepare("DELETE FROM financial_profiles WHERE user_id = ?").run(userId).changes > 0;
}
