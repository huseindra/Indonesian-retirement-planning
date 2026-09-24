"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveScenarioAction } from "@/app/actions/scenarios";
import type { FormState } from "@/app/actions/types";
import { ErrorAlert } from "@/components/forms/alerts";
import { Field, FormSection, describedBy, inputClass } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { MoneyInput } from "@/components/forms/money-input";
import { AgeInput, PercentInput } from "@/components/forms/suffixed-input";
import { usePreservingSubmit } from "@/components/forms/use-preserving-submit";
import { SCENARIO_LIMITS } from "@/lib/domain/scenarios";
import type { ScenarioField } from "@/lib/validation/scenarios";

export interface ScenarioFormDefaults {
  id?: number;
  name: string;
  description: string;
  retirementAge: string;
  monthlySpending: string;
  inflationBps: string;
  investmentReturnBps: string;
  retirementYears: string;
  includeProperty: boolean;
  propertyPrice: string;
  propertyPurchaseAge: string;
  propertyGrowthBps: string;
}

/** Baseline values shown next to each field, already formatted for display. */
export interface BaselineHints {
  currentAge: number;
  retirementAge: string;
  monthlySpending: string;
  inflation: string;
  investmentReturn: string;
  retirementYears: string;
  property: { price: string; purchaseAge: string; growth: string } | null;
  housingGrowth: string;
}

export function ScenarioForm({ defaults, baseline }: { defaults: ScenarioFormDefaults; baseline: BaselineHints }) {
  const [state, formAction, pending] = useActionState<FormState<ScenarioField>, FormData>(saveScenarioAction, {
    errors: {},
    formError: null,
    values: {},
  });
  const values = { ...defaults, ...state.values } as unknown as Record<keyof ScenarioFormDefaults, string>;
  const errors = state.errors;
  const [includeProperty, setIncludeProperty] = useState(defaults.includeProperty);
  const alertRef = useRef<HTMLDivElement>(null);
  const onSubmit = usePreservingSubmit(formAction);
  const isNew = defaults.id === undefined;

  useEffect(() => {
    if (state.formError) alertRef.current?.focus();
  }, [state]);

  const planHint = (value: string) => `Leave blank to use your plan: ${value}.`;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-6">
      {isNew ? null : <input type="hidden" name="id" value={defaults.id} />}

      {state.formError ? (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <ErrorAlert id="scenario-form-error">
            <p className="font-medium">{state.formError}</p>
          </ErrorAlert>
        </div>
      ) : null}

      <fieldset disabled={pending} className="space-y-6">
        <FormSection title="Scenario" description="Name the set of assumptions you want to explore.">
          <Field name="name" label="Name" error={errors.name}>
            <input
              id="name"
              name="name"
              type="text"
              maxLength={SCENARIO_LIMITS.maxNameLength}
              autoComplete="off"
              placeholder="e.g. Retire at 55"
              defaultValue={values.name}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy("name", false, errors.name)}
              className={inputClass}
            />
          </Field>
          <Field name="description" label="Description" optional error={errors.description}>
            <input
              id="description"
              name="description"
              type="text"
              maxLength={SCENARIO_LIMITS.maxDescriptionLength}
              autoComplete="off"
              defaultValue={values.description}
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={describedBy("description", false, errors.description)}
              className={inputClass}
            />
          </Field>
        </FormSection>

        <FormSection
          title="Overrides"
          description="Only fill in what this scenario changes. Blank fields use your baseline plan, so the scenario stays linked to your profile."
        >
          <Field name="retirementAge" label="Target retirement age" optional hint={planHint(baseline.retirementAge)} error={errors.retirementAge}>
            <AgeInput name="retirementAge" defaultValue={values.retirementAge} error={errors.retirementAge} hasHint />
          </Field>
          <Field
            name="monthlySpending"
            label="Monthly retirement spending (today's Rupiah)"
            optional
            hint={planHint(baseline.monthlySpending)}
            error={errors.monthlySpending}
          >
            <MoneyInput name="monthlySpending" defaultValue={values.monthlySpending} error={errors.monthlySpending} hasHint />
          </Field>
          <Field name="inflationBps" label="Annual inflation" optional hint={planHint(baseline.inflation)} error={errors.inflationBps}>
            <PercentInput name="inflationBps" defaultValue={values.inflationBps} error={errors.inflationBps} hasHint />
          </Field>
          <Field
            name="investmentReturnBps"
            label="Expected investment return"
            optional
            hint={planHint(baseline.investmentReturn)}
            error={errors.investmentReturnBps}
          >
            <PercentInput name="investmentReturnBps" defaultValue={values.investmentReturnBps} error={errors.investmentReturnBps} hasHint />
          </Field>
          <Field
            name="retirementYears"
            label="Expected retirement duration"
            optional
            hint={`Years your money must last from retirement. ${planHint(baseline.retirementYears)}`}
            error={errors.retirementYears}
          >
            <AgeInput name="retirementYears" defaultValue={values.retirementYears} error={errors.retirementYears} hasHint />
          </Field>
        </FormSection>

        <fieldset className="rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-6">
          <legend className="sr-only">Target property purchase</legend>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="includeProperty"
              checked={includeProperty}
              onChange={(e) => setIncludeProperty(e.target.checked)}
              className="mt-1 size-4 accent-brand-600"
            />
            <span>
              <span className="block text-base font-semibold">Include a target property purchase</span>
              <span className="block text-sm text-muted">
                The price at the purchase age is paid from your savings before retirement.{" "}
                {baseline.property
                  ? "Blank fields use your target property from Living Costs."
                  : "You have no target property yet, so set a price and purchase age."}
              </span>
            </span>
          </label>

          {includeProperty ? (
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                name="propertyPrice"
                label="Property price today"
                optional={baseline.property !== null}
                hint={baseline.property ? planHint(baseline.property.price) : undefined}
                error={errors.propertyPrice}
              >
                <MoneyInput name="propertyPrice" defaultValue={values.propertyPrice} error={errors.propertyPrice} hasHint={baseline.property !== null} />
              </Field>
              <Field
                name="propertyPurchaseAge"
                label="Property purchase age"
                optional={baseline.property !== null}
                hint={`You are ${baseline.currentAge} now.${baseline.property ? ` ${planHint(baseline.property.purchaseAge)}` : ""}`}
                error={errors.propertyPurchaseAge}
              >
                <AgeInput name="propertyPurchaseAge" defaultValue={values.propertyPurchaseAge} error={errors.propertyPurchaseAge} hasHint />
              </Field>
              <Field
                name="propertyGrowthBps"
                label="Property-price growth"
                optional
                hint={planHint(baseline.property?.growth ?? baseline.housingGrowth)}
                error={errors.propertyGrowthBps}
              >
                <PercentInput name="propertyGrowthBps" defaultValue={values.propertyGrowthBps} error={errors.propertyGrowthBps} hasHint />
              </Field>
            </div>
          ) : null}
        </fieldset>
      </fieldset>

      <FormActions
        pending={pending}
        submitLabel={isNew ? "Create scenario" : "Save & recalculate"}
        pendingLabel="Calculating…"
        cancelHref={isNew ? "/scenarios" : `/scenarios/${defaults.id}`}
      />
    </form>
  );
}
