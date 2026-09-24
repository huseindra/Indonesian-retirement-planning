import Link from "next/link";
import { Icon } from "../icons";

/** Sticky save/cancel bar so the primary action stays reachable on mobile. */
export function FormActions({
  pending,
  submitLabel,
  pendingLabel,
  cancelHref,
}: {
  pending: boolean;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-3 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
      <Link
        href={cancelHref}
        aria-disabled={pending}
        className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-canvas aria-disabled:pointer-events-none aria-disabled:opacity-60"
      >
        Cancel
      </Link>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? <Icon name="spinner" className="size-4 animate-spin" /> : null}
        {pending ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}
