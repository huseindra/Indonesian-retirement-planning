import { getDb, type Database } from "../db/client";

export interface FinancialProfile {
  userId: number;
  /** ISO date, YYYY-MM-DD. */
  dateOfBirth: string;
  targetRetirementAge: number;
  city: string;
  /** Whole Rupiah. */
  monthlyIncome: number;
  /** Whole Rupiah. */
  monthlyExpenses: number;
  updatedAt: string;
}

interface FinancialProfileRow {
  user_id: number;
  date_of_birth: string;
  target_retirement_age: number;
  city: string;
  monthly_income: number;
  monthly_expenses: number;
  updated_at: string;
}

export function findFinancialProfileByUserId(
  userId: number,
  db: Database = getDb(),
): FinancialProfile | null {
  const row = db
    .prepare(
      `SELECT user_id, date_of_birth, target_retirement_age, city,
              monthly_income, monthly_expenses, updated_at
         FROM financial_profiles
        WHERE user_id = ?`,
    )
    .get(userId) as FinancialProfileRow | undefined;

  if (!row) return null;
  return {
    userId: row.user_id,
    dateOfBirth: row.date_of_birth,
    targetRetirementAge: row.target_retirement_age,
    city: row.city,
    monthlyIncome: row.monthly_income,
    monthlyExpenses: row.monthly_expenses,
    updatedAt: row.updated_at,
  };
}
