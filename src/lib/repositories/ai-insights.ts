import { getDb, type Database } from "../db/client";
import type {
  ActionPayload,
  ActionType,
  ConfidenceLabel,
  EventType,
  InsightKind,
  InsightStatus,
} from "../domain/ai-insights";

export interface AiInsightRow {
  id: number;
  userId: number;
  batchId: string;
  provider: string;
  model: string | null;
  kind: InsightKind;
  observation: string;
  reasoning: string;
  citedValues: string[];
  confidence: ConfidenceLabel;
  actionType: ActionType;
  actionLabel: string;
  actionPayload: ActionPayload;
  editedActionLabel: string | null;
  editedActionPayload: ActionPayload | null;
  status: InsightStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NewAiInsight {
  batchId: string;
  provider: string;
  model: string | null;
  kind: InsightKind;
  observation: string;
  reasoning: string;
  citedValues: string[];
  confidence: ConfidenceLabel;
  actionType: ActionType;
  actionLabel: string;
  actionPayload: ActionPayload;
}

interface Row {
  id: number;
  user_id: number;
  batch_id: string;
  provider: string;
  model: string | null;
  kind: InsightKind;
  observation: string;
  reasoning: string;
  cited_values: string;
  confidence: ConfidenceLabel;
  action_type: ActionType;
  action_label: string;
  action_payload: string;
  edited_action_label: string | null;
  edited_action_payload: string | null;
  status: InsightStatus;
  created_at: string;
  updated_at: string;
}

function toInsight(row: Row): AiInsightRow {
  return {
    id: row.id,
    userId: row.user_id,
    batchId: row.batch_id,
    provider: row.provider,
    model: row.model,
    kind: row.kind,
    observation: row.observation,
    reasoning: row.reasoning,
    citedValues: JSON.parse(row.cited_values) as string[],
    confidence: row.confidence,
    actionType: row.action_type,
    actionLabel: row.action_label,
    actionPayload: JSON.parse(row.action_payload) as ActionPayload,
    editedActionLabel: row.edited_action_label,
    editedActionPayload: row.edited_action_payload ? (JSON.parse(row.edited_action_payload) as ActionPayload) : null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLUMNS = `id, user_id, batch_id, provider, model, kind, observation, reasoning, cited_values,
  confidence, action_type, action_label, action_payload, edited_action_label, edited_action_payload,
  status, created_at, updated_at`;

export function listInsightsByUserId(userId: number, db: Database = getDb()): AiInsightRow[] {
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM ai_insights WHERE user_id = ? ORDER BY id DESC`)
    .all(userId) as Row[];
  return rows.map(toInsight);
}

/** Scoped by user so a user can never read or change another user's insight. */
export function findInsight(userId: number, id: number, db: Database = getDb()): AiInsightRow | null {
  const row = db.prepare(`SELECT ${COLUMNS} FROM ai_insights WHERE id = ? AND user_id = ?`).get(id, userId) as
    | Row
    | undefined;
  return row ? toInsight(row) : null;
}

export function insertInsights(userId: number, insights: NewAiInsight[], db: Database = getDb()): number[] {
  const insert = db.prepare(
    `INSERT INTO ai_insights
       (user_id, batch_id, provider, model, kind, observation, reasoning, cited_values,
        confidence, action_type, action_label, action_payload)
     VALUES (@userId, @batchId, @provider, @model, @kind, @observation, @reasoning, @citedValues,
        @confidence, @actionType, @actionLabel, @actionPayload)`,
  );
  return insights.map((insight) => {
    const { lastInsertRowid } = insert.run({
      userId,
      batchId: insight.batchId,
      provider: insight.provider,
      model: insight.model,
      kind: insight.kind,
      observation: insight.observation,
      reasoning: insight.reasoning,
      citedValues: JSON.stringify(insight.citedValues),
      confidence: insight.confidence,
      actionType: insight.actionType,
      actionLabel: insight.actionLabel,
      actionPayload: JSON.stringify(insight.actionPayload),
    });
    return Number(lastInsertRowid);
  });
}

/** Changes only the status (accept/reject/dismiss/applied) — never touches any edited_* column. */
export function setInsightStatus(userId: number, id: number, status: InsightStatus, db: Database = getDb()): boolean {
  return (
    db
      .prepare(
        `UPDATE ai_insights
            SET status = @status, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = @id AND user_id = @userId`,
      )
      .run({ id, userId, status }).changes > 0
  );
}

/** Records a user's edit to the proposed action; the original stays untouched for the audit trail. */
export function setInsightEdit(
  userId: number,
  id: number,
  label: string,
  payload: ActionPayload,
  db: Database = getDb(),
): boolean {
  return (
    db
      .prepare(
        `UPDATE ai_insights
            SET status = 'edited',
                edited_action_label = @label,
                edited_action_payload = @payload,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = @id AND user_id = @userId`,
      )
      .run({ id, userId, label, payload: JSON.stringify(payload) }).changes > 0
  );
}

export function deleteInsightsByUserId(userId: number, db: Database = getDb()): number {
  return db.prepare("DELETE FROM ai_insights WHERE user_id = ?").run(userId).changes;
}

export function insertInsightEvent(
  userId: number,
  insightId: number,
  eventType: EventType,
  detail: unknown,
  db: Database = getDb(),
): void {
  db.prepare(
    "INSERT INTO ai_insight_events (insight_id, user_id, event_type, detail) VALUES (?, ?, ?, ?)",
  ).run(insightId, userId, eventType, detail === undefined ? null : JSON.stringify(detail));
}

export interface AiInsightEventRow {
  id: number;
  insightId: number;
  eventType: EventType;
  detail: unknown;
  createdAt: string;
}

export function listEventsByUserId(userId: number, db: Database = getDb()): AiInsightEventRow[] {
  const rows = db
    .prepare(
      "SELECT id, insight_id, event_type, detail, created_at FROM ai_insight_events WHERE user_id = ? ORDER BY id DESC",
    )
    .all(userId) as { id: number; insight_id: number; event_type: EventType; detail: string | null; created_at: string }[];
  return rows.map((row) => ({
    id: row.id,
    insightId: row.insight_id,
    eventType: row.event_type,
    detail: row.detail ? JSON.parse(row.detail) : null,
    createdAt: row.created_at,
  }));
}
