function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-line/70 ${className}`} />;
}

export default function RetirementPlanLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading retirement plan">
      <span className="sr-only">Running your retirement simulation…</span>

      <div className="mb-6 space-y-3 lg:mb-8">
        <Block className="h-3 w-28" />
        <Block className="h-8 w-80 max-w-full" />
        <Block className="h-4 w-96 max-w-full" />
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-2">
            <Block className="h-6 w-36 rounded-full" />
            <Block className="h-10 w-64" />
            <Block className="h-3 w-full" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Block key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-6">
            <Block className="h-5 w-48" />
            <Block className="mt-5 h-32 w-full" />
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <Block className="h-5 w-48" />
        <Block className="mt-5 h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
