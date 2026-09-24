import { afterEach, beforeEach, describe, expect, it } from "vitest";
import BetterSqlite3 from "better-sqlite3";
import { openDatabase, type Database } from "../db/client";
import { migrations, runMigrations } from "../db/migrations";
import { DEMO_USERNAME } from "../db/seed";
import { DEFAULT_ASSUMPTIONS } from "../domain/assumptions";
import { findUserByUsername } from "../repositories/users";
import {
  getAssumptions,
  getCostProjectionOverview,
  getTargetProperty,
  removeTargetProperty,
  resetAssumptions,
  saveAssumptions,
  saveTargetProperty,
} from "./cost-projection";
import { deleteFinancialData, saveFinancialProfile } from "./financial-profile";

describe("cost projection service", () => {
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

  it("uses the defaults until a user saves their own assumptions", () => {
    expect(getAssumptions(newUserId, db)).toEqual({ values: DEFAULT_ASSUMPTIONS, isDefault: true, updatedAt: null });

    expect(saveAssumptions(newUserId, { inflationBps: "4", housingGrowthBps: "6", investmentReturnBps: "8" }, db)).toEqual({
      ok: true,
    });
    const saved = getAssumptions(newUserId, db);
    expect(saved.isDefault).toBe(false);
    expect(saved.values).toEqual({ inflationBps: 400, housingGrowthBps: 600, investmentReturnBps: 800 });

    resetAssumptions(newUserId, db);
    expect(getAssumptions(newUserId, db).isDefault).toBe(true);
  });

  it("rejects invalid assumptions without saving", () => {
    const result = saveAssumptions(newUserId, { inflationBps: "50", housingGrowthBps: "5", investmentReturnBps: "7" }, db);
    expect(result.ok).toBe(false);
    expect(getAssumptions(newUserId, db).isDefault).toBe(true);
  });

  it("projects the demo user's living costs from the persisted profile and assumptions", () => {
    const { livingCost, assumptions } = getCostProjectionOverview(demoId, db);
    expect(assumptions.isDefault).toBe(false);
    expect(livingCost).toMatchObject({
      years: 23,
      current: { monthly: 10_000_000, annual: 120_000_000 },
      atRetirement: { monthly: 19_735_865, annual: 236_830_380 },
    });
  });

  it("projects the demo target property with the housing-growth assumption", () => {
    const { property } = getCostProjectionOverview(demoId, db);
    expect(property).toMatchObject({ growthSource: "assumption", growthBps: 500 });
    expect(property!.projection).toMatchObject({ years: 5, futurePrice: 1_914_422_344 });
  });

  it("uses a property-specific growth rate when set", () => {
    saveTargetProperty(demoId, { name: "Apartment", currentPrice: "800000000", purchaseAge: "45", growthBps: "2" }, db);
    saveAssumptions(demoId, { inflationBps: "4", housingGrowthBps: "9", investmentReturnBps: "7" }, db);
    const { property } = getCostProjectionOverview(demoId, db);
    expect(property).toMatchObject({ growthSource: "property", growthBps: 200 });
    expect(property!.projection).toMatchObject({ futurePrice: 975_195_536, futurePriceInTodaysMoney: 658_807_162 });
  });

  it("recalculates when assumptions change", () => {
    saveAssumptions(demoId, { inflationBps: "0", housingGrowthBps: "0", investmentReturnBps: "7" }, db);
    const { livingCost, property } = getCostProjectionOverview(demoId, db);
    expect(livingCost!.atRetirement.monthly).toBe(10_000_000);
    expect(property!.projection!.futurePrice).toBe(1_500_000_000);
  });

  it("requires a profile before a target property can be saved", () => {
    const result = saveTargetProperty(newUserId, { name: "House", currentPrice: "1000000000", purchaseAge: "40" }, db);
    expect(result).toEqual({ ok: false, formError: expect.stringMatching(/financial profile/) });
  });

  it("validates the purchase age against the profile's current age", () => {
    const result = saveTargetProperty(demoId, { name: "House", currentPrice: "1000000000", purchaseAge: "30" }, db);
    expect(result.ok === false && result.errors?.purchaseAge).toMatch(/current age \(35\)/);
  });

  it("does not project a purchase age that is now in the past", () => {
    saveFinancialProfile(
      demoId,
      { currentAge: "45", targetRetirementAge: "60", monthlyIncome: "1", monthlyExpenses: "1", housingStatus: "family" },
      db,
    );
    const { property } = getCostProjectionOverview(demoId, db);
    expect(property?.projection).toBeNull();
  });

  it("returns no living-cost projection without a profile", () => {
    deleteFinancialData(demoId, db);
    const overview = getCostProjectionOverview(demoId, db);
    expect(overview.profile).toBeNull();
    expect(overview.livingCost).toBeNull();
    expect(overview.property?.projection).toBeNull();
  });

  it("deletes the target property", () => {
    expect(removeTargetProperty(demoId, db)).toEqual({ ok: true });
    expect(getTargetProperty(demoId, db)).toBeNull();
    expect(removeTargetProperty(demoId, db).ok).toBe(false);
  });

  it("enforces rate ranges in the schema", () => {
    expect(() =>
      db
        .prepare("UPDATE economic_assumptions SET inflation_bps = 5000 WHERE user_id = ?")
        .run(demoId),
    ).toThrow(/CHECK constraint/);
  });
});

describe("migration 3", () => {
  it("adds the new tables to a Stage 2 database without touching existing data", () => {
    const db = new BetterSqlite3(":memory:");
    db.pragma("foreign_keys = ON");
    runMigrations(db, migrations.filter((m) => m.id <= 2));
    db.prepare("INSERT INTO users (username, password_hash, full_name) VALUES ('old', 'x', 'Old')").run();

    runMigrations(db);

    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
      (t) => t.name,
    );
    expect(tables).toEqual(expect.arrayContaining(["economic_assumptions", "target_properties", "users"]));
    expect(db.prepare("SELECT COUNT(*) AS n FROM users").get()).toEqual({ n: 1 });
    db.close();
  });
});
