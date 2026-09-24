"use client";

import { useActionState } from "react";
import { saveRetirementSettingsAction } from "@/app/actions/retirement-plan";
import type { FormState } from "@/app/actions/types";
import { ErrorAlert } from "@/components/forms/alerts";
import { Field } from "@/components/forms/field";
import { AgeInput } from "@/components/forms/suffixed-input";
import { usePreservingSubmit } from "@/components/forms/use-preserving-submit";
import { Icon } from "@/components/icons";
import type { RetirementSettingsField } from "@/lib/validation/retirement-plan";

export function SettingsForm({
  planUntilAge,
  retirementAge,
  isDefault,
}: {
  planUntilAge: number;
  retirementAge: number | null;
  isDefault: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState<RetirementSettingsField>, FormData>(
    saveRetirementSettingsAction,
    { errors: {}, formError: null, values: {} },
  );
  const onSubmit = usePreservingSubmit(formAction);
  const value = state.values.planUntilAge ?? String(planUntilAge);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-3">
      {state.formError ? <ErrorAlert>{state.formError}</ErrorAlert> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-64">
          <Field
            name="planUntilAge"
            label="Plan until age"
            hint={
              retirementAge === null
                ? "How long your retirement money should last."
                : `Must be after your retirement age (${retirementAge}).${isDefault ? " Default: 85." : ""}`
            }
            error={state.errors.planUntilAge}
          >
            <AgeInput name="planUntilAge" defaultValue={value} error={state.errors.planUntilAge} hasHint />
          </Field>
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-wait disabled:opacity-80 sm:mb-[1px]"
        >
          {pending ? <Icon name="spinner" className="size-4 animate-spin" /> : null}
          {pending ? "Recalculating…" : "Save & recalculate"}
        </button>
      </div>
    </form>
  );
}
