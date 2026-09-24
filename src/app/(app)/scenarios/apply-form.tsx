"use client";

import { useActionState } from "react";
import { applyScenarioAction } from "@/app/actions/scenarios";
import type { FormState } from "@/app/actions/types";
import { ErrorAlert } from "@/components/forms/alerts";
import { Icon } from "@/components/icons";

export interface ApplyOption {
  field: string;
  label: string;
  /** e.g. "58 → 55" */
  change: string;
}

/**
 * The only way a scenario can change the baseline plan: the user ticks the
 * values to copy and confirms. Nothing is pre-selected.
 */
export function ApplyForm({ scenarioId, options }: { scenarioId: number; options: ApplyOption[] }) {
  const [state, formAction, pending] = useActionState<FormState<"fields">, FormData>(applyScenarioAction, {
    errors: {},
    formError: null,
    values: {},
  });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={scenarioId} />
      {state.formError ? <ErrorAlert>{state.formError}</ErrorAlert> : null}

      <fieldset>
        <legend className="text-sm font-medium">Values to copy into your plan</legend>
        <ul className="mt-2 space-y-2">
          {options.map((option) => (
            <li key={option.field}>
              <label className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5 text-sm hover:bg-canvas">
                <input type="checkbox" name="fields" value={option.field} className="mt-0.5 size-4 accent-brand-600" />
                <span>
                  <span className="block font-medium">{option.label}</span>
                  <span className="block text-xs text-muted">{option.change}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="confirm" className="mt-0.5 size-4 accent-brand-600" />
        <span>I understand this overwrites the selected values in my saved plan.</span>
      </label>
      {state.errors.fields ? <p className="text-sm text-red-700">{state.errors.fields}</p> : null}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-600 bg-surface px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? <Icon name="spinner" className="size-4 animate-spin" /> : null}
        {pending ? "Applying…" : "Apply selected to my plan"}
      </button>
    </form>
  );
}
