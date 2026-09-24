function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-line/70 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading dashboard">
      <span className="sr-only">Loading your dashboard…</span>

      <div className="mb-6 space-y-3 lg:mb-8">
        <Block className="h-3 w-24" />
        <Block className="h-8 w-72 max-w-full" />
        <Block className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-5">
            <Block className="h-4 w-28" />
            <Block className="mt-4 h-7 w-40" />
            <Block className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:mt-8 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-6 lg:col-span-2">
          <Block className="h-5 w-48" />
          <Block className="mt-6 h-56 w-full sm:h-72" />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <Block className="h-5 w-40" />
          <Block className="mt-6 h-4 w-full" />
          <Block className="mt-4 h-4 w-full" />
          <Block className="mt-4 h-4 w-full" />
        </div>
      </div>
    </div>
  );
}
