import { describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../db/client";
import { DEMO_USERNAME } from "../db/seed";
import { findUserByUsername } from "../repositories/users";
import { buildAiContext } from "./context";
import { MockInsightProvider } from "./mock-provider";
import { computeFinancialSignals } from "./signals";
import { validateAiResponse } from "./validate-response";

describe("MockInsightProvider", () => {
  it("narrates every relevant demo signal using only the numbers it was given", async () => {
    const db: Database = openDatabase(":memory:");
    const userId = findUserByUsername(DEMO_USERNAME, db)!.id;
    const signals = computeFinancialSignals(userId, db);
    expect(signals.status).toBe("ready");
    if (signals.status !== "ready") return;
    const context = buildAiContext(signals);

    const outcome = await new MockInsightProvider().generate(context);
    expect(outcome.status).toBe("ready");
    if (outcome.status !== "ready") return;

    const kinds = outcome.insights.map((i) => i.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(["funding_gap", "inflation_sensitivity", "delay_retirement", "increase_savings", "property_purchase", "scenario_comparison"]),
    );
    expect(outcome.insights.find((i) => i.kind === "funding_gap")!.observation).toContain("Rp 1.192.807.450");

    // Its own output would also survive the same untrusted-response validator.
    const revalidated = validateAiResponse(outcome.insights, signals.signals.map((s) => s.kind));
    expect(revalidated).toEqual(outcome.insights);

    db.close();
  });

  it("returns no insights when there are no signals", async () => {
    const outcome = await new MockInsightProvider().generate({
      profile: { currentAge: 30, retirementAge: 60, planUntilAge: 85, monthlyLivingCost: 0, inflationBps: 0, investmentReturnBps: 0 },
      signals: [],
    });
    expect(outcome).toEqual({ status: "ready", insights: [], provider: "mock", model: null });
  });
});
