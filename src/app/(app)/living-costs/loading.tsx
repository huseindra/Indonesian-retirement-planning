function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-line/70 ${className}`} />;
}

export default function LivingCostsLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading living costs">
      <span className="sr-only">Calculating your projections…</span>

      <div className="mb-6 space-y-3 lg:mb-8">
        <Block className="h-3 w-24" />
        <Block className="h-8 w-80 max-w-full" />
        <Block className="h-4 w-96 max-w-full" />
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <Block className="h-5 w-48" />
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Block className="h-3 w-28" />
              <Block className="h-7 w-20" />
            </div>
          ))}
        </div>
      </div>

      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <Block className="h-5 w-52" />
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, j) => (
              <Block key={j} className="h-20 w-full rounded-xl" />
            ))}
          </div>
          <Block className="mt-6 h-64 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
