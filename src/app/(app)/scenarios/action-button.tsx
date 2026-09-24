"use client";

import { useActionState } from "react";
import type { DeleteState } from "@/app/actions/types";
import { Icon } from "@/components/icons";

type Action = (prev: DeleteState, formData: FormData) => Promise<DeleteState>;

/** A one-click server action (duplicate, add examples) with pending and error states. */
export function ActionButton({
  action,
  label,
  pendingLabel,
  ariaLabel,
  hiddenFields = {},
  size = "md",
}: {
  action: Action;
  label: string;
  pendingLabel: string;
  ariaLabel?: string;
  hiddenFields?: Record<string, string | number>;
  size?: "sm" | "md";
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  return (
    <form action={formAction} className="inline-flex flex-col">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        aria-label={pending ? undefined : ariaLabel}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface font-medium hover:bg-canvas disabled:cursor-wait disabled:opacity-70 ${
          size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-sm font-semibold"
        }`}
      >
        {pending ? <Icon name="spinner" className="size-4 animate-spin" /> : null}
        {pending ? pendingLabel : label}
      </button>
      {state.error ? (
        <span role="alert" className="mt-1 text-xs text-red-700">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
