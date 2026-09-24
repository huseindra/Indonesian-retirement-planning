"use client";

import { useActionState } from "react";
import { editInsightAction } from "@/app/actions/ai-insights";
import type { FormState } from "@/app/actions/types";
import { ErrorAlert } from "@/components/forms/alerts";
import { Field, inputClass } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { AgeInput, PercentInput } from "@/components/forms/suffixed-input";
import { Icon } from "@/components/icons";
import type { ActionPayload, ActionType } from "@/lib/domain/ai-insights";

function toInput(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function percentInput(value: unknown): string {
  return value === null || value === undefined ? "" : String(Number(value) / 100);
}

/**
 * Inline edit form for a suggestion's proposed action. The observation and
 * reasoning text are the AI's own explanation and are not editable — only
 * the concrete values the action would write are.
 */
export function EditPanel({
  insightId,
  actionType,
  label,
  payload,
  onCancel,
}: {
  insightId: number;
  actionType: ActionType;
  label: string;
  payload: ActionPayload;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState<string>, FormData>(editInsightAction, {
    errors: {},
    formError: null,
    values: {},
  });
  const v: Record<string, unknown> = { ...(payload as Record<string, unknown>), actionLabel: label, ...state.values };

  return (
    <form action={formAction} className="mt-4 space-y-4 rounded-xl border border-line bg-canvas/60 p-4">
      <input type="hidden" name="id" value={insightId} />
      {state.formError ? <ErrorAlert>{state.formError}</ErrorAlert> : null}

      <Field name="actionLabel" label="Action summary" error={state.errors.actionLabel}>
        <input id="actionLabel" name="actionLabel" type="text" defaultValue={toInput(v.actionLabel)} maxLength={140} className={inputClass} />
      </Field>

      {actionType === "create_scenario" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="name" label="Scenario name" error={state.errors.name}>
            <input id="name" name="name" type="text" defaultValue={toInput(v.name)} maxLength={60} className={inputClass} />
          </Field>
          <Field name="retirementAge" label="Retirement age" optional hint="Blank = your plan's age" error={state.errors.retirementAge}>
            <AgeInput name="retirementAge" defaultValue={toInput(v.retirementAge)} error={state.errors.retirementAge} hasHint />
          </Field>
          <Field name="monthlySpending" label="Monthly spending" optional hint="Blank = your plan's spending" error={state.errors.monthlySpending}>
            <MoneyInput name="monthlySpending" defaultValue={toInput(v.monthlySpending)} error={state.errors.monthlySpending} hasHint />
          </Field>
          <Field name="retirementYears" label="Retirement duration" optional hint="Years; blank = your plan's duration" error={state.errors.retirementYears}>
            <AgeInput name="retirementYears" defaultValue={toInput(v.retirementYears)} error={state.errors.retirementYears} hasHint />
          </Field>
          <Field name="inflationBps" label="Inflation" optional hint="Blank = your plan's rate" error={state.errors.inflationBps}>
            <PercentInput name="inflationBps" defaultValue={percentInput(v.inflationBps)} error={state.errors.inflationBps} hasHint />
          </Field>
          <Field name="investmentReturnBps" label="Investment return" optional hint="Blank = your plan's rate" error={state.errors.investmentReturnBps}>
            <PercentInput name="investmentReturnBps" defaultValue={percentInput(v.investmentReturnBps)} error={state.errors.investmentReturnBps} hasHint />
          </Field>
        </div>
      ) : actionType === "update_assumptions" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="inflationBps" label="Proposed inflation" optional hint="Blank = leave unchanged" error={state.errors.inflationBps}>
            <PercentInput name="inflationBps" defaultValue={percentInput(v.inflationBps)} error={state.errors.inflationBps} hasHint />
          </Field>
          <Field name="investmentReturnBps" label="Proposed investment return" optional hint="Blank = leave unchanged" error={state.errors.investmentReturnBps}>
            <PercentInput name="investmentReturnBps" defaultValue={percentInput(v.investmentReturnBps)} error={state.errors.investmentReturnBps} hasHint />
          </Field>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? <Icon name="spinner" className="size-4 animate-spin" /> : null}
          {pending ? "Saving…" : "Save edit"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-semibold hover:bg-canvas"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
