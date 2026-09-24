"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveProfileAction, type FormState } from "@/app/actions/financial-profile";
import { ErrorAlert } from "@/components/forms/alerts";
import { Field, FormSection, describedBy, inputClass } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { MoneyInput } from "@/components/forms/money-input";
import { usePreservingSubmit } from "@/components/forms/use-preserving-submit";
import {
  HOUSING_STATUSES,
  HOUSING_STATUS_LABELS,
  LIMITS,
  isHousingStatus,
  type HousingStatus,
} from "@/lib/domain/financial-profile";
import type { ProfileField } from "@/lib/validation/financial-profile";

export interface ProfileFormDefaults {
  currentAge: string;
  targetRetirementAge: string;
  monthlyIncome: string;
  monthlyExpenses: string;
  housingStatus: HousingStatus | "";
  propertyValue: string;
  monthlyRent: string;
  city: string;
}

const HOUSING_HINTS: Record<HousingStatus, string> = {
  own: "We'll ask for the current market value of your home.",
  rent: "We'll ask for your monthly rent.",
  family: "No housing cost is recorded.",
};

const FIELD_ORDER: ProfileField[] = [
  "currentAge",
  "targetRetirementAge",
  "monthlyIncome",
  "monthlyExpenses",
  "housingStatus",
  "propertyValue",
  "monthlyRent",
  "city",
];

export function ProfileForm({ defaults, isNew }: { defaults: ProfileFormDefaults; isNew: boolean }) {
  const [state, formAction, pending] = useActionState<FormState<ProfileField>, FormData>(
    saveProfileAction,
    { errors: {}, formError: null, values: {} },
  );
  const values = { ...defaults, ...state.values } as ProfileFormDefaults;
  const errors = state.errors;

  const [housingStatus, setHousingStatus] = useState<HousingStatus | "">(defaults.housingStatus);
  const alertRef = useRef<HTMLDivElement>(null);
  const onSubmit = usePreservingSubmit(formAction);

  // Move focus to the error summary after a failed save so screen-reader
  // and keyboard users land on what needs fixing.
  useEffect(() => {
    if (state.formError) alertRef.current?.focus();
  }, [state]);

  const errorList = FIELD_ORDER.filter((field) => errors[field]);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-6">
      {state.formError ? (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <ErrorAlert id="profile-form-error">
            <p className="font-medium">{state.formError}</p>
            {errorList.length > 0 ? (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                {errorList.map((field) => (
                  <li key={field}>
                    <a href={`#${field === "housingStatus" ? "housingStatus-own" : field}`} className="underline">
                      {errors[field]}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </ErrorAlert>
        </div>
      ) : null}

      <fieldset disabled={pending} className="space-y-6">
        <FormSection title="Personal information" description="Used to work out how long you have until retirement.">
          <Field name="currentAge" label="Current age" error={errors.currentAge}>
            <AgeInput name="currentAge" defaultValue={values.currentAge} error={errors.currentAge} />
          </Field>
          <Field
            name="targetRetirementAge"
            label="Target retirement age"
            hint="For reference, the BPJS Jaminan Pensiun age is 59 from 2025."
            error={errors.targetRetirementAge}
          >
            <AgeInput
              name="targetRetirementAge"
              defaultValue={values.targetRetirementAge}
              error={errors.targetRetirementAge}
              hasHint
            />
          </Field>
          <Field name="city" label="City" optional error={errors.city}>
            <input
              id="city"
              name="city"
              type="text"
              autoComplete="address-level2"
              maxLength={LIMITS.maxCityLength}
              defaultValue={values.city}
              aria-invalid={errors.city ? true : undefined}
              aria-describedby={describedBy("city", false, errors.city)}
              className={inputClass}
            />
          </Field>
        </FormSection>

        <FormSection title="Monthly finances" description="Amounts in Rupiah per month.">
          <Field
            name="monthlyIncome"
            label="Monthly income"
            hint="Take-home pay after tax, plus any other regular income."
            error={errors.monthlyIncome}
          >
            <MoneyInput name="monthlyIncome" defaultValue={values.monthlyIncome} error={errors.monthlyIncome} hasHint />
          </Field>
          <Field
            name="monthlyExpenses"
            label="Monthly living expenses"
            hint="Food, transport, utilities, school fees and so on — excluding rent."
            error={errors.monthlyExpenses}
          >
            <MoneyInput
              name="monthlyExpenses"
              defaultValue={values.monthlyExpenses}
              error={errors.monthlyExpenses}
              hasHint
            />
          </Field>
        </FormSection>

        <fieldset
          aria-describedby={errors.housingStatus ? "housingStatus-error" : undefined}
          className="rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-6"
        >
          <legend className="sr-only">Housing</legend>
          <h2 aria-hidden="true" className="text-base font-semibold">
            Housing
          </h2>
          <p className="mt-1 text-sm text-muted">Your current living situation.</p>

          <div role="radiogroup" aria-label="Current housing status" className="mt-5 grid gap-3 sm:grid-cols-3">
            {HOUSING_STATUSES.map((status) => (
              <label
                key={status}
                htmlFor={`housingStatus-${status}`}
                className={[
                  "flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors",
                  housingStatus === status
                    ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                    : errors.housingStatus
                      ? "border-red-400"
                      : "border-line hover:border-brand-200",
                ].join(" ")}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <input
                    id={`housingStatus-${status}`}
                    type="radio"
                    name="housingStatus"
                    value={status}
                    checked={housingStatus === status}
                    onChange={(event) =>
                      setHousingStatus(isHousingStatus(event.target.value) ? event.target.value : "")
                    }
                    className="size-4 accent-brand-600"
                  />
                  {HOUSING_STATUS_LABELS[status]}
                </span>
                <span className="pl-6 text-xs text-muted">{HOUSING_HINTS[status]}</span>
              </label>
            ))}
          </div>
          {errors.housingStatus ? (
            <p id="housingStatus-error" className="mt-2 text-sm text-red-700">
              {errors.housingStatus}
            </p>
          ) : null}

          {housingStatus === "own" ? (
            <div className="mt-5 sm:max-w-sm">
              <Field
                name="propertyValue"
                label="Current property value"
                hint="Estimated market value today."
                error={errors.propertyValue}
              >
                <MoneyInput
                  name="propertyValue"
                  defaultValue={values.propertyValue}
                  error={errors.propertyValue}
                  hasHint
                />
              </Field>
            </div>
          ) : null}
          {housingStatus === "rent" ? (
            <div className="mt-5 sm:max-w-sm">
              <Field name="monthlyRent" label="Monthly rent" error={errors.monthlyRent}>
                <MoneyInput name="monthlyRent" defaultValue={values.monthlyRent} error={errors.monthlyRent} />
              </Field>
            </div>
          ) : null}
        </fieldset>
      </fieldset>

      <FormActions
        pending={pending}
        submitLabel={isNew ? "Create profile" : "Save changes"}
        pendingLabel="Saving…"
        cancelHref="/financial-profile"
      />
    </form>
  );
}

function AgeInput({
  name,
  defaultValue,
  error,
  hasHint = false,
}: {
  name: string;
  defaultValue: string;
  error?: string;
  hasHint?: boolean;
}) {
  return (
    <div className="relative">
      <input
        id={name}
        name={name}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={3}
        autoComplete="off"
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hasHint, error)}
        className={`${inputClass} pr-16 tabular-nums`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-sm text-muted"
      >
        years
      </span>
    </div>
  );
}
