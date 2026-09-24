import { getDb, type Database } from "../db/client";
import type { ScenarioInput } from "../domain/scenarios";

export interface Scenario extends ScenarioInput {
  id: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

interface ScenarioRow {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  retirement_age: number | null;
  monthly_spending: number | null;
  inflation_bps: number | null;
  investment_return_bps: number | null;
  retirement_years: number | null;
  include_property: number;
  property_price: number | null;
  property_purchase_age: number | null;
  property_growth_bps: number | null;
  created_at: string;
  updated_at: string;
}

function toScenario(row: ScenarioRow): Scenario {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    retirementAge: row.retirement_age,
    monthlySpending: row.monthly_spending,
    inflationBps: row.inflation_bps,
    investmentReturnBps: row.investment_return_bps,
    retirementYears: row.retirement_years,
    includeProperty: row.include_property === 1,
    propertyPrice: row.property_price,
    propertyPurchaseAge: row.property_purchase_age,
    propertyGrowthBps: row.property_growth_bps,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toParams(input: ScenarioInput) {
  return {
    name: input.name,
    description: input.description,
    retirementAge: input.retirementAge,
    monthlySpending: input.monthlySpending,
    inflationBps: input.inflationBps,
    investmentReturnBps: input.investmentReturnBps,
    retirementYears: input.retirementYears,
    includeProperty: input.includeProperty ? 1 : 0,
    propertyPrice: input.propertyPrice,
    propertyPurchaseAge: input.propertyPurchaseAge,
    propertyGrowthBps: input.propertyGrowthBps,
  };
}

export function listScenariosByUserId(userId: number, db: Database = getDb()): Scenario[] {
  const rows = db
    .prepare("SELECT * FROM scenarios WHERE user_id = ? ORDER BY id")
    .all(userId) as ScenarioRow[];
  return rows.map(toScenario);
}

/** Scoped by user so a user can never read another user's scenario. */
export function findScenario(userId: number, id: number, db: Database = getDb()): Scenario | null {
  const row = db.prepare("SELECT * FROM scenarios WHERE id = ? AND user_id = ?").get(id, userId) as
    | ScenarioRow
    | undefined;
  return row ? toScenario(row) : null;
}

export function scenarioNameExists(
  userId: number,
  name: string,
  exceptId: number | null = null,
  db: Database = getDb(),
): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM scenarios WHERE user_id = ? AND name = ? AND id IS NOT ?")
      .get(userId, name, exceptId),
  );
}

export function insertScenario(userId: number, input: ScenarioInput, db: Database = getDb()): number {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO scenarios (user_id, name, description, retirement_age, monthly_spending, inflation_bps,
         investment_return_bps, retirement_years, include_property, property_price,
         property_purchase_age, property_growth_bps)
       VALUES (@userId, @name, @description, @retirementAge, @monthlySpending, @inflationBps,
         @investmentReturnBps, @retirementYears, @includeProperty, @propertyPrice,
         @propertyPurchaseAge, @propertyGrowthBps)`,
    )
    .run({ userId, ...toParams(input) });
  return Number(lastInsertRowid);
}

export function updateScenarioRow(
  userId: number,
  id: number,
  input: ScenarioInput,
  db: Database = getDb(),
): boolean {
  return (
    db
      .prepare(
        `UPDATE scenarios SET name = @name, description = @description, retirement_age = @retirementAge,
           monthly_spending = @monthlySpending, inflation_bps = @inflationBps,
           investment_return_bps = @investmentReturnBps, retirement_years = @retirementYears,
           include_property = @includeProperty, property_price = @propertyPrice,
           property_purchase_age = @propertyPurchaseAge, property_growth_bps = @propertyGrowthBps,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = @id AND user_id = @userId`,
      )
      .run({ id, userId, ...toParams(input) }).changes > 0
  );
}

export function deleteScenarioRow(userId: number, id: number, db: Database = getDb()): boolean {
  return db.prepare("DELETE FROM scenarios WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}
