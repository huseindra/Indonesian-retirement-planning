"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  acceptInsight,
  applyInsightAction as applyInsightToPlan,
  dismissInsight,
  editInsight,
  generateInsights,
  rejectInsight,
} from "@/lib/services/ai-insights";
import type { DeleteState, FormState } from "./types";

const PATH = "/ai-insights";
const UNEXPECTED = "Something went wrong. Please try again.";

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

function go(status: string, extra: Record<string, string> = {}): never {
  revalidatePath(PATH);
  const params = new URLSearchParams({ status, ...extra });
  redirect(`${PATH}?${params.toString()}`);
}

/**
 * Runs a generation attempt and redirects with a status describing the
 * outcome — success (with a count), no insights, unavailable, an AI
 * error, or a problem with the baseline plan itself. Never throws: a
 * failed or unconfigured AI service always lands back on a working page.
 */
export async function generateInsightsAction(): Promise<void> {
  const user = await requireUser();
  let result: Awaited<ReturnType<typeof generateInsights>>;
  try {
    result = await generateInsights(user.id);
  } catch (error) {
    console.error("Generating AI insights failed", error);
    go("ai-error", { message: UNEXPECTED });
    return;
  }

  switch (result.status) {
    case "incomplete":
      go("incomplete");
      break;
    case "baseline_error":
      go("baseline-error", { message: result.message });
      break;
    case "unavailable":
      go("unavailable", { message: result.reason });
      break;
    case "ai_error":
      go("ai-error", { message: result.message });
      break;
    case "ready":
      go(result.count > 0 ? "generated" : "no-insights", { count: String(result.count) });
      break;
  }
}

export async function acceptInsightAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  try {
    const result = acceptInsight(user.id, id);
    if (!result.ok) return { error: result.formError ?? "That suggestion could not be found." };
  } catch (error) {
    console.error("Accepting insight failed", error);
    return { error: UNEXPECTED };
  }
  go("accepted");
}

export async function rejectInsightAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  try {
    const result = rejectInsight(user.id, id);
    if (!result.ok) return { error: result.formError ?? "That suggestion could not be found." };
  } catch (error) {
    console.error("Rejecting insight failed", error);
    return { error: UNEXPECTED };
  }
  go("rejected");
}

export async function dismissInsightAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  try {
    const result = dismissInsight(user.id, id);
    if (!result.ok) return { error: result.formError ?? "That suggestion could not be found." };
  } catch (error) {
    console.error("Dismissing insight failed", error);
    return { error: UNEXPECTED };
  }
  go("dismissed");
}

export async function editInsightAction(
  _prev: FormState<string>,
  formData: FormData,
): Promise<FormState<string>> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const values = formValues(formData);
  try {
    const result = editInsight(user.id, id, values);
    if (!result.ok) {
      return {
        errors: (result.errors as Record<string, string> | undefined) ?? {},
        formError: result.formError ?? "Please correct the highlighted fields and try again.",
        values,
      };
    }
  } catch (error) {
    console.error("Editing insight failed", error);
    return { errors: {}, formError: UNEXPECTED, values };
  }
  go("edited");
}

export async function applyInsightAction(
  _prev: FormState<string>,
  formData: FormData,
): Promise<FormState<string>> {
  const user = await requireUser();
  const id = Number(formData.get("id"));

  if (formData.get("confirm") !== "on") {
    return {
      errors: { confirm: "Confirm that you want to change your saved plan." },
      formError: "Nothing was changed. Confirm to apply this suggestion to your plan.",
      values: {},
    };
  }

  try {
    const result = applyInsightToPlan(user.id, id);
    if (!result.ok) {
      return {
        errors: (result.errors as Record<string, string> | undefined) ?? {},
        formError: result.formError ?? "Please correct the highlighted fields and try again.",
        values: {},
      };
    }
  } catch (error) {
    console.error("Applying insight failed", error);
    return { errors: {}, formError: UNEXPECTED, values: {} };
  }
  go("applied");
}
