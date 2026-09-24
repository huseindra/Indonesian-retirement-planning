"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveAssumptionsAction } from "@/app/actions/cost-projection";
import type { FormState } from "@/app/actions/types";
import { ErrorAlert } from "@/components/forms/alerts";
import { Field, FormSection } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { PercentInput } from "@/components/forms/suffixed-input";
import { usePreservingSubmit } from "@/components/forms/use-preserving-submit";
import {
  ASSUMPTION_DESCRIPTIONS,
  ASSUMPTION_LABELS,
  type AssumptionKey,
} from "@/lib/domain/assumptions";

const KEYS: AssumptionKey[] = ["inflationBps", "housingGrowthBps", "investmentReturnBps"];

export function AssumptionsForm({
  defaults,
  demoDefaults,
}: {
  /** Current values as editable percentage strings, e.g. "3". */
  defaults: Record<AssumptionKey, string>;
  /** Demo default for each rate, shown as a hint, e.g. "3,00%". */
  demoDefaults: Record<AssumptionKey, string>;
}) {
  const [state, formAction, pending] = useActionState<FormState<AssumptionKey>, FormData>(saveAssumptionsAction, {
    errors: {},
    formError: null,
    values: {},
  });
  const values = { ...defaults, ...state.values } as Record<AssumptionKey, string>;
  const alertRef = useRef<HTMLDivElement>(null);
  const onSubmit = usePreservingSubmit(formAction);

  useEffect(() => {
    if (state.formError) alertRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-6">
      {state.formError ? (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <ErrorAlert id="assumptions-form-error">
            <p className="font-medium">{state.formError}</p>
          </ErrorAlert>
        </div>
      ) : null}

      <fieldset disabled={pending}>
        <FormSection
          title="Annual rates"
          description="Enter percentages per year. Decimals are fine: 3,5 or 3.5."
        >
          {KEYS.map((key) => (
            <Field
              key={key}
              name={key}
              label={ASSUMPTION_LABELS[key]}
              hint={`${ASSUMPTION_DESCRIPTIONS[key]} Demo default: ${demoDefaults[key]}.`}
              error={state.errors[key]}
            >
              <PercentInput name={key} defaultValue={values[key]} error={state.errors[key]} hasHint />
            </Field>
          ))}
        </FormSection>
      </fieldset>

      <FormActions pending={pending} submitLabel="Save assumptions" pendingLabel="Saving…" cancelHref="/living-costs" />
    </form>
  );
}
