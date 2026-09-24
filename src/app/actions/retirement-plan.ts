"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { saveRetirementSettings } from "@/lib/services/retirement-plan";
import type { RetirementSettingsField } from "@/lib/validation/retirement-plan";
import type { FormState } from "./types";

export async function saveRetirementSettingsAction(
  _prev: FormState<RetirementSettingsField>,
  formData: FormData,
): Promise<FormState<RetirementSettingsField>> {
  const user = await requireUser();
  const values = { planUntilAge: String(formData.get("planUntilAge") ?? "") };

  try {
    const result = saveRetirementSettings(user.id, values);
    if (!result.ok) {
      return { errors: result.errors ?? {}, formError: result.formError ?? null, values };
    }
  } catch (error) {
    console.error("Saving retirement settings failed", error);
    return { errors: {}, formError: "Something went wrong while saving. Please try again.", values };
  }

  revalidatePath("/retirement-plan");
  revalidatePath("/dashboard");
  redirect("/retirement-plan?status=settings-saved");
}
