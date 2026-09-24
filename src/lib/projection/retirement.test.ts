import { describe, expect, it } from "vitest";
import {
  RetirementInputError,
  annualSavingFor,
  growingAnnuityFactor,
  simulateRetirement,
  type RetirementInput,
} from "./retirement";

// Expected values were computed independently with Python's decimal module
// (60-digit precision, round-half-up to whole Rupiah) using the formulas
// documented in retirement.ts.

const demo: RetirementInput = {
  currentAge: 35,
  retirementAge: 58,
  planUntilAge: 85,
  monthlyLivingCost: 10_000_000,
  assets: { cashAndSavings: 235_000_000, investments: 234_750_000, jht: 92_300_000, otherPension: 45_000_000 },
  inflationBps: 300,
  investmentReturnBps: 700,
};

describe("simulateRetirement — demo profile", () => {
  const result = simulateRetirement(demo);

  it("derives the time horizon", () => {
    expect(result.yearsToRetirement).toBe(23);
    expect(result.retirementYears).toBe(27);
  });

  it("reuses the living-cost projection for the cost at retirement", () => {
    expect(result.annualCostAtRetirement).toBe(236_830_380);
    expect(result.livingCost.atRetirement.monthly).toBe(19_735_865);
  });

  it("computes the required fund as an inflation-growing annuity", () => {
    expect(result.requiredFundMultiple).toBeCloseTo(17.18760111412395, 10);
    expect(result.requiredFund).toBe(4_070_546_103);
  });

  it("projects every asset group at the expected return", () => {
    expect(result.currentAssets.total).toBe(607_050_000);
    expect(result.projectedAssets).toEqual({
      cashAndSavings: 1_114_024_518,
      investments: 1_112_839_385,
      jht: 437_550_906,
      otherPension: 213_323_844,
      total: 2_877_738_653,
    });
  });

  it("reports the funding gap, ratio and saving needed", () => {
    expect(result.gap).toBe(-1_192_807_450);
    expect(result.status).toBe("shortfall");
    expect(result.fundedRatio).toBeCloseTo(0.7069662350413133, 12);
    expect(result.monthlySavingToCloseGap).toBe(1_860_176);
  });

  it("finds the age the money runs out", () => {
    expect(result.fundsRunOutAtAge).toBe(73);
    const ranOut = result.drawdown.find((p) => p.age === 73)!;
    expect(ranOut.startBalance).toBeLessThan(ranOut.withdrawal);
    expect(result.drawdown.at(-1)!.endBalance).toBe(0);
  });

  it("builds accumulation series that meet the targets at retirement", () => {
    expect(result.accumulation).toHaveLength(24);
    expect(result.accumulation[0]).toMatchObject({ age: 35, projectedAssets: 607_050_000 });
    const last = result.accumulation.at(-1)!;
    expect(last).toEqual({ age: 58, projectedAssets: 2_877_738_653, requiredCapital: 4_070_546_103 });
    for (let i = 1; i < result.accumulation.length; i++) {
      expect(result.accumulation[i].requiredCapital).toBeGreaterThan(result.accumulation[i - 1].requiredCapital);
    }
  });

  it("is deterministic", () => {
    expect(simulateRetirement(demo)).toEqual(result);
  });
});

describe("simulateRetirement — other cases", () => {
  it("reports a surplus and no saving need when well funded", () => {
    const r = simulateRetirement({
      currentAge: 40,
      retirementAge: 55,
      planUntilAge: 80,
      monthlyLivingCost: 5_000_000,
      assets: { cashAndSavings: 3_000_000_000, investments: 0, jht: 0, otherPension: 0 },
      inflationBps: 300,
      investmentReturnBps: 700,
    });
    expect(r.requiredFund).toBe(1_535_888_100);
    expect(r.projectedAssets.total).toBe(8_277_094_622);
    expect(r.gap).toBe(6_741_206_522);
    expect(r.status).toBe("surplus");
    expect(r.monthlySavingToCloseGap).toBe(0);
    expect(r.fundsRunOutAtAge).toBeNull();
  });

  it("needs cost × years when return equals inflation", () => {
    const r = simulateRetirement({
      currentAge: 30,
      retirementAge: 60,
      planUntilAge: 85,
      monthlyLivingCost: 8_000_000,
      assets: { cashAndSavings: 100_000_000, investments: 0, jht: 0, otherPension: 0 },
      inflationBps: 400,
      investmentReturnBps: 400,
    });
    expect(r.requiredFundMultiple).toBe(25);
    expect(r.requiredFund).toBe(311_366_160 * 25);
    expect(r.monthlySavingToCloseGap).toBe(11_084_102);
    expect(r.fundsRunOutAtAge).toBe(61);
  });

  it("handles zero inflation and zero return", () => {
    const r = simulateRetirement({
      currentAge: 50,
      retirementAge: 60,
      planUntilAge: 70,
      monthlyLivingCost: 4_000_000,
      assets: { cashAndSavings: 500_000_000, investments: 0, jht: 0, otherPension: 0 },
      inflationBps: 0,
      investmentReturnBps: 0,
    });
    expect(r.requiredFund).toBe(480_000_000);
    expect(r.projectedAssets.total).toBe(500_000_000);
    expect(r.gap).toBe(20_000_000);
    expect(r.drawdown.at(-1)!.endBalance).toBe(20_000_000);
  });

  it("treats no assets as fully unfunded, running out in the first year", () => {
    const r = simulateRetirement({ ...demo, assets: { cashAndSavings: 0, investments: 0, jht: 0, otherPension: 0 } });
    expect(r.projectedAssets.total).toBe(0);
    expect(r.gap).toBe(-r.requiredFund);
    expect(r.fundedRatio).toBe(0);
    expect(r.fundsRunOutAtAge).toBe(58);
  });

  it("needs nothing when living costs are zero", () => {
    const r = simulateRetirement({ ...demo, monthlyLivingCost: 0 });
    expect(r.requiredFund).toBe(0);
    expect(r.fundedRatio).toBe(1);
    expect(r.status).toBe("surplus");
  });

  it("lasts exactly the plan when assets equal the required fund", () => {
    // Choose today's assets so they grow to exactly the required fund.
    const base = simulateRetirement(demo);
    const exact = base.requiredFund / base.assetGrowthFactor;
    const r = simulateRetirement({
      ...demo,
      assets: { cashAndSavings: exact, investments: 0, jht: 0, otherPension: 0 },
    });
    expect(Math.abs(r.gap)).toBeLessThanOrEqual(1);
    expect(r.fundsRunOutAtAge).toBeNull();
    expect(r.drawdown.at(-1)!.endBalance).toBeLessThanOrEqual(1);
  });

  it("rejects inconsistent ages with a field-specific error", () => {
    expect(() => simulateRetirement({ ...demo, planUntilAge: 58 })).toThrow(RetirementInputError);
    try {
      simulateRetirement({ ...demo, planUntilAge: 50 });
    } catch (error) {
      expect(error).toBeInstanceOf(RetirementInputError);
      expect((error as RetirementInputError).field).toBe("planUntilAge");
      expect((error as Error).message).toMatch(/plan-until age \(50\).*retirement age \(58\)/);
    }
    expect(() => simulateRetirement({ ...demo, retirementAge: 35 })).toThrow(/later than the current age/);
    expect(() => simulateRetirement({ ...demo, currentAge: 35.5 })).toThrow(RetirementInputError);
  });

  it("rejects negative money", () => {
    expect(() => simulateRetirement({ ...demo, monthlyLivingCost: -1 })).toThrow(RetirementInputError);
    expect(() =>
      simulateRetirement({ ...demo, assets: { ...demo.assets, jht: -5 } }),
    ).toThrow(RetirementInputError);
  });
});

