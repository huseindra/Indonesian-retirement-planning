"use client";

import { Icon } from "@/components/icons";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section
      role="alert"
      className="grid place-items-center rounded-2xl border border-red-200 bg-surface px-6 py-16 text-center"
    >
      <span className="grid size-12 place-items-center rounded-full bg-red-50 text-red-700">
        <Icon name="alert" className="size-6" />
      </span>
      <h1 className="mt-4 text-base font-semibold">Something went wrong</h1>
      <p className="mt-1.5 max-w-md text-sm text-muted">
        We couldn&apos;t load this page. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Try again
      </button>
    </section>
  );
}
