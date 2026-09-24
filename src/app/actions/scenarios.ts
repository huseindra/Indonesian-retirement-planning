"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ScenarioStatus } from "@/config/scenario-status";
import { requireUser } from "@/lib/auth/session";
import {
  addExampleScenarios,
  applyScenarioToBaseline,
  createScenario,
  deleteScenario,
  duplicateScenario,
  updateScenario,
} from "@/lib/services/scenarios";
import type { ScenarioField } from "@/lib/validation/scenarios";
import type { DeleteState, FormState } from "./types";

const UNEXPECTED = "Something went wrong. Please try again.";

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

function go(path: string, status: ScenarioStatus): never {
  revalidatePath("/scenarios", "layout");
  redirect(`${path}?status=${status}`);
}

export async function saveScenarioAction(
  _prev: FormState<ScenarioField>,
  formData: FormData,
): Promise<FormState<ScenarioField>> {
  const user = await requireUser();
  const values = formValues(formData);
  const id = values.id ? Number(values.id) : null;

  let targetId: number;
  try {
    if (id === null) {
      const result = createScenario(user.id, values);
      if (!result.ok) return failure(result, values);
      targetId = result.id!;
    } else {
      const result = updateScenario(user.id, id, values);
      if (!result.ok) return failure(result, values);
      targetId = id;
    }
  } catch (error) {
    console.error("Saving scenario failed", error);
    return { errors: {}, formError: UNEXPECTED, values };
  }
  go(`/scenarios/${targetId}`, id === null ? "created" : "updated");
}

function failure(
  result: { errors?: FormState<ScenarioField>["errors"]; formError?: string },
  values: Record<string, string>,
): FormState<ScenarioField> {
  return {
    errors: result.errors ?? {},
    formError: result.formError ?? "Please correct the highlighted fields and try again.",
    values,
  };
}

export async function deleteScenarioAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await requireUser();
  try {
    const result = deleteScenario(user.id, Number(formData.get("id")));
    if (!result.ok) return { error: result.formError ?? "That scenario could not be found." };
  } catch (error) {
    console.error("Deleting scenario failed", error);
    return { error: "We couldn't delete this scenario. Please try again." };
  }
  go("/scenarios", "deleted");
}

export async function duplicateScenarioAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await requireUser();
  let id: number;
  try {
    const result = duplicateScenario(user.id, Number(formData.get("id")));
    if (!result.ok) return { error: result.formError ?? "That scenario could not be found." };
    id = result.id!;
  } catch (error) {
    console.error("Duplicating scenario failed", error);
    return { error: "We couldn't duplicate this scenario. Please try again." };
  }
  go(`/scenarios/${id}/edit`, "duplicated");
}

export async function addExamplesAction(): Promise<DeleteState> {
  const user = await requireUser();
  try {
    addExampleScenarios(user.id);
  } catch (error) {
    console.error("Adding example scenarios failed", error);
    return { error: "We couldn't add the examples. Please try again." };
  }
  go("/scenarios", "examples-added");
}

export async function applyScenarioAction(
  _prev: FormState<"fields">,
  formData: FormData,
): Promise<FormState<"fields">> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const fields = formData.getAll("fields").map(String);
  if (formData.get("confirm") !== "on") {
    return {
      errors: { fields: "Tick the confirmation to change your baseline plan." },
      formError: "Nothing was changed. Confirm that you want to overwrite these values in your plan.",
      values: {},
    };
  }
  try {
    const result = applyScenarioToBaseline(user.id, id, fields);
    if (!result.ok) return { errors: {}, formError: result.formError ?? UNEXPECTED, values: {} };
  } catch (error) {
    console.error("Applying scenario failed", error);
    return { errors: {}, formError: UNEXPECTED, values: {} };
  }
  revalidatePath("/", "layout");
  redirect(`/scenarios/${id}?status=applied`);
}
