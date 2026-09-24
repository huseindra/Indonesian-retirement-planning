"use client";

import { useActionState, useId, useRef } from "react";
import type { DeleteState } from "@/app/actions/financial-profile";
import { ErrorAlert } from "./forms/alerts";
import { Icon } from "./icons";

type DeleteAction = (prev: DeleteState, formData: FormData) => Promise<DeleteState>;

/**
 * A delete button that asks for confirmation in a modal dialog before
 * running the server action. Errors are shown inside the dialog.
 */
export function ConfirmDelete({
  action,
  title,
  description,
  confirmLabel = "Delete",
  triggerLabel,
  triggerAriaLabel,
  hiddenFields = {},
  variant = "button",
}: {
  action: DeleteAction;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  triggerLabel: string;
  triggerAriaLabel?: string;
  hiddenFields?: Record<string, string | number>;
  /** "icon" renders a compact trash-can trigger for list rows. */
  variant?: "button" | "icon";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(action, { error: null });
  const titleId = useId();
  const descriptionId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={triggerAriaLabel}
        className={
          variant === "icon"
            ? "grid size-9 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-700"
            : "inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-surface px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
        }
      >
        <Icon name="trash" className={variant === "icon" ? "size-5" : "size-4"} />
        {variant === "icon" ? null : triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <form action={formAction} className="p-6">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
              <Icon name="alert" className="size-5" />
            </span>
            <div>
              <h2 id={titleId} className="text-base font-semibold">
                {title}
              </h2>
              <div id={descriptionId} className="mt-1.5 text-sm text-muted">
                {description}
              </div>
            </div>
          </div>

          {state.error ? (
            <div className="mt-4">
              <ErrorAlert>{state.error}</ErrorAlert>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              disabled={pending}
              className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-canvas disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-80"
            >
              {pending ? <Icon name="spinner" className="size-4 animate-spin" /> : null}
              {pending ? "Deleting…" : confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
