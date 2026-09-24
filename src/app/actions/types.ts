import type { FieldErrors } from "@/lib/validation/common";

/** State shared by form server actions and their client forms. */
export interface FormState<K extends string> {
  errors: FieldErrors<K>;
  formError: string | null;
  /** Submitted values, so the form can be re-filled after a failed save. */
  values: Record<string, string>;
}

export interface DeleteState {
  error: string | null;
}
