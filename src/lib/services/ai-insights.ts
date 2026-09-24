import { randomUUID } from "node:crypto";
import { getDb, type Database } from "../db/client";
import { buildAiContext } from "../ai/context";
import { getAiProvider } from "../ai/get-provider";
import { computeFinancialSignals, type SignalsStatus } from "../ai/signals";
import type { ActionPayload, ActionType, InsightStatus } from "../domain/ai-insights";
import {
  findInsight,
  insertInsightEvent,
  insertInsights,
  listEventsByUserId,
  listInsightsByUserId,
  setInsightEdit,
  setInsightStatus,
  type AiInsightEventRow,
  type AiInsightRow,
} from "../repositories/ai-insights";
import type { RawInput } from "../validation/common";
import { getAssumptions, saveAssumptions } from "./cost-projection";
import type { MutationResult } from "./financial-profile";
import { createScenario } from "./scenarios";

/**
 * Orchestrates AI Insights: computing the deterministic signals (never
 * done by the AI), calling the configured provider, validating and
 * persisting what comes back, and — the only place any insight can ever
 * change the user's saved data — applying a whitelisted, already-edited
 * action through the exact same validated write paths as a manual edit
 * (Stage 2/3/5). Every state change is logged to ai_insight_events.
 */

export interface AiInsightsPage {
  /** The deterministic baseline the signals (and therefore any insight) depend on. */
  baseline: { status: "incomplete" } | { status: "error"; message: string } | { status: "ready" };
  insights: AiInsightRow[];
  events: AiInsightEventRow[];
}

export function getInsightsPage(userId: number, db: Database = getDb()): AiInsightsPage {
  const signals = computeFinancialSignals(userId, db);
  const baseline: AiInsightsPage["baseline"] =
    signals.status === "ready" ? { status: "ready" } : signals.status === "incomplete" ? { status: "incomplete" } : signals;
  return {
    baseline,
    insights: listInsightsByUserId(userId, db),
    events: listEventsByUserId(userId, db).slice(0, 40),
  };
}

export type GenerateInsightsResult =
  | { status: "incomplete" }
  | { status: "baseline_error"; message: string }
  | { status: "unavailable"; reason: string }
  | { status: "ai_error"; message: string }
  | { status: "ready"; count: number };

function baselineFromSignals(signals: SignalsStatus): { status: "incomplete" } | { status: "baseline_error"; message: string } | null {
  if (signals.status === "incomplete") return { status: "incomplete" };
  if (signals.status === "error") return { status: "baseline_error", message: signals.message };
  return null;
}

/** Calls the AI provider and persists what it returns. Never mutates financial data. */
export async function generateInsights(userId: number, db: Database = getDb()): Promise<GenerateInsightsResult> {
  const signals = computeFinancialSignals(userId, db);
  const early = baselineFromSignals(signals);
  if (early) return early;
  if (signals.status !== "ready") return { status: "incomplete" }; // unreachable, satisfies narrowing

  const selection = getAiProvider();
  if (!selection.provider) return { status: "unavailable", reason: selection.reason };

  const outcome = await selection.provider.generate(buildAiContext(signals));
  if (outcome.status === "unavailable") return { status: "unavailable", reason: outcome.reason };
  if (outcome.status === "error") return { status: "ai_error", message: outcome.message };

  const batchId = randomUUID();
  const ids = insertInsights(
    userId,
    outcome.insights.map((insight) => ({ ...insight, batchId, provider: outcome.provider, model: outcome.model })),
    db,
  );
  for (const id of ids) {
    insertInsightEvent(userId, id, "generated", { provider: outcome.provider, model: outcome.model }, db);
  }
  return { status: "ready", count: ids.length };
}

const NOT_FOUND = "That insight no longer exists. It may have been dismissed or removed.";
const ALREADY_HANDLED = "This suggestion has already been handled and can't be changed again.";

function requireOpenInsight(userId: number, id: number, db: Database): MutationResult<never> | AiInsightRow {
  const insight = findInsight(userId, id, db);
  if (!insight) return { ok: false, formError: NOT_FOUND };
  if (insight.status === "applied" || insight.status === "rejected" || insight.status === "dismissed") {
    return { ok: false, formError: ALREADY_HANDLED };
  }
  return insight;
}

function isInsight(value: MutationResult<never> | AiInsightRow): value is AiInsightRow {
  return "id" in value;
}

export function acceptInsight(userId: number, id: number, db: Database = getDb()): MutationResult<never> {
  const insight = requireOpenInsight(userId, id, db);
  if (!isInsight(insight)) return insight;
  setInsightStatus(userId, id, "accepted", db);
  insertInsightEvent(userId, id, "accepted", null, db);
  return { ok: true };
}

export function rejectInsight(userId: number, id: number, db: Database = getDb()): MutationResult<never> {
  const insight = requireOpenInsight(userId, id, db);
  if (!isInsight(insight)) return insight;
  setInsightStatus(userId, id, "rejected", db);
  insertInsightEvent(userId, id, "rejected", null, db);
  return { ok: true };
}

