import { describe, expect, it } from "vitest";
import { parsePercentToBps, validateAssumptions, validateTargetProperty } from "./cost-projection";

describe("parsePercentToBps", () => {
  it.each([
    ["3", 300],
    ["3.5", 350],
    ["3,5", 350],
    ["3,25%", 325],
    [" 2.75 % ", 275],
    ["0", 0],
    ["-2", -200],
    ["−1,5", -150],
    ["-0", 0],
  ])("parses %s", (input, expected) => {
    expect(parsePercentToBps(input)).toBe(expected);
  });

  it.each(["", "abc", "3.125", "1.2.3", "3%%x", "1e2", "1000"])("rejects %s", (input) => {
    expect(parsePercentToBps(input)).toBeNull();
  });
});

describe("validateAssumptions", () => {
  it("converts valid percentages to basis points", () => {
    expect(
      validateAssumptions({ inflationBps: "3", housingGrowthBps: "5,5", investmentReturnBps: "7.25" }),
    ).toEqual({ ok: true, data: { inflationBps: 300, housingGrowthBps: 550, investmentReturnBps: 725 } });
  });

  it("requires every rate", () => {
    const result = validateAssumptions({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toHaveLength(3);
  });

  it("enforces ranges and rejects negative inflation", () => {
    const result = validateAssumptions({ inflationBps: "-1", housingGrowthBps: "31", investmentReturnBps: "-10" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.inflationBps).toMatch(/between 0% and 30%/);
    expect(result.errors.housingGrowthBps).toMatch(/between -10% and 30%/);
    expect(result.errors.investmentReturnBps).toBeUndefined();
  });

  it("explains unparseable input", () => {
    const result = validateAssumptions({ inflationBps: "lots", housingGrowthBps: "5", investmentReturnBps: "7" });
    expect(!result.ok && result.errors.inflationBps).toMatch(/percentage, e.g. 3 or 3,5/);
  });
});

describe("validateTargetProperty", () => {
  const valid = { name: " House in Depok ", currentPrice: "1.500.000.000", purchaseAge: "40", growthBps: "" };

  it("accepts a property that follows the housing-growth assumption", () => {
    expect(validateTargetProperty(valid, 35)).toEqual({
      ok: true,
      data: { name: "House in Depok", currentPrice: 1_500_000_000, purchaseAge: 40, growthBps: null },
    });
  });

  it("accepts a property-specific growth rate", () => {
    const result = validateTargetProperty({ ...valid, growthBps: "4,5" }, 35);
    expect(result.ok && result.data.growthBps).toBe(450);
  });

  it("allows buying at the current age but not before it", () => {
    expect(validateTargetProperty({ ...valid, purchaseAge: "35" }, 35).ok).toBe(true);
    const past = validateTargetProperty({ ...valid, purchaseAge: "34" }, 35);
    expect(!past.ok && past.errors.purchaseAge).toMatch(/earlier than your current age \(35\)/);
  });

  it("reports missing and invalid fields", () => {
    const result = validateTargetProperty({ name: "", currentPrice: "0", purchaseAge: "abc", growthBps: "99" }, 35);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toMatchObject({
      name: expect.any(String),
      currentPrice: expect.stringMatching(/more than Rp 0/),
      purchaseAge: expect.stringMatching(/whole number/),
      growthBps: expect.stringMatching(/between/),
    });
  });
});
