function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-line/70 ${className}`} />;
}

export default function FinancialProfileLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading financial profile">
      <span className="sr-only">Loading your financial profile…</span>

      <div className="mb-6 space-y-3 lg:mb-8">
        <Block className="h-3 w-28" />
        <Block className="h-8 w-80 max-w-full" />
        <Block className="h-4 w-96 max-w-full" />
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <Block className="h-5 w-32" />
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-3">
              <Block className="h-3 w-24" />
              <Block className="h-4 w-full" />
              <Block className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-5">
            <Block className="h-4 w-40" />
            <Block className="mt-4 h-4 w-full" />
            <Block className="mt-3 h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
