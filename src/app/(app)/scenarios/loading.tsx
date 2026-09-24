function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-line/70 ${className}`} />;
}

export default function ScenariosLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading scenarios">
      <span className="sr-only">Calculating your scenarios…</span>
      <div className="mb-6 space-y-3 lg:mb-8">
        <Block className="h-3 w-24" />
        <Block className="h-8 w-80 max-w-full" />
        <Block className="h-4 w-96 max-w-full" />
      </div>
      <div className="rounded-2xl border border-line bg-surface p-6">
        <Block className="h-5 w-52" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Block key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <Block className="h-5 w-48" />
        <Block className="mt-5 h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
