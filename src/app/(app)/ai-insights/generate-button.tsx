"use client";

import { useFormStatus } from "react-dom";
import { Icon } from "@/components/icons";

export function GenerateSubmitButton({ hasInsights, disabled }: { hasInsights: boolean; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Icon name={pending ? "spinner" : "sparkle"} className={`size-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Asking the AI…" : hasInsights ? "Generate new insights" : "Generate insights"}
    </button>
  );
}
