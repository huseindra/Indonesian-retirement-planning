export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-sm"
      >
        PP
      </span>
      <span className="leading-tight">
        <span className="block text-base font-semibold text-ink">Pensiun Planner</span>
        <span className="block text-xs text-muted">Indonesian retirement planning</span>
      </span>
    </span>
  );
}
