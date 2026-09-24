import { describe, expect, it } from "vitest";
import { simulateRetirement, type RetirementInput } from "../projection/retirement";
import { alignTrajectories, assetTrajectory } from "./trajectory";

const input: RetirementInput = {
  currentAge: 35,
  retirementAge: 58,
  planUntilAge: 85,
  monthlyLivingCost: 10_000_000,
  assets: { cashAndSavings: 607_050_000, investments: 0, jht: 0, otherPension: 0 },
  inflationBps: 300,
  investmentReturnBps: 700,
};

describe("trajectories", () => {
  it("joins accumulation and drawdown without new calculations", () => {
    const result = simulateRetirement(input);
    const path = assetTrajectory(result);
    expect(path[0]).toEqual({ age: 35, balance: 607_050_000 });
    expect(path.find((p) => p.age === 58)!.balance).toBe(result.retirementAssets);
    expect(path.find((p) => p.age === 59)!.balance).toBe(result.drawdown[0].endBalance);
    expect(path.at(-1)!.age).toBe(85);
  });

  it("aligns plans of different lengths on one axis", () => {
    const short = simulateRetirement(input);
    const long = simulateRetirement({ ...input, planUntilAge: 90 });
    const { ages, series } = alignTrajectories([short, long]);
    expect(ages[0]).toBe(35);
    expect(ages.at(-1)).toBe(90);
    expect(series[0].at(-1)).toBeNull();
    expect(series[1].at(-1)).not.toBeNull();
    expect(alignTrajectories([])).toEqual({ ages: [], series: [] });
  });
});
