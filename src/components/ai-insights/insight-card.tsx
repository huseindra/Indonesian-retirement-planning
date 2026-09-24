"use client";

import Link from "next/link";
import { useState } from "react";
import { acceptInsightAction, dismissInsightAction, rejectInsightAction } from "@/app/actions/ai-insights";
import { ActionButton } from "@/components/action-button";
import { Icon } from "@/components/icons";
import { INSIGHT_KIND_LABELS } from "@/lib/domain/ai-insights";
import type { AiInsightRow } from "@/lib/repositories/ai-insights";
import { AiBadge, ConfidenceBadge, StatusBadge } from "./badges";
import { ApplyPanel } from "./apply-panel";
import { EditPanel } from "./edit-panel";

const ACTION_TYPE_LABEL: Record<string, string> = {
  create_scenario: "Proposes creating a new scenario",
  update_assumptions: "Proposes changing your saved assumptions",
  none: "Informational — no data change proposed",
};

export function InsightCard({
  insight,
  currentAssumptions,
  appliedScenarioId,
}: {
  insight: AiInsightRow;
  currentAssumptions: { inflationBps: number; investmentReturnBps: number } | null;
  appliedScenarioId?: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const isOpen = insight.status === "pending" || insight.status === "edited";
  const isTerminal = insight.status === "rejected" || insight.status === "dismissed";
  const effectiveLabel = insight.editedActionLabel ?? insight.actionLabel;
  const effectivePayload = insight.editedActionPayload ?? insight.actionPayload;

  return (
    <article
      className={`rounded-2xl border p-5 shadow-xs sm:p-6 ${isTerminal ? "border-line bg-canvas/40 opacity-75" : "border-line bg-surface"}`}
      data-testid="insight-card"
      data-status={insight.status}
    >
      <div className="flex flex-wrap items-center gap-2">
        <AiBadge />
        <span className="text-xs font-medium text-muted">{INSIGHT_KIND_LABELS[insight.kind]}</span>
        <ConfidenceBadge confidence={insight.confidence} />
        <StatusBadge status={insight.status} />
      </div>

      <p className="mt-3 text-base font-semibold text-ink">{insight.observation}</p>
      <p className="mt-1.5 text-sm text-muted">{insight.reasoning}</p>

      {insight.citedValues.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-medium text-ink">From your calculations:</span>
          {insight.citedValues.map((value, i) => (
            <span key={i} className="rounded-full bg-canvas px-2 py-0.5 font-mono text-ink ring-1 ring-line">
              {value}
            </span>
          ))}
        </div>
      ) : null}

      {insight.actionType !== "none" ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
          <Icon name="info" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <span className="font-medium text-ink">{effectiveLabel}</span>
            {insight.status === "edited" ? <span className="ml-1.5 italic">(edited by you)</span> : null}
            <span className="block">{ACTION_TYPE_LABEL[insight.actionType]}</span>
          </span>
        </p>
      ) : null}

      {isTerminal ? (
        <p className="mt-4 text-xs text-muted">
          {insight.status === "rejected" ? "You rejected this suggestion." : "You dismissed this suggestion."} Nothing
          in your saved plan was changed.
        </p>
      ) : null}

      {insight.status === "applied" ? (
        <p className="mt-4 text-xs text-brand-800">
          Applied to your saved plan.
          {appliedScenarioId ? (
            <>
              {" "}
              <Link href={`/scenarios/${appliedScenarioId}`} className="font-semibold underline">
                View the new scenario
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : null}

      {isOpen ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton action={acceptInsightAction} hiddenFields={{ id: insight.id }} label="Accept" pendingLabel="Accepting…" size="sm" />
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-canvas"
          >
            <Icon name="pencil" className="size-4" />
            {editing ? "Close edit" : "Edit"}
          </button>
          <ActionButton action={rejectInsightAction} hiddenFields={{ id: insight.id }} label="Reject" pendingLabel="Rejecting…" size="sm" />
          <ActionButton action={dismissInsightAction} hiddenFields={{ id: insight.id }} label="Dismiss" pendingLabel="Dismissing…" size="sm" />
        </div>
      ) : null}

      {insight.status === "accepted" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton action={rejectInsightAction} hiddenFields={{ id: insight.id }} label="Reject instead" pendingLabel="Rejecting…" size="sm" />
        </div>
      ) : null}

      {editing && insight.actionType !== "none" ? (
        <EditPanel
          insightId={insight.id}
          actionType={insight.actionType}
          label={effectiveLabel}
          payload={effectivePayload}
          onCancel={() => setEditing(false)}
        />
      ) : null}

      {insight.status === "accepted" && insight.actionType !== "none" ? (
        <ApplyPanel insightId={insight.id} actionType={insight.actionType} payload={effectivePayload} currentAssumptions={currentAssumptions} />
      ) : null}
    </article>
  );
}
