import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../db/client";
import { DEMO_USERNAME } from "../db/seed";
import { listScenariosByUserId } from "../repositories/scenarios";
import { findUserByUsername } from "../repositories/users";
import { getRetirementPlan } from "./retirement-plan";
import {
  addExampleScenarios,
  applyScenarioToBaseline,
  compareScenarios,
  createScenario,
  deleteScenario,
  duplicateScenario,
  getScenarioDetail,
  updateScenario,
} from "./scenarios";

// Expected values computed independently with Python's decimal module.

/** Every baseline table a scenario must never touch. */
function baselineSnapshot(db: Database, userId: number) {
  const tables = ["financial_profiles", "asset_accounts", "economic_assumptions", "retirement_settings", "target_properties"];
  return Object.fromEntries(
    tables.map((t) => [t, db.prepare(`SELECT * FROM ${t} WHERE user_id = ? ORDER BY rowid`).all(userId)]),
  );
}

describe("scenario service", () => {
  let db: Database;
  let demoId: number;
  let newUserId: number;

  beforeEach(() => {
    db = openDatabase(":memory:");
    demoId = findUserByUsername(DEMO_USERNAME, db)!.id;
    newUserId = Number(
      db.prepare("INSERT INTO users (username, password_hash, full_name) VALUES ('new', 'x', 'New')").run()
        .lastInsertRowid,
    );
  });

  afterEach(() => {
    db.close();
  });

  const byName = (userId: number) =>
    Object.fromEntries(
      (() => {
        const c = compareScenarios(userId, db);
        return c.status === "ready" ? c.scenarios.map((s) => [s.scenario.name, s]) : [];
      })(),
    );

  it("seeds the demo user with example scenarios", () => {
    expect(listScenariosByUserId(demoId, db).map((s) => s.name)).toEqual([
      "Base",
      "Conservative",
      "Optimistic",
      "Base + buy the target home",
    ]);
  });

  it("computes every scenario with the Stage 4 engine", () => {
    const s = byName(demoId);
    const result = (name: string) => (s[name].outcome.status === "ready" ? s[name].outcome.result : null);

    // Base equals the Retirement Plan exactly.
    const plan = getRetirementPlan(demoId, db);
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;
    const base = result("Base")!;
    // Identical results; the only difference is an explicit "no property" in the input.
    expect({ ...base, input: { ...base.input, propertyPurchase: undefined } }).toEqual({
      ...plan.result,
      input: { ...plan.result.input, propertyPurchase: undefined },
    });

    expect(result("Conservative")).toMatchObject({
      annualCostAtRetirement: 295_765_860,
      requiredFund: 7_749_908_675,
      retirementAssets: 1_864_568_496,
      gap: -5_885_340_179,
    });
    expect(result("Optimistic")).toMatchObject({
      requiredFund: 3_004_972_070,
      retirementAssets: 3_963_769_957,
      gap: 958_797_887,
      status: "surplus",
    });
    expect(result("Base + buy the target home")).toMatchObject({ retirementAssets: 0, gap: -4_070_546_103 });
    expect(result("Base + buy the target home")!.property).toMatchObject({ unfundedAmount: 1_063_003_316 });
  });

  it("creates, edits, duplicates and deletes a scenario", () => {
    const created = createScenario(demoId, { name: "Retire at 55", retirementAge: "55" }, db);
    expect(created.ok).toBe(true);
    const id = created.id!;
    const detail = getScenarioDetail(demoId, id, db);
    expect(detail.status === "ready" && detail.outcome.status === "ready" && detail.outcome.result.gap).toBe(-1_599_882_518);

    expect(updateScenario(demoId, id, { name: "Retire at 55", retirementAge: "55", monthlySpending: "8.000.000" }, db)).toEqual({ ok: true });

    const copy = duplicateScenario(demoId, id, db);
    const again = duplicateScenario(demoId, id, db);
    const names = listScenariosByUserId(demoId, db).map((s) => s.name);
    expect(names).toContain("Copy of Retire at 55");
    expect(names).toContain("Copy of Retire at 55 (2)");
    const copyDetail = getScenarioDetail(demoId, copy.id!, db);
    expect(copyDetail.status === "ready" && copyDetail.scenario.monthlySpending).toBe(8_000_000);

    expect(deleteScenario(demoId, again.id!, db)).toEqual({ ok: true });
    expect(deleteScenario(demoId, again.id!, db).ok).toBe(false);
    expect(getScenarioDetail(demoId, again.id!, db).status).toBe("not-found");
  });

  it("validates scenarios", () => {
    expect(createScenario(demoId, { name: "" }, db)).toMatchObject({ ok: false, errors: { name: expect.any(String) } });
    expect(createScenario(demoId, { name: "Base" }, db)).toMatchObject({
      ok: false,
      errors: { name: "You already have a scenario with this name." },
    });
    const bad = createScenario(
      demoId,
      { name: "Bad", retirementAge: "30", inflationBps: "40", retirementYears: "0", includeProperty: "on", propertyPurchaseAge: "20" },
      db,
    );
    expect(bad).toMatchObject({
      ok: false,
      errors: {
        retirementAge: expect.stringMatching(/current age \(35\)/),
        inflationBps: expect.stringMatching(/between 0% and 30%/),
        retirementYears: expect.any(String),
        propertyPurchaseAge: expect.stringMatching(/current age \(35\)/),
      },
    });
    expect(createScenario(newUserId, { name: "Needs profile" }, db)).toMatchObject({
      ok: false,
      formError: expect.stringMatching(/financial profile/),
    });
  });

  it("reports inconsistent scenarios as calculation errors, not crashes", () => {
    // Property purchase after the scenario's retirement age.
    createScenario(demoId, { name: "Late home", retirementAge: "45", includeProperty: "on", propertyPurchaseAge: "50" }, db);
    const s = byName(demoId);
    expect(s["Late home"].outcome).toMatchObject({ status: "error", message: expect.stringMatching(/purchase age \(50\)/) });
    expect(s.Base.outcome.status).toBe("ready");
  });

  it("never changes the baseline while scenarios are created, edited, duplicated, deleted or compared", () => {
    const before = baselineSnapshot(db, demoId);
    const { id } = createScenario(demoId, { name: "Experiment", retirementAge: "50", inflationBps: "9", investmentReturnBps: "2", retirementYears: "40", monthlySpending: "1", includeProperty: "on", propertyPrice: "5000000000" }, db);
    updateScenario(demoId, id!, { name: "Experiment 2", retirementAge: "65", investmentReturnBps: "12" }, db);
    duplicateScenario(demoId, id!, db);
    compareScenarios(demoId, db);
    getScenarioDetail(demoId, id!, db);
    deleteScenario(demoId, id!, db);
    expect(baselineSnapshot(db, demoId)).toEqual(before);
  });

  it("scopes scenarios to their owner", () => {
    const demoScenario = listScenariosByUserId(demoId, db)[0];
    expect(getScenarioDetail(newUserId, demoScenario.id, db).status).toBe("not-found");
    expect(updateScenario(newUserId, demoScenario.id, { name: "Hijack" }, db).ok).toBe(false);
    expect(deleteScenario(newUserId, demoScenario.id, db).ok).toBe(false);
    expect(duplicateScenario(newUserId, demoScenario.id, db).ok).toBe(false);
    expect(applyScenarioToBaseline(newUserId, demoScenario.id, ["inflationBps"], db).ok).toBe(false);
  });

  it("adds the example scenarios without duplicating existing names", () => {
    expect(addExampleScenarios(newUserId, db)).toBe(3);
    expect(addExampleScenarios(newUserId, db)).toBe(0);
    expect(compareScenarios(newUserId, db).status).toBe("incomplete");
  });

  it("applies only the explicitly selected assumptions to the baseline", () => {
    const { id } = createScenario(
      demoId,
      { name: "Apply me", retirementAge: "60", monthlySpending: "12000000", inflationBps: "4", investmentReturnBps: "6", retirementYears: "30" },
      db,
    );
    const before = baselineSnapshot(db, demoId);

    // Only inflation: nothing else changes.
    expect(applyScenarioToBaseline(demoId, id!, ["inflationBps"], db)).toEqual({ ok: true, applied: ["inflationBps"] });
    const after = baselineSnapshot(db, demoId);
    expect(after.financial_profiles).toEqual(before.financial_profiles);
    expect(after.retirement_settings).toEqual(before.retirement_settings);
    expect(after.asset_accounts).toEqual(before.asset_accounts);
    expect(after.economic_assumptions[0]).toMatchObject({ inflation_bps: 400, investment_return_bps: 700, housing_growth_bps: 500 });

    // Retirement age with duration: plan-until becomes 60 + 30.
    applyScenarioToBaseline(demoId, id!, ["retirementAge", "retirementYears", "monthlySpending"], db);
    const plan = getRetirementPlan(demoId, db);
    expect(plan.status === "ready" && plan.result.input).toMatchObject({
      retirementAge: 60,
      planUntilAge: 90,
      monthlyLivingCost: 12_000_000,
      inflationBps: 400,
      investmentReturnBps: 700,
    });
  });

  it("refuses to apply nothing, or fields the scenario does not override", () => {
    const base = listScenariosByUserId(demoId, db).find((s) => s.name === "Base")!;
    expect(applyScenarioToBaseline(demoId, base.id, ["inflationBps"], db)).toMatchObject({
      ok: false,
      formError: expect.stringMatching(/at least one/),
    });
  });
});
