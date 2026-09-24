import { LineChart } from "@/components/charts/line-chart";
import { Icon } from "@/components/icons";
import { formatPercent, formatRupiah, formatRupiahCompact } from "@/lib/format/currency";
import type { RetirementResult } from "@/lib/projection/retirement";

/**
 * Retirement-readiness headline shared by the dashboard and the Retirement
 * Plan page. Presentation only — every number comes from RetirementResult.
 */
export function ReadinessSummary({ result, compact = false }: { result: RetirementResult; compact?: boolean }) {
  const surplus = result.status === "surplus";
  const ratio = Math.min(result.fundedRatio, 1);
  const meterColor = surplus ? "bg-brand-600" : result.fundedRatio >= 0.75 ? "bg-amber-500" : "bg-red-600";
  const meterTrack = surplus ? "bg-brand-100" : result.fundedRatio >= 0.75 ? "bg-amber-100" : "bg-red-100";

  return (
    <div data-testid="readiness-summary">
      <p
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
          surplus ? "bg-brand-50 text-brand-800 ring-brand-200" : "bg-red-50 text-red-800 ring-red-200"
        }`}
      >
        <Icon name={surplus ? "check" : "alert"} className="size-3.5" />
        {surplus ? "Projected surplus" : "Projected shortfall"}
      </p>
      <p className={`mt-2 font-semibold tracking-tight ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`} data-testid="gap-amount">
        {surplus ? "+" : "−"}
        {formatRupiah(Math.abs(result.gap))}
      </p>
      <p className="mt-1 text-sm text-muted">
        {surplus
          ? "Your current assets are projected to cover your retirement living costs, with money to spare."
          : "Your current assets are projected to fall short of what your retirement living costs require."}
      </p>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium">
            {formatPercent(result.fundedRatio)} funded
          </span>
          <span className="text-muted">
            {formatRupiahCompact(result.projectedAssets.total)} of {formatRupiahCompact(result.requiredFund)} needed
          </span>
        </div>
        <div
          role="meter"
          aria-label="Share of the required retirement fund covered by projected assets"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuetext={`${formatPercent(result.fundedRatio)} funded`}
          className={`mt-1.5 h-2.5 overflow-hidden rounded-full ${meterTrack}`}
        >
          <div className={`h-full rounded-full ${meterColor}`} style={{ width: `${(ratio * 100).toFixed(1)}%` }} />
        </div>
      </div>

      <p className="mt-3 text-xs text-muted" data-testid="funds-last">
        {result.fundsRunOutAtAge === null
          ? `Money is projected to last beyond age ${result.input.planUntilAge}, the end of your plan.`
          : `Money is projected to run out at age ${result.fundsRunOutAtAge} — ${
              result.input.planUntilAge - result.fundsRunOutAtAge
            } years before the end of your plan (age ${result.input.planUntilAge}).`}
      </p>
    </div>
  );
}

function ageLabels(ages: number[]): string[] {
  return ages.map((age, i) => `Age ${age}${i === 0 ? " (today)" : ` · in ${i} ${i === 1 ? "year" : "years"}`}`);
}

/** Projected assets vs the capital needed at each age to reach the required fund. */
export function RetirementChart({ result }: { result: RetirementResult }) {
  const points = result.accumulation;
  return (
    <LineChart
      description={`Projected assets grow from ${formatRupiah(points[0].projectedAssets)} to ${formatRupiah(
        result.projectedAssets.total,
      )} by age ${result.input.retirementAge}, against ${formatRupiah(result.requiredFund)} needed.`}
      x={points.map((p) => p.age)}
      xLabels={ageLabels(points.map((p) => p.age))}
      xAxisLabel="Age"
      series={[
        {
          key: "assets",
          label: "Projected assets",
          color: "var(--color-series-1)",
          values: points.map((p) => p.projectedAssets),
        },
        {
          key: "required",
          label: "Capital needed to be on track",
          color: "var(--color-series-2)",
          values: points.map((p) => p.requiredCapital),
        },
      ]}
    />
  );
}
