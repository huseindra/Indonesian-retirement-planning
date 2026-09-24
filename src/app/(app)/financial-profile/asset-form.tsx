"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveAssetAction, type FormState } from "@/app/actions/financial-profile";
import { ErrorAlert } from "@/components/forms/alerts";
import { Field, FormSection, describedBy, inputClass } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { MoneyInput } from "@/components/forms/money-input";
import {
  ASSET_CATEGORY_LABELS,
  ASSET_GROUPS,
  ASSET_GROUP_LABELS,
  LIMITS,
  categoriesInGroup,
  type AssetCategory,
} from "@/lib/domain/financial-profile";
import type { AssetField } from "@/lib/validation/financial-profile";

export interface AssetFormDefaults {
  id?: number;
  name: string;
  category: AssetCategory | "";
  institution: string;
  balance: string;
}

export function AssetForm({ defaults }: { defaults: AssetFormDefaults }) {
  const [state, formAction, pending] = useActionState<FormState<AssetField>, FormData>(
    saveAssetAction,
    { errors: {}, formError: null, values: {} },
  );
  const values = { ...defaults, ...state.values } as AssetFormDefaults;
  const errors = state.errors;
  const isNew = defaults.id === undefined;
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.formError) alertRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} noValidate className="space-y-6">
      {isNew ? null : <input type="hidden" name="id" value={defaults.id} />}

      {state.formError ? (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <ErrorAlert id="asset-form-error">
            <p className="font-medium">{state.formError}</p>
          </ErrorAlert>
        </div>
      ) : null}

      <fieldset disabled={pending}>
        <FormSection title="Asset details" description="Record the current balance in Rupiah.">
          <Field name="category" label="Type" error={errors.category}>
            <select
              id="category"
              name="category"
              defaultValue={values.category}
              aria-invalid={errors.category ? true : undefined}
              aria-describedby={describedBy("category", false, errors.category)}
              className={inputClass}
            >
              <option value="" disabled>
                Choose a type…
              </option>
              {ASSET_GROUPS.map((group) => (
                <optgroup key={group} label={ASSET_GROUP_LABELS[group]}>
                  {categoriesInGroup(group).map((category) => (
                    <option key={category} value={category}>
                      {ASSET_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>

          <Field
            name="name"
            label="Name"
            hint="Something you'll recognise, e.g. “BCA savings”."
            error={errors.name}
          >
            <input
              id="name"
              name="name"
              type="text"
              maxLength={LIMITS.maxNameLength}
              autoComplete="off"
              defaultValue={values.name}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy("name", true, errors.name)}
              className={inputClass}
            />
          </Field>

          <Field name="institution" label="Institution" optional error={errors.institution}>
            <input
              id="institution"
              name="institution"
              type="text"
              maxLength={LIMITS.maxNameLength}
              autoComplete="off"
              placeholder="Bank, broker or fund manager"
              defaultValue={values.institution}
              aria-invalid={errors.institution ? true : undefined}
              aria-describedby={describedBy("institution", false, errors.institution)}
              className={inputClass}
            />
          </Field>

          <Field name="balance" label="Current balance" error={errors.balance}>
            <MoneyInput name="balance" defaultValue={values.balance} error={errors.balance} />
          </Field>
        </FormSection>
      </fieldset>

      <FormActions
        pending={pending}
        submitLabel={isNew ? "Add asset" : "Save changes"}
        pendingLabel="Saving…"
        cancelHref="/financial-profile"
      />
    </form>
  );
}
