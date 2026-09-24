import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../db/client";
import { DEMO_USERNAME } from "../db/seed";
import { insertInsights, listInsightsByUserId } from "../repositories/ai-insights";
import { findUserByUsername } from "../repositories/users";
import { deleteFinancialData } from "./financial-profile";
import { listScenariosByUserId } from "../repositories/scenarios";
import {
  acceptInsight,
  applyInsightAction,
  dismissInsight,
  editInsight,
  generateInsights,
  getInsightsPage,
  rejectInsight,
} from "./ai-insights";
import { getAssumptions } from "./cost-projection";

/** All tables an insight must never write to, except via an explicit, accepted Apply. */
function baselineSnapshot(db: Database, userId: number) {
  const tables = ["financial_profiles", "asset_accounts", "economic_assumptions", "retirement_settings", "target_properties", "scenarios"];
  return Object.fromEntries(
    tables.map((t) => [t, db.prepare(`SELECT * FROM ${t} WHERE user_id = ? ORDER BY rowid`).all(userId)]),
  );
}

describe("ai insights service", () => {
  let db: Database;
  let demoId: number;
  let newUserId: number;
  const savedEnv = { AI_PROVIDER: process.env.AI_PROVIDER, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY };

  beforeEach(() => {
    db = openDatabase(":memory:");
    demoId = findUserByUsername(DEMO_USERNAME, db)!.id;
    newUserId = Number(
      db.prepare("INSERT INTO users (username, password_hash, full_name) VALUES ('new', 'x', 'New')").run()
        .lastInsertRowid,
    );
    delete process.env.AI_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    db.close();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key as keyof typeof savedEnv];
      else process.env[key as keyof typeof savedEnv] = value;
    }
  });

  it("reports incomplete without a financial profile, and does not call any provider", async () => {
    deleteFinancialData(demoId, db);
    expect(await generateInsights(demoId, db)).toEqual({ status: "incomplete" });
    expect(getInsightsPage(demoId, db).baseline).toEqual({ status: "incomplete" });
  });

  it("reports unavailable when no provider is configured, without persisting anything", async () => {
    expect(await generateInsights(demoId, db)).toEqual({
      status: "unavailable",
      reason: expect.stringMatching(/not configured/),
    });
    expect(listInsightsByUserId(demoId, db)).toEqual([]);
  });

  it("reports an AI error distinctly from unavailable, and persists nothing", async () => {
    process.env.AI_PROVIDER = "mock-error";
    const result = await generateInsights(demoId, db);
    expect(result).toEqual({ status: "ai_error", message: expect.stringMatching(/Simulated failure/) });
    expect(listInsightsByUserId(demoId, db)).toEqual([]);
    // The app stays usable: the baseline plan is still readable.
    expect(getInsightsPage(demoId, db).baseline).toEqual({ status: "ready" });
  });

  it("generates and persists insights via the mock provider", async () => {
    process.env.AI_PROVIDER = "mock";
    const result = await generateInsights(demoId, db);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.count).toBeGreaterThan(0);

    const insights = listInsightsByUserId(demoId, db);
    expect(insights).toHaveLength(result.count);
    expect(insights.every((i) => i.status === "pending")).toBe(true);
    expect(insights.every((i) => i.provider === "mock")).toBe(true);
    expect(new Set(insights.map((i) => i.batchId)).size).toBe(1);

    const page = getInsightsPage(demoId, db);
    expect(page.baseline).toEqual({ status: "ready" });
    expect(page.insights).toHaveLength(result.count);
    expect(page.events.filter((e) => e.eventType === "generated")).toHaveLength(result.count);
  });

  it("moves an insight through accept, reject or dismiss and logs each transition", async () => {
    process.env.AI_PROVIDER = "mock";
    await generateInsights(demoId, db);
    const [a, b, c] = listInsightsByUserId(demoId, db);

    expect(acceptInsight(demoId, a.id, db)).toEqual({ ok: true });
    expect(listInsightsByUserId(demoId, db).find((i) => i.id === a.id)!.status).toBe("accepted");

    expect(rejectInsight(demoId, b.id, db)).toEqual({ ok: true });
    expect(listInsightsByUserId(demoId, db).find((i) => i.id === b.id)!.status).toBe("rejected");

    expect(dismissInsight(demoId, c.id, db)).toEqual({ ok: true });
    expect(listInsightsByUserId(demoId, db).find((i) => i.id === c.id)!.status).toBe("dismissed");

    const events = getInsightsPage(demoId, db).events;
    expect(events.some((e) => e.insightId === a.id && e.eventType === "accepted")).toBe(true);
    expect(events.some((e) => e.insightId === b.id && e.eventType === "rejected")).toBe(true);
    expect(events.some((e) => e.insightId === c.id && e.eventType === "dismissed")).toBe(true);

    // A terminal (dismissed/rejected/applied) insight cannot be acted on again;
    // "accepted" is deliberately still reversible up until it is applied.
    expect(dismissInsight(demoId, c.id, db)).toMatchObject({ ok: false, formError: expect.stringMatching(/already been handled/) });
    expect(rejectInsight(demoId, b.id, db)).toMatchObject({ ok: false, formError: expect.stringMatching(/already been handled/) });
  });

  it("never writes to any baseline table for generate, accept, edit, reject or dismiss", async () => {
    process.env.AI_PROVIDER = "mock";
    const before = baselineSnapshot(db, demoId);
    await generateInsights(demoId, db);
    const insights = listInsightsByUserId(demoId, db);
    const scenarioInsight = insights.find((i) => i.actionType === "create_scenario")!;
    editInsight(demoId, scenarioInsight.id, { name: "Edited name", retirementAge: "61" }, db);
    acceptInsight(demoId, scenarioInsight.id, db);
    const other = insights.find((i) => i.id !== scenarioInsight.id)!;
    rejectInsight(demoId, other.id, db);

    expect(baselineSnapshot(db, demoId)).toEqual(before);
  });

  it("edits a suggestion's proposed values without touching the original", async () => {
    process.env.AI_PROVIDER = "mock";
    await generateInsights(demoId, db);
    const scenarioInsight = listInsightsByUserId(demoId, db).find((i) => i.actionType === "create_scenario")!;
    const originalPayload = scenarioInsight.actionPayload;

    const result = editInsight(
      demoId,
      scenarioInsight.id,
      { actionLabel: "My custom label", name: "My scenario", retirementAge: "62", monthlySpending: "", inflationBps: "5", investmentReturnBps: "", retirementYears: "" },
      db,
    );
    expect(result).toEqual({ ok: true });

    const updated = listInsightsByUserId(demoId, db).find((i) => i.id === scenarioInsight.id)!;
    expect(updated.status).toBe("edited");
    expect(updated.actionPayload).toEqual(originalPayload); // original preserved for audit
    expect(updated.editedActionPayload).toEqual({
      name: "My scenario",
      retirementAge: 62,
      monthlySpending: null,
      inflationBps: 500,
      investmentReturnBps: null,
      retirementYears: null,
    });
    expect(updated.editedActionLabel).toBe("My custom label");
  });

  it("applies a create_scenario action only after acceptance, using the edited values", async () => {
    process.env.AI_PROVIDER = "mock";
    await generateInsights(demoId, db);
    const insight = listInsightsByUserId(demoId, db).find((i) => i.actionType === "create_scenario")!;
    editInsight(demoId, insight.id, { name: "AI: delay retirement", retirementAge: "61", monthlySpending: "", inflationBps: "", investmentReturnBps: "", retirementYears: "" }, db);

    const beforeAccept = applyInsightAction(demoId, insight.id, db);
    expect(beforeAccept).toMatchObject({ ok: false, formError: expect.stringMatching(/Accept this suggestion/) });

    acceptInsight(demoId, insight.id, db);
    const scenariosBefore = listScenariosByUserId(demoId, db).length;
    const applied = applyInsightAction(demoId, insight.id, db);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.scenarioId).toBeTypeOf("number");

    const scenarios = listScenariosByUserId(demoId, db);
    expect(scenarios).toHaveLength(scenariosBefore + 1);
    expect(scenarios.find((s) => s.id === applied.scenarioId)).toMatchObject({ name: "AI: delay retirement", retirementAge: 61 });

    expect(listInsightsByUserId(demoId, db).find((i) => i.id === insight.id)!.status).toBe("applied");
    expect(getInsightsPage(demoId, db).events.some((e) => e.insightId === insight.id && e.eventType === "applied")).toBe(true);

    // Applying twice is refused, not repeated.
    expect(applyInsightAction(demoId, insight.id, db)).toMatchObject({ ok: false });
  });

  it("applies an update_assumptions action by merging with the currently saved rates", () => {
    // Inserted directly rather than via a provider: update_assumptions is a
    // real, whitelisted action type regardless of whether today's mock
    // templates happen to propose one, and this isolates the apply logic.
    const [id] = insertInsights(
      demoId,
      [
        {
          batchId: "test-batch",
          provider: "mock",
          model: null,
          kind: "inflation_sensitivity",
          observation: "test",
          reasoning: "test",
          citedValues: [],
          confidence: "medium",
          actionType: "update_assumptions",
          actionLabel: "Raise inflation to 4%",
          actionPayload: { inflationBps: 400, investmentReturnBps: null },
        },
      ],
      db,
    );
    const before = getAssumptions(demoId, db).values;

    acceptInsight(demoId, id, db);
    const result = applyInsightAction(demoId, id, db);
    expect(result).toEqual({ ok: true });

    const after = getAssumptions(demoId, db).values;
    expect(after.inflationBps).toBe(400);
    expect(after.investmentReturnBps).toBe(before.investmentReturnBps); // null in payload -> unchanged
    expect(after.housingGrowthBps).toBe(before.housingGrowthBps); // never touched
    expect(listInsightsByUserId(demoId, db).find((i) => i.id === id)!.status).toBe("applied");
  });

  it("rejects an edited scenario name that collides with an existing one, exactly like manual entry would", async () => {
    process.env.AI_PROVIDER = "mock";
    await generateInsights(demoId, db);
    const insight = listInsightsByUserId(demoId, db).find((i) => i.actionType === "create_scenario")!;
    editInsight(demoId, insight.id, { name: "Base", retirementAge: "", monthlySpending: "", inflationBps: "", investmentReturnBps: "", retirementYears: "" }, db);
    acceptInsight(demoId, insight.id, db);

    const result = applyInsightAction(demoId, insight.id, db);
    expect(result).toMatchObject({ ok: false, errors: { name: expect.stringMatching(/already have a scenario/) } });
    expect(listInsightsByUserId(demoId, db).find((i) => i.id === insight.id)!.status).toBe("accepted"); // not marked applied
  });

  it("scopes every action to its owner", async () => {
    process.env.AI_PROVIDER = "mock";
    await generateInsights(demoId, db);
    const insight = listInsightsByUserId(demoId, db)[0];

    expect(acceptInsight(newUserId, insight.id, db).ok).toBe(false);
    expect(rejectInsight(newUserId, insight.id, db).ok).toBe(false);
    expect(dismissInsight(newUserId, insight.id, db).ok).toBe(false);
    expect(editInsight(newUserId, insight.id, {}, db).ok).toBe(false);
    expect(applyInsightAction(newUserId, insight.id, db).ok).toBe(false);
    expect(getInsightsPage(newUserId, db).insights).toEqual([]);
  });
});
