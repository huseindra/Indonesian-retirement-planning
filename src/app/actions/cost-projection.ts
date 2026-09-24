"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CostStatus } from "@/config/cost-status";
import { requireUser } from "@/lib/auth/session";
import type { AssumptionKey } from "@/lib/domain/assumptions";
import {
  getTargetProperty,
  removeTargetProperty,
  resetAssumptions,
  saveAssumptions,
  saveTargetProperty,
} from "@/lib/services/cost-projection";
import type { MutationResult } from "@/lib/services/financial-profile";
import type { PropertyField } from "@/lib/validation/cost-projection";
import type { DeleteState, FormState } from "./types";

const LIVING_COSTS_PATH = "/living-costs";
const UNEXPECTED = "Something went wrong while saving. Please try again.";

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

function done(status: CostStatus): never {
  revalidatePath(LIVING_COSTS_PATH, "layout");
  redirect(`${LIVING_COSTS_PATH}?status=${status}`);
}

function failure<K extends string>(
  result: Extract<MutationResult<K>, { ok: false }>,
  values: Record<string, string>,
): FormState<K> {
  return {
    errors: result.errors ?? {},
    formError:
      result.formError ??
      (result.errors ? "Please correct the highlighted fields and try again." : UNEXPECTED),
    values,
  };
}

export async function saveAssumptionsAction(
  _prev: FormState<AssumptionKey>,
  formData: FormData,
): Promise<FormState<AssumptionKey>> {
  const user = await requireUser();
  const values = formValues(formData);

  let result: MutationResult<AssumptionKey>;
  try {
    result = saveAssumptions(user.id, values);
  } catch (error) {
    console.error("Saving assumptions failed", error);
    return { errors: {}, formError: UNEXPECTED, values };
  }
  if (!result.ok) return failure(result, values);
  done("assumptions-saved");
}

export async function resetAssumptionsAction(): Promise<DeleteState> {
  const user = await requireUser();
  try {
    resetAssumptions(user.id);
  } catch (error) {
    console.error("Resetting assumptions failed", error);
    return { error: "We couldn't reset your assumptions. Please try again." };
  }
  done("assumptions-reset");
}

export async function saveTargetPropertyAction(
  _prev: FormState<PropertyField>,
  formData: FormData,
): Promise<FormState<PropertyField>> {
  const user = await requireUser();
  const values = formValues(formData);

  let result: MutationResult<PropertyField>;
  let existed: boolean;
  try {
    existed = getTargetProperty(user.id) !== null;
    result = saveTargetProperty(user.id, values);
  } catch (error) {
    console.error("Saving target property failed", error);
    return { errors: {}, formError: UNEXPECTED, values };
  }
  if (!result.ok) return failure(result, values);
  done(existed ? "property-updated" : "property-created");
}

export async function deleteTargetPropertyAction(): Promise<DeleteState> {
  const user = await requireUser();
  try {
    const result = removeTargetProperty(user.id);
    if (!result.ok) return { error: result.formError ?? "There is nothing to delete." };
  } catch (error) {
    console.error("Deleting target property failed", error);
    return { error: "We couldn't delete the target property. Please try again." };
  }
  done("property-deleted");
}
