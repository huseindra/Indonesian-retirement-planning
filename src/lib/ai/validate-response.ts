import {
  ACTION_TYPES,
  CONFIDENCE_LABELS,
  INSIGHT_KINDS,
  type ActionPayload,
  type ActionType,
  type AiInsightContent,
  type ConfidenceLabel,
  type InsightKind,
} from "../domain/ai-insights";

/**
 * The AI's JSON response is untrusted input — a network response, not a
 * value our own code produced — so every field is checked before it is
 * used or stored. Anything malformed is dropped rather than guessed at;
 * a partially-broken response degrades to fewer insights, never a crash
 * or a silently-wrong value.
 */

function isString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

const ACTION_PAYLOAD_FIELDS: Record<Exclude<ActionType, "none">, string[]> = {
  create_scenario: ["name", "retirementAge", "monthlySpending", "inflationBps", "investmentReturnBps", "retirementYears"],
  update_assumptions: ["inflationBps", "investmentReturnBps"],
};

function validatePayload(actionType: ActionType, raw: unknown): ActionPayload | null {
  if (actionType === "none") return {};
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const field of ACTION_PAYLOAD_FIELDS[actionType]) {
    const value = record[field];
    if (field === "name") {
      // create_scenario is the only action with a name field, and it's required.
      if (!isString(value)) return null;
      out.name = value.slice(0, 60);
      continue;
    }
    // Every other field is an optional override: a valid number, or null
    // ("not proposed"). An unparseable value is treated as null rather
    // than guessed at.
    out[field] = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
  }
  return out as unknown as ActionPayload;
}

function validateOne(raw: unknown, allowedKinds: Set<InsightKind>): AiInsightContent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const kind = r.kind;
  if (typeof kind !== "string" || !INSIGHT_KINDS.includes(kind as InsightKind) || !allowedKinds.has(kind as InsightKind)) {
    return null;
  }
  if (!isString(r.observation) || !isString(r.reasoning)) return null;

  const confidence: ConfidenceLabel = CONFIDENCE_LABELS.includes(r.confidence as ConfidenceLabel)
    ? (r.confidence as ConfidenceLabel)
    : "medium";

  const citedValues = Array.isArray(r.citedValues) ? r.citedValues.filter(isString).slice(0, 6) : [];

  const requestedType: ActionType = ACTION_TYPES.includes(r.actionType as ActionType) ? (r.actionType as ActionType) : "none";
  const requestedLabel = isString(r.actionLabel) ? r.actionLabel.slice(0, 140) : "Review this observation";
  const validatedPayload = requestedType === "none" ? {} : validatePayload(requestedType, r.actionPayload);

  // A payload that fails validation degrades the whole action to
  // informational, rather than persisting a partially-valid one.
  const actionType = validatedPayload === null ? "none" : requestedType;
  const actionPayload = validatedPayload ?? {};
  const actionLabel = validatedPayload === null ? "Review this observation" : requestedLabel;

  return {
    kind: kind as InsightKind,
    observation: r.observation.slice(0, 400),
    reasoning: r.reasoning.slice(0, 800),
    citedValues,
    confidence,
    actionType,
    actionLabel,
    actionPayload,
  };
}

/**
 * Validates the AI's raw response into a safe list of insights, dropping
 * any entry that doesn't match the expected shape or cites a signal kind
 * that wasn't actually present in what we sent. Caps the list so a
 * misbehaving response can't flood the UI or the database.
 */
export function validateAiResponse(raw: unknown, presentKinds: InsightKind[]): AiInsightContent[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(presentKinds);
  const out: AiInsightContent[] = [];
  for (const item of raw) {
    const validated = validateOne(item, allowed);
    if (validated) out.push(validated);
    if (out.length >= 8) break;
  }
  return out;
}
