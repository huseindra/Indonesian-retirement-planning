/**
 * AI Insights vocabulary. An insight is the AI's *interpretation* of
 * deterministic signals (see `ai/signals.ts`) — a short observation and
 * reasoning, never a new financial calculation.
 *
 * A suggested action is deliberately restricted to a fixed whitelist.
 * Each action type maps onto an existing, already-validated Stage 2/3/5
 * write path (create a scenario, or propose new economic assumptions) —
 * the AI can never open a new, unchecked way to write data, and applying
 * one always shows the exact before/after values first.
 */

export const INSIGHT_KINDS = [
  "funding_gap",
  "inflation_sensitivity",
  "delay_retirement",
  "increase_savings",
  "property_purchase",
  "scenario_comparison",
] as const;
export type InsightKind = (typeof INSIGHT_KINDS)[number];

export const CONFIDENCE_LABELS = ["low", "medium", "high"] as const;
export type ConfidenceLabel = (typeof CONFIDENCE_LABELS)[number];

export const ACTION_TYPES = ["create_scenario", "update_assumptions", "none"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/** Payload for `create_scenario`: a subset of a scenario's editable overrides. */
export interface CreateScenarioPayload {
  name: string;
  retirementAge: number | null;
  monthlySpending: number | null;
  inflationBps: number | null;
  investmentReturnBps: number | null;
  retirementYears: number | null;
}

/** Payload for `update_assumptions`: proposed replacement rates. */
export interface UpdateAssumptionsPayload {
  inflationBps: number | null;
  investmentReturnBps: number | null;
}

export type ActionPayload = CreateScenarioPayload | UpdateAssumptionsPayload | Record<string, never>;

export interface AiInsightContent {
  kind: InsightKind;
  observation: string;
  reasoning: string;
  /** The specific figures cited, formatted for display (e.g. "Rp 1.192.807.450 shortfall"). */
  citedValues: string[];
  confidence: ConfidenceLabel;
  actionType: ActionType;
  actionLabel: string;
  actionPayload: ActionPayload | null;
}

export const INSIGHT_STATUSES = ["pending", "edited", "accepted", "applied", "rejected", "dismissed"] as const;
export type InsightStatus = (typeof INSIGHT_STATUSES)[number];

export const EVENT_TYPES = ["generated", "edited", "accepted", "rejected", "dismissed", "applied"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const INSIGHT_KIND_LABELS: Record<InsightKind, string> = {
  funding_gap: "Funding gap",
  inflation_sensitivity: "Inflation sensitivity",
  delay_retirement: "Delaying retirement",
  increase_savings: "Increasing savings",
  property_purchase: "Property purchase",
  scenario_comparison: "Scenario comparison",
};
