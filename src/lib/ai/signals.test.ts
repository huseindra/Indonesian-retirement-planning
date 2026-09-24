import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../db/client";
import { DEMO_USERNAME } from "../db/seed";
import { findUserByUsername } from "../repositories/users";
import { deleteFinancialData, saveFinancialProfile } from "../services/financial-profile";
import { computeFinancialSignals, type ScenarioComparisonSignal } from "./signals";

// Expected values computed independently with Python's decimal module
// (60-digit precision, round-half-up) from the same formulas as
// src/lib/projection/retirement.ts.

function byKind<K extends string>(signals: { kind: string }[], kind: K) {
  return signals.find((s) => s.kind === kind);
}

describe("computeFinancialSignals", () => {
  let db: Database;
  let demoId: number;

  beforeEach(() => {
    db = openDatabase(":memory:");
    demoId = findUserByUsername(DEMO_USERNAME, db)!.id;
  });

  afterEach(() => {
    db.close();
  });

  it("is incomplete without a financial profile", () => {
    deleteFinancialData(demoId, db);
    expect(computeFinancialSignals(demoId, db)).toEqual({ status: "incomplete" });
  });

  it("reports the current funding gap straight from the engine result", () => {
    const result = computeFinancialSignals(demoId, db);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(byKind(result.signals, "funding_gap")).toEqual({
      kind: "funding_gap",
      hasShortfall: true,
      gap: -1_192_807_450,
      fundedRatio: result.baseline.fundedRatio,
      requiredFund: 4_070_546_103,
      retirementAssets: 2_877_738_653,
      monthlySavingToCloseGap: 1_860_176,
      fundsRunOutAtAge: 73,
      planUntilAge: 85,
    });
  });

  it("computes inflation sensitivity by re-running the engine ±1 point", () => {
    const result = computeFinancialSignals(demoId, db);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(byKind(result.signals, "inflation_sensitivity")).toEqual({
      kind: "inflation_sensitivity",
      baseInflationBps: 300,
      deltaBps: 100,
      baseGap: -1_192_807_450,
      higherInflationGap: -2_776_288_403,
      lowerInflationGap: -59_388_338,
      gapSwingPerPoint: 1_358_450_033,
    });
  });

  it("computes the effect of delaying retirement by the disclosed number of years", () => {
    const result = computeFinancialSignals(demoId, db);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(byKind(result.signals, "delay_retirement")).toEqual({
      kind: "delay_retirement",
      delayYears: 2,
      currentRetirementAge: 58,
      delayedRetirementAge: 60,
      baseGap: -1_192_807_450,
      delayedGap: -833_487_350,
      gapImprovement: 359_320_100,
    });
  });

  it("surfaces the saving that would close the gap, already computed by the engine", () => {
    const result = computeFinancialSignals(demoId, db);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(byKind(result.signals, "increase_savings")).toEqual({
      kind: "increase_savings",
      baseGap: -1_192_807_450,
      monthlySavingToCloseGap: 1_860_176,
      yearsToRetirement: 23,
    });
  });

  it("omits the increase_savings signal once there is a surplus", () => {
    saveFinancialProfile(
      demoId,
      { currentAge: "40", targetRetirementAge: "55", monthlyIncome: "5000000", monthlyExpenses: "1000000", housingStatus: "family" },
      db,
    );
    const result = computeFinancialSignals(demoId, db);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(byKind(result.signals, "funding_gap")).toMatchObject({ hasShortfall: false });
    expect(byKind(result.signals, "increase_savings")).toBeUndefined();
  });

  it("simulates the seeded target property purchase against the baseline", () => {
    const result = computeFinancialSignals(demoId, db);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(byKind(result.signals, "property_purchase")).toEqual({
      kind: "property_purchase",
      propertyName: "3-bedroom landed house in Tangerang Selatan",
      purchasePrice: 1_500_000_000,
      purchaseAge: 40,
      baseGap: -1_192_807_450,
      gapWithPurchase: -4_070_546_103,
      gapImpact: -2_877_738_653,
      unfundedAmount: 1_063_003_316,
      skippedReason: null,
    });
  });

  it("explains rather than crashes when the property purchase age is outside working years", () => {
    saveFinancialProfile(
      demoId,
      { currentAge: "45", targetRetirementAge: "50", monthlyIncome: "1", monthlyExpenses: "1", housingStatus: "family" },
      db,
    );
    const result = computeFinancialSignals(demoId, db);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const signal = byKind(result.signals, "property_purchase");
    expect(signal).toMatchObject({ gapImpact: 0, skippedReason: expect.stringMatching(/outside your working years/) });
  });

  it("compares seeded scenarios and picks the most different from the baseline", () => {
    const result = computeFinancialSignals(demoId, db);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const signal = byKind(result.signals, "scenario_comparison") as ScenarioComparisonSignal;
    expect(signal.baselineGap).toBe(-1_192_807_450);
    expect(signal.scenarios.map((s) => s.name)).toEqual(["Base", "Conservative", "Optimistic", "Base + buy the target home"]);
    const conservative = signal.scenarios.find((s) => s.name === "Conservative")!;
    expect(conservative.gap).toBe(-5_885_340_179);
    expect(signal.mostDifferentScenarioId).toBe(conservative.id);
  });

  it("never mutates the baseline while computing signals", () => {
    const before = db.prepare("SELECT * FROM financial_profiles WHERE user_id = ?").get(demoId);
    computeFinancialSignals(demoId, db);
    const after = db.prepare("SELECT * FROM financial_profiles WHERE user_id = ?").get(demoId);
    expect(after).toEqual(before);
  });
});
