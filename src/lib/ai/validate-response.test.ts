import { describe, expect, it } from "vitest";
import { validateAiResponse } from "./validate-response";

const presentKinds = ["funding_gap", "delay_retirement"] as const;

const valid = {
  kind: "funding_gap",
  observation: "You have a shortfall.",
  reasoning: "Because assets are lower than required.",
  citedValues: ["Rp 1.000.000"],
  confidence: "high",
  actionType: "none",
  actionLabel: "Review it",
  actionPayload: {},
};

describe("validateAiResponse", () => {
  it("accepts a well-formed response", () => {
    const result = validateAiResponse([valid], [...presentKinds]);
    expect(result).toEqual([valid]);
  });

  it("rejects a non-array response", () => {
    expect(validateAiResponse({ insights: [valid] }, [...presentKinds])).toEqual([]);
    expect(validateAiResponse(null, [...presentKinds])).toEqual([]);
    expect(validateAiResponse("insights", [...presentKinds])).toEqual([]);
  });

  it("drops entries whose kind was not in the sent context (prevents citing data not provided)", () => {
    const result = validateAiResponse([{ ...valid, kind: "property_purchase" }], [...presentKinds]);
    expect(result).toEqual([]);
  });

  it("drops entries missing required text fields", () => {
    expect(validateAiResponse([{ ...valid, observation: "" }], [...presentKinds])).toEqual([]);
    expect(validateAiResponse([{ ...valid, reasoning: undefined }], [...presentKinds])).toEqual([]);
    expect(validateAiResponse([{ kind: "funding_gap" }], [...presentKinds])).toEqual([]);
  });

  it("falls back to medium confidence for an invalid label", () => {
    const result = validateAiResponse([{ ...valid, confidence: "extremely-certain" }], [...presentKinds]);
    expect(result[0].confidence).toBe("medium");
  });

  it("falls back to actionType none for an unknown action type", () => {
    const result = validateAiResponse([{ ...valid, actionType: "delete_everything" }], [...presentKinds]);
    expect(result[0].actionType).toBe("none");
  });

  it("validates and coerces a create_scenario payload, rejecting one without a name", () => {
    const withName = validateAiResponse(
      [
        {
          ...valid,
          kind: "delay_retirement",
          actionType: "create_scenario",
          actionPayload: { name: "Retire later", retirementAge: 60.7, monthlySpending: "not a number" },
        },
      ],
      [...presentKinds],
    );
    expect(withName[0].actionPayload).toEqual({
      name: "Retire later",
      retirementAge: 61,
      monthlySpending: null,
      inflationBps: null,
      investmentReturnBps: null,
      retirementYears: null,
    });

    const withoutName = validateAiResponse(
      [{ ...valid, kind: "delay_retirement", actionType: "create_scenario", actionPayload: { retirementAge: 60 } }],
      [...presentKinds],
    );
    expect(withoutName[0].actionType).toBe("none");
    expect(withoutName[0].actionPayload).toEqual({});
  });

  it("validates an update_assumptions payload with only the listed fields", () => {
    const result = validateAiResponse(
      [
        {
          ...valid,
          actionType: "update_assumptions",
          actionPayload: { inflationBps: 400, investmentReturnBps: null, extraField: "ignored" },
        },
      ],
      [...presentKinds],
    );
    expect(result[0].actionPayload).toEqual({ inflationBps: 400, investmentReturnBps: null });
  });

  it("caps the number of insights and truncates long text", () => {
    const many = Array.from({ length: 20 }, () => ({ ...valid }));
    expect(validateAiResponse(many, [...presentKinds])).toHaveLength(8);

    const long = validateAiResponse([{ ...valid, observation: "x".repeat(1000) }], [...presentKinds]);
    expect(long[0].observation.length).toBe(400);
  });

  it("never throws on hostile input", () => {
    const hostile = [null, 42, "text", [], { kind: 123 }, { kind: "funding_gap", observation: 1 }];
    expect(() => validateAiResponse(hostile, [...presentKinds])).not.toThrow();
    expect(validateAiResponse(hostile, [...presentKinds])).toEqual([]);
  });
});