export function dismissInsight(userId: number, id: number, db: Database = getDb()): MutationResult<never> {
  const insight = requireOpenInsight(userId, id, db);
  if (!isInsight(insight)) return insight;
  setInsightStatus(userId, id, "dismissed", db);
  insertInsightEvent(userId, id, "dismissed", null, db);
  return { ok: true };
}

export type EditableField = "actionLabel" | "name" | "retirementAge" | "monthlySpending" | "inflationBps" | "investmentReturnBps" | "retirementYears";

/** Edits the proposed action itself — the observation/reasoning text is never user-editable. */
export function editInsight(
  userId: number,
  id: number,
  raw: RawInput,
  db: Database = getDb(),
): MutationResult<EditableField> {
  const insight = requireOpenInsight(userId, id, db);
  if (!isInsight(insight)) return insight;
  if (insight.actionType === "none") return { ok: false, formError: "This suggestion has no proposed action to edit." };

  const label = String(raw.actionLabel ?? "").trim().slice(0, 140) || insight.actionLabel;
  const num = (key: string): number | null => {
    const value = String(raw[key] ?? "").trim();
    if (value === "") return null;
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? Math.round(n) : null;
  };

  const payload: ActionPayload =
    insight.actionType === "create_scenario"
      ? {
          name: String(raw.name ?? "").trim().slice(0, 60) || "Untitled scenario",
          retirementAge: num("retirementAge"),
          monthlySpending: num("monthlySpending"),
          inflationBps: bpsFromPercentInput(raw.inflationBps),
          investmentReturnBps: bpsFromPercentInput(raw.investmentReturnBps),
          retirementYears: num("retirementYears"),
        }
      : { inflationBps: bpsFromPercentInput(raw.inflationBps), investmentReturnBps: bpsFromPercentInput(raw.investmentReturnBps) };

  setInsightEdit(userId, id, label, payload, db);
  insertInsightEvent(userId, id, "edited", { label, payload }, db);
  return { ok: true };
}

function bpsFromPercentInput(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (text === "") return null;
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function percentString(bps: number | null): string {
  return bps === null ? "" : (bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2, useGrouping: false });
}

/**
 * Applies the (possibly edited) proposed action to the user's saved plan.
 * This is the ONLY function in the app that lets an AI-derived value reach
 * a baseline table, and only for an insight the user already accepted. It
 * validates through the exact same functions a manual edit would use
 * (createScenario / saveAssumptions), so an AI-proposed value can be
 * rejected by validation exactly like a typo in a form would be.
 */
export function applyInsightAction(
  userId: number,
  id: number,
  db: Database = getDb(),
): MutationResult<string> & { scenarioId?: number } {
  const insight = findInsight(userId, id, db);
  if (!insight) return { ok: false, formError: NOT_FOUND };
  if (insight.status !== "accepted") {
    return { ok: false, formError: "Accept this suggestion before applying it." };
  }
  const payload = insight.editedActionPayload ?? insight.actionPayload;

  if (insight.actionType === "create_scenario") {
    const p = payload as { name: string; retirementAge: number | null; monthlySpending: number | null; inflationBps: number | null; investmentReturnBps: number | null; retirementYears: number | null };
    const raw: RawInput = {
      name: p.name,
      retirementAge: p.retirementAge === null ? "" : String(p.retirementAge),
      monthlySpending: p.monthlySpending === null ? "" : String(p.monthlySpending),
      inflationBps: percentString(p.inflationBps),
      investmentReturnBps: percentString(p.investmentReturnBps),
      retirementYears: p.retirementYears === null ? "" : String(p.retirementYears),
    };
    const result = createScenario(userId, raw, db);
    if (!result.ok) {
      return { ok: false, errors: result.errors as Record<string, string> | undefined, formError: result.formError };
    }
    markApplied(userId, id, { createdScenarioId: result.id }, db);
    return { ok: true, scenarioId: result.id };
  }

  if (insight.actionType === "update_assumptions") {
    const p = payload as { inflationBps: number | null; investmentReturnBps: number | null };
    const current = getAssumptions(userId, db).values;
    const before = { inflationBps: current.inflationBps, investmentReturnBps: current.investmentReturnBps };
    const raw: RawInput = {
      inflationBps: percentString(p.inflationBps ?? current.inflationBps),
      housingGrowthBps: percentString(current.housingGrowthBps),
      investmentReturnBps: percentString(p.investmentReturnBps ?? current.investmentReturnBps),
    };
    const result = saveAssumptions(userId, raw, db);
    if (!result.ok) {
      return { ok: false, errors: result.errors as Record<string, string> | undefined, formError: result.formError };
    }
    markApplied(userId, id, { before, after: { inflationBps: p.inflationBps ?? current.inflationBps, investmentReturnBps: p.investmentReturnBps ?? current.investmentReturnBps } }, db);
    return { ok: true };
  }

  return { ok: false, formError: "This suggestion has no action to apply." };
}

function markApplied(userId: number, id: number, detail: unknown, db: Database): void {
  setInsightStatus(userId, id, "applied", db);
  insertInsightEvent(userId, id, "applied", detail, db);
}

export type { InsightStatus, ActionType };
