"use client";

import { useActionState } from "react";
import { applyInsightAction } from "@/app/actions/ai-insights";
import type { FormState } from "@/app/actions/types";
import { ErrorAlert } from "@/components/forms/alerts";
import { Icon } from "@/components/icons";
import type { ActionPayload, ActionType } from "@/lib/domain/ai-insights";
import { formatRupiah } from "@/lib/format/currency";
import { formatRate } from "@/lib/projection/compound";

function Row({ label, from, to }: { label: string; from?: string; to: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">
        {from ? <span className="text-muted line-through">{from}</span> : null} {from ? "→ " : ""}
        {to}
      </dd>
    </div>
  );
}

interface CreateScenarioPayload {
  name: string;
  retirementAge: number | null;
  monthlySpending: number | null;
  inflationBps: number | null;
  investmentReturnBps: number | null;
  retirementYears: number | null;
}
interface UpdateAssumptionsPayload {
  inflationBps: number | null;
  investmentReturnBps: number | null;
}

/**
 * Shows exactly what applying this suggestion would write before it
 * happens, and requires an explicit confirmation — the only place an AI
 * insight can change saved data, and only after the user has already
 * accepted it.
 */
export function ApplyPanel({
  insightId,
  actionType,
  payload,
  currentAssumptions,
}: {
  insightId: number;
  actionType: ActionType;
  payload: ActionPayload;
  currentAssumptions: { inflationBps: number; investmentReturnBps: number } | null;
}) {
  const [state, formAction, pending] = useActionState<FormState<string>, FormData>(applyInsightAction, {
    errors: {},
    formError: null,
    values: {},
  });

  return (
    <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-900">
        <Icon name="info" className="size-4" />
        Review before applying
      </p>

      <dl className="mt-2 divide-y divide-brand-100">
        {actionType === "create_scenario" ? <CreateScenarioPreview payload={payload as unknown as CreateScenarioPayload} /> : null}
        {actionType === "update_assumptions" ? (
          <UpdateAssumptionsPreview payload={payload as unknown as UpdateAssumptionsPayload} current={currentAssumptions} />
        ) : null}
      </dl>

      <form action={formAction} className="mt-3">
        <input type="hidden" name="id" value={insightId} />
        {state.formError ? (
          <div className="mb-3">
            <ErrorAlert>{state.formError}</ErrorAlert>
          </div>
        ) : null}
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="confirm" className="mt-0.5 size-4 accent-brand-600" />
          <span>
            I understand this will {actionType === "create_scenario" ? "create a new scenario" : "change my saved economic assumptions"}.
          </span>
        </label>
        {state.errors.confirm ? <p className="mt-1 text-sm text-red-700">{state.errors.confirm}</p> : null}

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? <Icon name="spinner" className="size-4 animate-spin" /> : null}
          {pending ? "Applying…" : "Apply to my plan"}
        </button>
      </form>
    </div>
  );
}

function CreateScenarioPreview({ payload }: { payload: CreateScenarioPayload }) {
  return (
    <>
      <Row label="New scenario name" to={payload.name} />
      {payload.retirementAge !== null ? <Row label="Retirement age" to={`${payload.retirementAge}`} /> : null}
      {payload.monthlySpending !== null ? <Row label="Monthly spending" to={formatRupiah(payload.monthlySpending)} /> : null}
      {payload.retirementYears !== null ? <Row label="Retirement duration" to={`${payload.retirementYears} years`} /> : null}
      {payload.inflationBps !== null ? <Row label="Inflation" to={formatRate(payload.inflationBps)} /> : null}
      {payload.investmentReturnBps !== null ? <Row label="Investment return" to={formatRate(payload.investmentReturnBps)} /> : null}
      <p className="pt-2 text-xs text-brand-800">
        Every field left out uses your baseline plan&apos;s value. This never changes your saved plan — it only creates a
        new, separate scenario.
      </p>
    </>
  );
}

function UpdateAssumptionsPreview({
  payload,
  current,
}: {
  payload: UpdateAssumptionsPayload;
  current: { inflationBps: number; investmentReturnBps: number } | null;
}) {
  return (
    <>
      {payload.inflationBps !== null ? (
        <Row label="Inflation" from={current ? formatRate(current.inflationBps) : undefined} to={formatRate(payload.inflationBps)} />
      ) : null}
      {payload.investmentReturnBps !== null ? (
        <Row
          label="Investment return"
          from={current ? formatRate(current.investmentReturnBps) : undefined}
          to={formatRate(payload.investmentReturnBps)}
        />
      ) : null}
      <p className="pt-2 text-xs text-brand-800">
        Any rate left out stays exactly as saved. This changes your saved assumptions, which every page&apos;s projections
        use.
      </p>
    </>
  );
}
