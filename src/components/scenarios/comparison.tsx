import Link from "next/link";
import { LineChart } from "@/components/charts/line-chart";
import { Icon } from "@/components/icons";
import { formatPercent, formatRupiah } from "@/lib/format/currency";
import { formatRate } from "@/lib/projection/compound";
import type { RetirementResult } from "@/lib/projection/retirement";
import { alignTrajectories } from "@/lib/scenarios/trajectory";
import type { ScenarioOutcome } from "@/lib/services/scenarios";

/** One column in the comparison: the baseline plan or a scenario. */
export interface ComparedPlan {
  key: string;
  name: string;
  href: string;
  /** CSS colour for this plan's line; follows the plan, never its rank. */
  color: string;
  isBaseline: boolean;
  outcome: ScenarioOutcome;
}

const CATEGORICAL = Array.from({ length: 8 }, (_, i) => `var(--color-cat-${i + 1})`);

/** Baseline takes slot 1; scenarios follow in their saved order. */
export function planColor(index: number): string {
  return CATEGORICAL[index % CATEGORICAL.length];
}

interface Metric {
  label: string;
  hint?: string;
  render: (r: RetirementResult) => React.ReactNode;
}

function Gap({ r }: { r: RetirementResult }) {
  const surplus = r.status === "surplus";
  return (
    <span className={`inline-flex flex-col ${surplus ? "text-brand-700" : "text-red-700"}`}>
      <span className="inline-flex items-center gap-1 font-semibold">
        <Icon name={surplus ? "check" : "alert"} className="size-3.5 shrink-0" />
        {surplus ? "+" : "−"}
        {formatRupiah(Math.abs(r.gap))}
      </span>
      <span className="text-xs text-muted">
        {surplus ? "Surplus" : "Shortfall"} · {formatPercent(r.fundedRatio)} funded
      </span>
    </span>
  );
}

const METRICS: Metric[] = [
  {
    label: "Retirement age",
    render: (r) => (
      <span>
        {r.input.retirementAge}
        <span className="block text-xs text-muted">
          plan to age {r.input.planUntilAge} ({r.retirementYears} years)
        </span>
      </span>
    ),
  },
  {
    label: "Key assumptions",
    render: (r) => (
      <span className="text-xs text-muted">
        Inflation {formatRate(r.input.inflationBps)}
        <br />
        Return {formatRate(r.input.investmentReturnBps)}
        <br />
        Spending {formatRupiah(r.input.monthlyLivingCost)}/mo today
      </span>
    ),
  },
  {
    label: "Projected living cost",
    hint: "a year, at retirement",
    render: (r) => (
      <span>
        {formatRupiah(r.annualCostAtRetirement)}
        <span className="block text-xs text-muted">{formatRupiah(r.livingCost.atRetirement.monthly)} a month</span>
      </span>
    ),
  },
  {
    label: "Projected housing cost",
    hint: "target property at purchase",
    render: (r) =>
      r.property ? (
        <span>
          {formatRupiah(r.property.projection.futurePrice)}
          <span className="block text-xs text-muted">
            at age {r.property.projection.series.at(-1)!.age}
            {r.property.unfundedAmount > 0 ? ` · ${formatRupiah(r.property.unfundedAmount)} not covered by savings` : ""}
          </span>
        </span>
      ) : (
        <span className="text-muted">No purchase</span>
      ),
  },
  { label: "Required retirement fund", render: (r) => formatRupiah(r.requiredFund) },
  {
    label: "Projected retirement assets",
    hint: "after any property purchase",
    render: (r) => formatRupiah(r.retirementAssets),
  },
  { label: "Funding gap or surplus", render: (r) => <Gap r={r} /> },
];

function PlanHeader({ plan }: { plan: ComparedPlan }) {
  return (
    <span className="flex items-start gap-2">
      <span aria-hidden="true" className="mt-1.5 h-0.5 w-4 shrink-0 rounded-full" style={{ background: plan.color }} />
      <span>
        <Link href={plan.href} className="font-semibold text-ink hover:underline">
          {plan.name}
        </Link>
        {plan.isBaseline ? <span className="block text-xs font-normal text-muted">Baseline — your saved data</span> : null}
      </span>
    </span>
  );
}

function ErrorCell({ message }: { message: string }) {
  return (
    <span role="alert" className="flex items-start gap-1.5 text-xs text-red-700">
      <Icon name="alert" className="mt-0.5 size-3.5 shrink-0" />
      {message}
    </span>
  );
}

/** Side-by-side table for wide screens; stacked cards on phones. */
export function ComparisonTable({ plans }: { plans: ComparedPlan[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm" data-testid="comparison-table">
          <caption className="sr-only">Scenario comparison</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-48 border-b border-line bg-surface px-4 py-3 text-xs font-medium text-muted">
                Metric
              </th>
              {plans.map((plan) => (
                <th key={plan.key} scope="col" className="min-w-44 border-b border-line px-4 py-3 align-top font-normal">
                  <PlanHeader plan={plan} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => (
              <tr key={metric.label}>
                <th scope="row" className="sticky left-0 z-10 border-b border-line bg-surface px-4 py-3 align-top font-medium">
                  {metric.label}
                  {metric.hint ? <span className="block text-xs font-normal text-muted">{metric.hint}</span> : null}
                </th>
                {plans.map((plan) => (
                  <td key={plan.key} className="border-b border-line px-4 py-3 align-top tabular-nums">
                    {plan.outcome.status === "ready" ? (
                      metric.render(plan.outcome.result)
                    ) : metric === METRICS[0] ? (
                      <ErrorCell message={plan.outcome.message} />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" data-testid="comparison-cards">
        {plans.map((plan) => (
          <li key={plan.key} className="rounded-xl border border-line p-4">
            <PlanHeader plan={plan} />
            {plan.outcome.status === "ready" ? (
              <dl className="mt-3 divide-y divide-line text-sm">
                {METRICS.map((metric) => (
                  <div key={metric.label} className="flex items-start justify-between gap-4 py-2">
                    <dt className="text-muted">{metric.label}</dt>
                    <dd className="text-right tabular-nums">{metric.render((plan.outcome as { result: RetirementResult }).result)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="mt-3">
                <ErrorCell message={plan.outcome.message} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Asset balances over time for every plan that calculated successfully. */
export function TrajectoryChart({ plans }: { plans: ComparedPlan[] }) {
  const ready = plans.filter((p) => p.outcome.status === "ready").slice(0, CATEGORICAL.length);
  const results = ready.map((p) => (p.outcome as { result: RetirementResult }).result);
  if (results.length === 0) return null;
  const { ages, series } = alignTrajectories(results);

  return (
    <LineChart
      description={`Projected asset balances by age for ${ready.map((p) => p.name).join(", ")}, through retirement until each plan ends.`}
      x={ages}
      xLabels={ages.map((age) => `Age ${age}`)}
      xAxisLabel="Age"
      series={ready.map((plan, i) => ({ key: plan.key, label: plan.name, color: plan.color, values: series[i] }))}
    />
  );
}
