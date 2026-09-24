import BetterSqlite3 from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../db/client";
import { migrations, runMigrations } from "../db/migrations";
import { DEMO_USERNAME } from "../db/seed";
import { findUserByUsername } from "../repositories/users";
import { saveAssumptions } from "./cost-projection";
import { deleteFinancialData, saveFinancialProfile } from "./financial-profile";
import { getRetirementPlan, getRetirementSettings, saveRetirementSettings } from "./retirement-plan";

describe("retirement plan service", () => {
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

  it("runs the simulation from all persisted inputs", () => {
    const plan = getRetirementPlan(demoId, db);
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;

    expect(plan.result.input).toEqual({
      currentAge: 35,
      retirementAge: 58,
      planUntilAge: 85,
      monthlyLivingCost: 10_000_000,
      assets: { cashAndSavings: 235_000_000, investments: 234_750_000, jht: 92_300_000, otherPension: 45_000_000 },
      inflationBps: 300,
      investmentReturnBps: 700,
    });
    expect(plan.result.requiredFund).toBe(4_070_546_103);
    expect(plan.hasAssets).toBe(true);
    expect(plan.settings).toEqual({ planUntilAge: 85, isDefault: false });
  });

  it("recalculates when assumptions, profile or settings change", () => {
    const before = getRetirementPlan(demoId, db);
    saveAssumptions(demoId, { inflationBps: "3", housingGrowthBps: "5", investmentReturnBps: "9" }, db);
    const higherReturn = getRetirementPlan(demoId, db);
    expect(before.status === "ready" && higherReturn.status === "ready").toBe(true);
    if (before.status !== "ready" || higherReturn.status !== "ready") return;
    expect(higherReturn.result.projectedAssets.total).toBeGreaterThan(before.result.projectedAssets.total);
    expect(higherReturn.result.requiredFund).toBeLessThan(before.result.requiredFund);

    saveRetirementSettings(demoId, { planUntilAge: "95" }, db);
    const longer = getRetirementPlan(demoId, db);
    expect(longer.status === "ready" && longer.result.retirementYears).toBe(37);
  });

  it("uses the default plan-until age when none is saved", () => {
    expect(getRetirementSettings(newUserId, db)).toEqual({ planUntilAge: 85, isDefault: true });
  });

  it("is incomplete without a financial profile", () => {
    expect(getRetirementPlan(newUserId, db)).toMatchObject({ status: "incomplete", missing: "profile" });
    deleteFinancialData(demoId, db);
    expect(getRetirementPlan(demoId, db).status).toBe("incomplete");
  });

  it("flags a profile without assets", () => {
    saveFinancialProfile(
      newUserId,
      { currentAge: "30", targetRetirementAge: "55", monthlyIncome: "10000000", monthlyExpenses: "5000000", housingStatus: "family" },
      db,
    );
    const plan = getRetirementPlan(newUserId, db);
    expect(plan.status === "ready" && plan.hasAssets).toBe(false);
    expect(plan.status === "ready" && plan.result.status).toBe("shortfall");
  });

  it("returns a calculation error when the plan-until age is no longer after retirement", () => {
    saveFinancialProfile(
      demoId,
      { currentAge: "35", targetRetirementAge: "90", monthlyIncome: "1", monthlyExpenses: "1", housingStatus: "family" },
      db,
    );
    const plan = getRetirementPlan(demoId, db);
    expect(plan).toMatchObject({ status: "error", field: "planUntilAge" });
    expect(plan.status === "error" && plan.message).toMatch(/plan-until age \(85\)/);
  });

  it("validates the plan-until age against the retirement age", () => {
    expect(saveRetirementSettings(demoId, { planUntilAge: "58" }, db)).toEqual({
      ok: false,
      errors: { planUntilAge: "Must be later than your target retirement age (58)." },
    });
    expect(saveRetirementSettings(demoId, { planUntilAge: "130" }, db).ok).toBe(false);
    expect(saveRetirementSettings(demoId, { planUntilAge: "abc" }, db).ok).toBe(false);
    expect(saveRetirementSettings(demoId, { planUntilAge: "" }, db).ok).toBe(false);
    expect(saveRetirementSettings(demoId, { planUntilAge: "90" }, db)).toEqual({ ok: true });
    expect(getRetirementSettings(demoId, db)).toEqual({ planUntilAge: 90, isDefault: false });
  });
});

describe("migration 4", () => {
  it("adds retirement_settings to a Stage 3 database", () => {
    const db = new BetterSqlite3(":memory:");
    db.pragma("foreign_keys = ON");
    runMigrations(db, migrations.filter((m) => m.id <= 3));
    runMigrations(db);
    const table = db.prepare("SELECT name FROM sqlite_master WHERE name = 'retirement_settings'").get();
    expect(table).toEqual({ name: "retirement_settings" });
    db.close();
  });
});
