import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../db/client";
import { DEMO_USERNAME } from "../db/seed";
import { findUserByUsername } from "../repositories/users";
import { getDashboardSummary } from "./dashboard";
import { deleteFinancialData, saveFinancialProfile } from "./financial-profile";

describe("getDashboardSummary", () => {
  let db: Database;
  let userId: number;

  beforeEach(() => {
    db = openDatabase(":memory:");
    userId = findUserByUsername(DEMO_USERNAME, db)!.id;
  });

  afterEach(() => {
    db.close();
  });

  it("uses the persisted profile for ages and years to retirement", () => {
    expect(getDashboardSummary(userId, db).profile).toMatchObject({
      currentAge: 35,
      targetRetirementAge: 58,
      yearsToRetirement: 23,
      housingStatus: "rent",
      monthlyRent: 4_500_000,
    });
  });

  it("splits savings from pension assets", () => {
    const { savings } = getDashboardSummary(userId, db);
    expect(savings.currentSavings).toBe(469_750_000);
    expect(savings.pensionAssets).toBe(137_300_000);
    expect(savings.accountCount).toBe(7);
  });

  it("reflects profile edits immediately", () => {
    saveFinancialProfile(
      userId,
      {
        currentAge: "40",
        targetRetirementAge: "60",
        monthlyIncome: "30000000",
        monthlyExpenses: "12000000",
        housingStatus: "family",
      },
      db,
    );
    expect(getDashboardSummary(userId, db).profile).toMatchObject({
      currentAge: 40,
      yearsToRetirement: 20,
      monthlyRent: null,
    });
  });

  it("leaves the estimated retirement fund uncalculated", () => {
    expect(getDashboardSummary(userId, db).estimatedRetirementFund).toBeNull();
  });

  it("returns an empty summary once the profile is deleted", () => {
    deleteFinancialData(userId, db);
    const summary = getDashboardSummary(userId, db);
    expect(summary.profile).toBeNull();
    expect(summary.savings).toMatchObject({ currentSavings: 0, pensionAssets: 0, accountCount: 0 });
  });
});
