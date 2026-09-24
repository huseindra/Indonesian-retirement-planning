function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-line/70 ${className}`} />;
}

export default function AiInsightsLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading AI insights">
      <span className="sr-only">Loading your AI insights…</span>

      <div className="mb-6 space-y-3 lg:mb-8">
        <Block className="h-3 w-24" />
        <Block className="h-8 w-96 max-w-full" />
        <Block className="h-4 w-full max-w-2xl" />
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <Block className="h-5 w-40" />
        <Block className="mt-3 h-4 w-64" />
      </div>

      <div className="mt-6 space-y-4">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-6">
            <Block className="h-4 w-48" />
            <Block className="mt-3 h-5 w-full" />
            <Block className="mt-2 h-4 w-5/6" />
            <Block className="mt-4 h-8 w-64 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
