import { Icon } from "./icons";

/**
 * Reserved space for the retirement projection chart. The ghosted lines are
 * decorative only; no projection is calculated yet.
 */
export function ChartPlaceholder() {
  return (
    <section
      aria-labelledby="projection-chart-title"
      className="rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="projection-chart-title" className="text-base font-semibold">
            Retirement projection
          </h2>
          <p className="mt-1 text-sm text-muted">
            Projected fund growth versus your retirement need, year by year.
          </p>
        </div>
        <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-line">
          Chart coming soon
        </span>
      </div>

      <div
        role="img"
        aria-label="Placeholder for the future retirement projection chart. No data yet."
        className="relative mt-6 h-56 overflow-hidden rounded-xl border border-dashed border-line bg-canvas/60 sm:h-72"
      >
        <svg
          viewBox="0 0 400 200"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 size-full text-line"
        >
          {[40, 80, 120, 160].map((y) => (
            <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="currentColor" strokeDasharray="4 6" />
          ))}
          <path
            d="M0 180 C 80 170, 140 140, 200 110 S 320 50, 400 30"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="max-w-xs rounded-xl bg-surface/90 px-5 py-4 shadow-xs ring-1 ring-line">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-canvas text-muted">
              <Icon name="chart" className="size-5" />
            </span>
            <p className="mt-3 text-sm font-medium text-ink">Retirement projection chart</p>
            <p className="mt-1 text-xs text-muted">
              Will appear here once your Retirement Plan is set up.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
