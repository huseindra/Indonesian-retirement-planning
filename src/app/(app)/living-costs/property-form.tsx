"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveTargetPropertyAction } from "@/app/actions/cost-projection";
import type { FormState } from "@/app/actions/types";
import { ErrorAlert } from "@/components/forms/alerts";
import { Field, FormSection, describedBy, inputClass } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { MoneyInput } from "@/components/forms/money-input";
import { AgeInput, PercentInput } from "@/components/forms/suffixed-input";
import { usePreservingSubmit } from "@/components/forms/use-preserving-submit";
import { PROPERTY_LIMITS } from "@/lib/domain/assumptions";
import type { PropertyField } from "@/lib/validation/cost-projection";

export interface PropertyFormDefaults {
  name: string;
  currentPrice: string;
  purchaseAge: string;
  growthBps: string;
}

export function PropertyForm({
  defaults,
  isNew,
  currentAge,
  assumedGrowth,
}: {
  defaults: PropertyFormDefaults;
  isNew: boolean;
  currentAge: number;
  /** The housing-growth assumption, e.g. "5,00%", used when growth is blank. */
  assumedGrowth: string;
}) {
  const [state, formAction, pending] = useActionState<FormState<PropertyField>, FormData>(saveTargetPropertyAction, {
    errors: {},
    formError: null,
    values: {},
  });
  const values = { ...defaults, ...state.values } as PropertyFormDefaults;
  const errors = state.errors;
  const alertRef = useRef<HTMLDivElement>(null);
  const onSubmit = usePreservingSubmit(formAction);

  useEffect(() => {
    if (state.formError) alertRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-6">
      {state.formError ? (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <ErrorAlert id="property-form-error">
            <p className="font-medium">{state.formError}</p>
          </ErrorAlert>
        </div>
      ) : null}

      <fieldset disabled={pending}>
        <FormSection title="Target property" description="Use today's asking price for a comparable home.">
          <div className="sm:col-span-2">
            <Field name="name" label="Description" error={errors.name}>
              <input
                id="name"
                name="name"
                type="text"
                maxLength={PROPERTY_LIMITS.maxNameLength}
                autoComplete="off"
                placeholder="e.g. 3-bedroom house in Depok"
                defaultValue={values.name}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={describedBy("name", false, errors.name)}
                className={inputClass}
              />
            </Field>
          </div>
          <Field name="currentPrice" label="Current property price" error={errors.currentPrice}>
            <MoneyInput name="currentPrice" defaultValue={values.currentPrice} error={errors.currentPrice} />
          </Field>
          <Field
            name="purchaseAge"
            label="Expected purchase age"
            hint={`You are ${currentAge} now.`}
            error={errors.purchaseAge}
          >
            <AgeInput name="purchaseAge" defaultValue={values.purchaseAge} error={errors.purchaseAge} hasHint />
          </Field>
          <Field
            name="growthBps"
            label="Expected annual property-price growth"
            optional
            hint={`Leave blank to use your housing-growth assumption (${assumedGrowth}).`}
            error={errors.growthBps}
          >
            <PercentInput
              name="growthBps"
              defaultValue={values.growthBps}
              error={errors.growthBps}
              placeholder={assumedGrowth.replace("%", "")}
              hasHint
            />
          </Field>
        </FormSection>
      </fieldset>

      <FormActions
        pending={pending}
        submitLabel={isNew ? "Add property" : "Save changes"}
        pendingLabel="Saving…"
        cancelHref="/living-costs"
      />
    </form>
  );
}
