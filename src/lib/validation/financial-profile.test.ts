import { describe, expect, it } from "vitest";
import { parseRupiah, validateAssetAccount, validateFinancialProfile } from "./financial-profile";

const validProfile = {
  currentAge: "35",
  targetRetirementAge: "58",
  monthlyIncome: "25.000.000",
  monthlyExpenses: "10000000",
  housingStatus: "rent",
  monthlyRent: "Rp 4.500.000",
  propertyValue: "",
  city: " Jakarta ",
};

describe("parseRupiah", () => {
  it.each([
    ["25000000", 25_000_000],
    ["25.000.000", 25_000_000],
    ["Rp 25.000.000", 25_000_000],
    ["rp25.000.000", 25_000_000],
    ["25,000,000", 25_000_000],
    ["0", 0],
  ])("parses %s", (input, expected) => {
    expect(parseRupiah(input)).toBe(expected);
  });

  it.each(["", "abc", "-5", "1.5", "12,5", "25.00.000", "1e9"])("rejects %s", (input) => {
    expect(parseRupiah(input)).toBeNull();
  });
});

describe("validateFinancialProfile", () => {
  it("accepts a valid renter profile and normalises values", () => {
    const result = validateFinancialProfile(validProfile);
    expect(result).toEqual({
      ok: true,
      data: {
        currentAge: 35,
        targetRetirementAge: 58,
        monthlyIncome: 25_000_000,
        monthlyExpenses: 10_000_000,
        housingStatus: "rent",
        monthlyRent: 4_500_000,
        propertyValue: null,
        city: "Jakarta",
      },
    });
  });

  it("requires every core field", () => {
    const result = validateFinancialProfile({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(
      ["currentAge", "housingStatus", "monthlyExpenses", "monthlyIncome", "targetRetirementAge"].sort(),
    );
  });

  it("rejects out-of-range ages and a retirement age not after the current age", () => {
    const young = validateFinancialProfile({ ...validProfile, currentAge: "15" });
    expect(!young.ok && young.errors.currentAge).toMatch(/between 18/);

    const early = validateFinancialProfile({ ...validProfile, targetRetirementAge: "35" });
    expect(!early.ok && early.errors.targetRetirementAge).toMatch(/later than your current age/);

    const fraction = validateFinancialProfile({ ...validProfile, currentAge: "35.5" });
    expect(!fraction.ok && fraction.errors.currentAge).toMatch(/whole number/);
  });

  it("requires rent for renters and property value for owners", () => {
    const renter = validateFinancialProfile({ ...validProfile, monthlyRent: "" });
    expect(!renter.ok && renter.errors.monthlyRent).toMatch(/monthly rent/);

    const owner = validateFinancialProfile({ ...validProfile, housingStatus: "own", propertyValue: "0" });
    expect(!owner.ok && owner.errors.propertyValue).toMatch(/more than Rp 0/);
  });

  it("discards housing amounts that do not apply", () => {
    const owner = validateFinancialProfile({
      ...validProfile,
      housingStatus: "own",
      propertyValue: "1.200.000.000",
    });
    expect(owner.ok && owner.data).toMatchObject({ propertyValue: 1_200_000_000, monthlyRent: null });

    const family = validateFinancialProfile({ ...validProfile, housingStatus: "family" });
    expect(family.ok && family.data).toMatchObject({ propertyValue: null, monthlyRent: null });
  });

  it("rejects an unknown housing status", () => {
    const result = validateFinancialProfile({ ...validProfile, housingStatus: "castle" });
    expect(!result.ok && result.errors.housingStatus).toBeTruthy();
  });

  it("stores an empty city as null", () => {
    const result = validateFinancialProfile({ ...validProfile, city: "  " });
    expect(result.ok && result.data.city).toBeNull();
  });
});

describe("validateAssetAccount", () => {
  it("accepts a valid record", () => {
    expect(
      validateAssetAccount({ name: "JHT", category: "bpjs_jht", institution: "", balance: "92.300.000" }),
    ).toEqual({
      ok: true,
      data: { name: "JHT", category: "bpjs_jht", institution: null, balance: 92_300_000 },
    });
  });

  it("reports missing and invalid fields", () => {
    const result = validateAssetAccount({ name: "", category: "gold-bars", balance: "lots" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toMatchObject({
      name: expect.any(String),
      category: expect.any(String),
      balance: expect.stringMatching(/whole Rupiah/),
    });
  });

  it("allows a zero balance", () => {
    expect(validateAssetAccount({ name: "New DPLK", category: "pension", balance: "0" }).ok).toBe(true);
  });
});
