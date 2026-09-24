import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../db/client";
import { DEMO_USERNAME } from "../db/seed";
import { findUserByUsername } from "../repositories/users";
import { getDashboardSummary } from "./dashboard";

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

  it("derives age and years to retirement from the stored profile", () => {
    const summary = getDashboardSummary(userId, new Date(2026, 8, 24), db);
    expect(summary.profile).toMatchObject({
      currentAge: 35,
      targetRetirementAge: 58,
      yearsToRetirement: 23,
    });
  });

  it("splits savings from pension assets", () => {
    const summary = getDashboardSummary(userId, new Date(2026, 8, 24), db);
    const total = summary.savings.accounts.reduce((sum, a) => sum + a.balance, 0);

    expect(summary.savings.currentSavings).toBe(469_750_000);
    expect(summary.savings.pensionAssets).toBe(137_300_000);
    expect(summary.savings.currentSavings + summary.savings.pensionAssets).toBe(total);
  });

  it("leaves the estimated retirement fund uncalculated", () => {
    expect(getDashboardSummary(userId, new Date(), db).estimatedRetirementFund).toBeNull();
  });

  it("returns empty data for a user without a profile", () => {
    const summary = getDashboardSummary(9999, new Date(), db);
    expect(summary.profile).toBeNull();
    expect(summary.savings).toEqual({ currentSavings: 0, pensionAssets: 0, accounts: [] });
  });
});
