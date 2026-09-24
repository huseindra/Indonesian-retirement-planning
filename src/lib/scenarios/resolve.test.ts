import { describe, expect, it } from "vitest";
import { NO_OVERRIDES } from "../domain/scenarios";
import type { RetirementInput } from "../projection/retirement";
import { resolveScenario, type ScenarioBaseline } from "./resolve";

const input: RetirementInput = {
  currentAge: 35,
  retirementAge: 58,
  planUntilAge: 85,
  monthlyLivingCost: 10_000_000,
  assets: { cashAndSavings: 235_000_000, investments: 234_750_000, jht: 92_300_000, otherPension: 45_000_000 },
  inflationBps: 300,
  investmentReturnBps: 700,
};

const baseline: ScenarioBaseline = {
  input,
  housingGrowthBps: 500,
  targetProperty: { name: "House", currentPrice: 1_500_000_000, purchaseAge: 40, growthBps: null },
};

describe("resolveScenario", () => {
  it("returns the baseline input unchanged when nothing is overridden", () => {
    const r = resolveScenario(baseline, NO_OVERRIDES);
    expect(r.input).toEqual({ ...input, propertyPurchase: null });
    expect(Object.values(r.values).every((v) => v.source === "baseline")).toBe(true);
    expect(r.values.retirementYears).toEqual({ value: 27, baseline: 27, source: "baseline" });
  });

  it("substitutes overrides and marks their source", () => {
    const r = resolveScenario(baseline, {
      ...NO_OVERRIDES,
      retirementAge: 55,
      monthlySpending: 8_000_000,
      inflationBps: 400,
      investmentReturnBps: 500,
    });
    expect(r.input).toMatchObject({
      retirementAge: 55,
      monthlyLivingCost: 8_000_000,
      inflationBps: 400,
      investmentReturnBps: 500,
      planUntilAge: 85, // plan-until age is kept when no duration is set
    });
    expect(r.values.retirementAge).toEqual({ value: 55, baseline: 58, source: "scenario" });
    expect(r.values.retirementYears).toEqual({ value: 30, baseline: 27, source: "baseline" });
  });

  it("derives the plan-until age from an explicit duration", () => {
    const r = resolveScenario(baseline, { ...NO_OVERRIDES, retirementAge: 60, retirementYears: 30 });
    expect(r.input.planUntilAge).toBe(90);
    expect(r.values.planUntilAge.source).toBe("scenario");
  });

  it("never shares or mutates the baseline input", () => {
    const snapshot = structuredClone(baseline);
    const r = resolveScenario(baseline, { ...NO_OVERRIDES, retirementAge: 50, includeProperty: true });
    r.input.assets.jht = 0;
    expect(baseline).toEqual(snapshot);
  });

  it("uses the target property, falling back to the housing-growth assumption", () => {
    const r = resolveScenario(baseline, { ...NO_OVERRIDES, includeProperty: true });
    expect(r.input.propertyPurchase).toEqual({ currentPrice: 1_500_000_000, purchaseAge: 40, growthBps: 500 });
    expect(r.property!.growthBps.source).toBe("baseline");
  });

  it("lets property fields be overridden individually", () => {
    const r = resolveScenario(baseline, { ...NO_OVERRIDES, includeProperty: true, propertyPurchaseAge: 45, propertyGrowthBps: 200 });
    expect(r.input.propertyPurchase).toEqual({ currentPrice: 1_500_000_000, purchaseAge: 45, growthBps: 200 });
    expect(r.property!.purchaseAge).toEqual({ value: 45, baseline: 40, source: "scenario" });
  });

  it("reports a configuration error when a property has no price or age anywhere", () => {
    const noTarget = { ...baseline, targetProperty: null };
    expect(resolveScenario(noTarget, { ...NO_OVERRIDES, includeProperty: true }).configurationError).toMatch(/no price/);
    expect(
      resolveScenario(noTarget, { ...NO_OVERRIDES, includeProperty: true, propertyPrice: 500_000_000 }).configurationError,
    ).toMatch(/no purchase age/);
    const complete = resolveScenario(noTarget, {
      ...NO_OVERRIDES,
      includeProperty: true,
      propertyPrice: 500_000_000,
      propertyPurchaseAge: 45,
    });
    expect(complete.configurationError).toBeNull();
    expect(complete.input.propertyPurchase).toEqual({ currentPrice: 500_000_000, purchaseAge: 45, growthBps: 500 });
  });
});
