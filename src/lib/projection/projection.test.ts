import { describe, expect, it } from "vitest";
import { compound, formatRate, growthFactor, realRate, toTodaysMoney } from "./compound";
import { projectProperty } from "./housing";
import { projectLivingCost } from "./living-costs";

// Expected values were computed independently with Python's decimal module
// (50-digit precision, round-half-up to whole Rupiah).

describe("compound helpers", () => {
  it("returns exactly 1 for zero years or a zero rate", () => {
    expect(growthFactor(300, 0)).toBe(1);
    expect(growthFactor(0, 25)).toBe(1);
    expect(compound(10_000_000, 0, 25)).toBe(10_000_000);
  });

  it("compounds annually", () => {
    expect(compound(10_000_000, 300, 1)).toBe(10_300_000);
    expect(compound(10_000_000, 300, 23)).toBe(19_735_865);
    expect(compound(7_500_000, 275, 30)).toBe(16_924_513);
  });

  it("discounts future money back to today's prices", () => {
    expect(toTodaysMoney(1_000_000, 300, 23)).toBe(506_692);
    expect(toTodaysMoney(10_300_000, 300, 1)).toBe(10_000_000);
  });

  it("computes growth above inflation", () => {
    expect(realRate(500, 300)).toBeCloseTo(1.05 / 1.03 - 1, 12);
    expect(realRate(300, 300)).toBe(0);
    expect(realRate(200, 400)).toBeLessThan(0);
  });

  it("rejects fractional or negative years", () => {
    expect(() => growthFactor(300, -1)).toThrow(RangeError);
    expect(() => growthFactor(300, 1.5)).toThrow(RangeError);
  });

  it("formats basis points as an Indonesian percentage", () => {
    expect(formatRate(300)).toBe("3,00%");
    expect(formatRate(275)).toBe("2,75%");
  });

  it("is deterministic", () => {
    const runs = Array.from({ length: 5 }, () => compound(123_456_789, 437, 41));
    expect(new Set(runs).size).toBe(1);
  });
});

describe("projectLivingCost", () => {
  const demo = { monthlyCost: 10_000_000, currentAge: 35, retirementAge: 58, inflationBps: 300 };

  it("projects monthly and annual cost to retirement", () => {
    const p = projectLivingCost(demo);
    expect(p.years).toBe(23);
    expect(p.current).toEqual({ monthly: 10_000_000, annual: 120_000_000 });
    expect(p.atRetirement).toEqual({ monthly: 19_735_865, annual: 236_830_380 });
    expect(p.increase.monthly).toBe(9_735_865);
    expect(p.increase.annual).toBe(116_830_380);
    expect(p.increase.percent).toBeCloseTo(0.9735865, 7);
  });

  it("reports the purchasing power of money held until retirement", () => {
    const p = projectLivingCost(demo);
    expect(p.purchasingPowerOfOneMillion).toBe(506_692);
    expect(p.purchasingPowerRemaining).toBeCloseTo(0.506692, 6);
  });

  it("produces one point per year, starting today and ending at retirement", () => {
    const { series } = projectLivingCost(demo);
    expect(series).toHaveLength(24);
    expect(series[0]).toEqual({ age: 35, yearsFromNow: 0, monthly: 10_000_000 });
    expect(series[1].monthly).toBe(10_300_000);
    expect(series.at(-1)).toEqual({ age: 58, yearsFromNow: 23, monthly: 19_735_865 });
    for (let i = 1; i < series.length; i++) {
      expect(series[i].monthly).toBeGreaterThan(series[i - 1].monthly);
    }
  });

  it("keeps costs flat with zero inflation", () => {
    const p = projectLivingCost({ ...demo, inflationBps: 0 });
    expect(p.atRetirement.monthly).toBe(10_000_000);
    expect(p.purchasingPowerRemaining).toBe(1);
  });

  it("handles a zero cost without dividing by zero", () => {
    const p = projectLivingCost({ ...demo, monthlyCost: 0 });
    expect(p.atRetirement.annual).toBe(0);
    expect(p.increase.percent).toBe(0);
  });

  it("rejects a retirement age before the current age", () => {
    expect(() => projectLivingCost({ ...demo, retirementAge: 30 })).toThrow(RangeError);
  });
});

describe("projectProperty", () => {
  const home = {
    currentPrice: 1_500_000_000,
    currentAge: 35,
    purchaseAge: 40,
    growthBps: 500,
    inflationBps: 300,
  };

  it("projects the nominal price at the purchase age", () => {
    const p = projectProperty(home);
    expect(p.years).toBe(5);
    expect(p.futurePrice).toBe(1_914_422_344);
    expect(p.nominalIncrease).toBe(414_422_344);
    expect(p.nominalIncreasePercent).toBeCloseTo(0.2762815625, 9);
  });

  it("separates price growth from the fall in money's purchasing power", () => {
    const p = projectProperty(home);
    // The future price, restated in today's money, is still higher than
    // today's price: property is expected to outpace general inflation.
    expect(p.futurePriceInTodaysMoney).toBe(1_651_397_531);
    expect(p.realChange).toBe(151_397_531);
    expect(p.realGrowthRate).toBeCloseTo(1.05 / 1.03 - 1, 12);
    // Cash equal to today's price loses purchasing power over the same period.
    expect(p.cashPurchasingPowerAtPurchase).toBe(1_293_913_177);
  });

  it("shows a real-terms decline when prices grow slower than inflation", () => {
    const p = projectProperty({ ...home, currentPrice: 800_000_000, purchaseAge: 45, growthBps: 200, inflationBps: 400 });
    expect(p.futurePrice).toBe(975_195_536); // the price tag still rises
    expect(p.nominalIncrease).toBeGreaterThan(0);
    expect(p.futurePriceInTodaysMoney).toBe(658_807_162);
    expect(p.realChange).toBeLessThan(0);
  });

  it("builds a yearly series of nominal and today's-money prices", () => {
    const { series } = projectProperty(home);
    expect(series).toHaveLength(6);
    expect(series[0]).toEqual({ age: 35, yearsFromNow: 0, nominalPrice: 1_500_000_000, priceInTodaysMoney: 1_500_000_000 });
    expect(series.at(-1)).toEqual({
      age: 40,
      yearsFromNow: 5,
      nominalPrice: 1_914_422_344,
      priceInTodaysMoney: 1_651_397_531,
    });
  });

  it("returns today's price when buying now", () => {
    const p = projectProperty({ ...home, purchaseAge: 35 });
    expect(p.years).toBe(0);
    expect(p.futurePrice).toBe(1_500_000_000);
    expect(p.series).toHaveLength(1);
  });

  it("supports falling prices without calling it inflation", () => {
    const p = projectProperty({ ...home, growthBps: -200 });
    expect(p.futurePrice).toBeLessThan(home.currentPrice);
    expect(p.nominalIncrease).toBeLessThan(0);
  });

  it("rejects a purchase age in the past", () => {
    expect(() => projectProperty({ ...home, purchaseAge: 30 })).toThrow(RangeError);
  });
});