describe("helper formulas", () => {
  it("growingAnnuityFactor matches the explicit sum", () => {
    const explicit = Array.from({ length: 27 }, (_, k) => (1.03 / 1.07) ** k).reduce((a, b) => a + b, 0);
    expect(growingAnnuityFactor(300, 700, 27)).toBeCloseTo(explicit, 10);
    expect(growingAnnuityFactor(500, 500, 10)).toBe(10);
    expect(growingAnnuityFactor(300, 700, 0)).toBe(0);
  });

  it("annualSavingFor reaches the target", () => {
    const p = annualSavingFor(1_000_000_000, 700, 20);
    let balance = 0;
    for (let y = 0; y < 20; y++) balance = balance * 1.07 + p;
    expect(balance).toBeCloseTo(1_000_000_000, 2);
    expect(annualSavingFor(0, 700, 20)).toBe(0);
    expect(annualSavingFor(100, 0, 4)).toBe(25);
  });
});

describe("simulateRetirement — property purchase", () => {
  it("pays an affordable property from assets and reduces retirement assets", () => {
    const r = simulateRetirement({
      ...demo,
      propertyPurchase: { currentPrice: 300_000_000, purchaseAge: 45, growthBps: 500 },
    });
    expect(r.property).toMatchObject({ paidFromAssets: 488_668_388, unfundedAmount: 0 });
    expect(r.property!.projection.futurePrice).toBe(488_668_388);
    expect(r.retirementAssets).toBe(1_700_123_582);
    expect(r.gap).toBe(-2_370_422_521);
    // Projected assets still describe today's assets grown without the purchase.
    expect(r.projectedAssets.total).toBe(2_877_738_653);
    // The trajectory drops at the purchase age.
    expect(r.accumulation.find((p) => p.age === 44)!.projectedAssets).toBe(1_116_036_665);
    expect(r.accumulation.find((p) => p.age === 45)!.projectedAssets).toBe(705_490_843);
    expect(r.accumulation.at(-1)!.projectedAssets).toBe(1_700_123_582);
  });

  it("reports the part of the price assets cannot cover", () => {
    const r = simulateRetirement({
      ...demo,
      propertyPurchase: { currentPrice: 1_500_000_000, purchaseAge: 40, growthBps: 500 },
    });
    expect(r.property).toMatchObject({ paidFromAssets: 851_419_028, unfundedAmount: 1_063_003_316 });
    expect(r.retirementAssets).toBe(0);
    expect(r.gap).toBe(-4_070_546_103);
    expect(r.fundsRunOutAtAge).toBe(58);
  });

  it("leaves results unchanged when no purchase is planned", () => {
    const withNull = simulateRetirement({ ...demo, propertyPurchase: null });
    const without = simulateRetirement(demo);
    expect(withNull.retirementAssets).toBe(without.projectedAssets.total);
    expect(withNull.gap).toBe(without.gap);
    expect(withNull.property).toBeNull();
  });

  it("rejects a purchase outside the working years", () => {
    for (const purchaseAge of [34, 59]) {
      expect(() =>
        simulateRetirement({ ...demo, propertyPurchase: { currentPrice: 1, purchaseAge, growthBps: 0 } }),
      ).toThrow(/between your current age \(35\) and retirement age \(58\)/);
    }
    expect(() =>
      simulateRetirement({ ...demo, propertyPurchase: { currentPrice: 0, purchaseAge: 40, growthBps: 0 } }),
    ).toThrow(RetirementInputError);
  });
});
