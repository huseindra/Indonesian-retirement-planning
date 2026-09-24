"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  createAsset,
  deleteFinancialData,
  removeAsset,
  saveFinancialProfile,
  updateAsset,
  type MutationResult,
} from "@/lib/services/financial-profile";
import type { AssetField, ProfileField } from "@/lib/validation/financial-profile";
import type { ProfileStatus } from "@/config/profile-status";
import type { DeleteState, FormState } from "./types";

export type { DeleteState, FormState } from "./types";

const PROFILE_PATH = "/financial-profile";
const UNEXPECTED = "Something went wrong while saving. Please try again.";

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

function done(status: ProfileStatus): never {
  revalidatePath(PROFILE_PATH, "layout");
  revalidatePath("/dashboard");
  redirect(`${PROFILE_PATH}?status=${status}`);
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

export async function saveProfileAction(
  _prev: FormState<ProfileField>,
  formData: FormData,
): Promise<FormState<ProfileField>> {
  const user = await requireUser();
  const values = formValues(formData);

  let result: ReturnType<typeof saveFinancialProfile>;
  try {
    result = saveFinancialProfile(user.id, values);
  } catch (error) {
    console.error("Saving financial profile failed", error);
    return { errors: {}, formError: UNEXPECTED, values };
  }

  if (!result.ok) return failure(result, values);
  done(result.created ? "profile-created" : "profile-updated");
}

export async function saveAssetAction(
  _prev: FormState<AssetField>,
  formData: FormData,
): Promise<FormState<AssetField>> {
  const user = await requireUser();
  const values = formValues(formData);
  const id = values.id ? Number(values.id) : null;

  let result: MutationResult<AssetField>;
  try {
    result =
      id === null
        ? createAsset(user.id, values)
        : Number.isInteger(id)
          ? updateAsset(user.id, id, values)
          : { ok: false, formError: "That record could not be found." };
  } catch (error) {
    console.error("Saving asset failed", error);
    return { errors: {}, formError: UNEXPECTED, values };
  }

  if (!result.ok) return failure(result, values);
  done(id === null ? "asset-added" : "asset-updated");
}

export async function deleteAssetAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await requireUser();
  const id = Number(formData.get("id"));

  try {
    const result = Number.isInteger(id) ? removeAsset(user.id, id) : null;
    if (!result?.ok) return { error: result?.formError ?? "That record could not be found." };
  } catch (error) {
    console.error("Deleting asset failed", error);
    return { error: "We couldn't delete this record. Please try again." };
  }
  done("asset-deleted");
}

export async function deleteProfileAction(): Promise<DeleteState> {
  const user = await requireUser();

  try {
    const result = deleteFinancialData(user.id);
    if (!result.ok) return { error: result.formError ?? "There is nothing to delete." };
  } catch (error) {
    console.error("Deleting financial profile failed", error);
    return { error: "We couldn't delete your financial profile. Please try again." };
  }
  done("profile-deleted");
}
