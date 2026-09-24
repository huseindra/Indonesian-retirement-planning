import type { Metadata } from "next";
import Link from "next/link";
import { ErrorAlert, SuccessAlert } from "@/components/forms/alerts";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { ReadinessSummary, RetirementChart } from "@/components/retirement/readiness";
import { requireUser } from "@/lib/auth/session";
import { formatPercent, formatRupiah, formatRupiahCompact } from "@/lib/format/currency";
import { formatRate } from "@/lib/projection/compound";
import type { RetirementResult } from "@/lib/projection/retirement";
import { getRetirementPlan, type RetirementPlanView } from "@/lib/services/retirement-plan";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Retirement Plan" };

const card = "rounded-2xl border border-line bg-surface shadow-xs";
const linkClass = "font-medium text-brand-700 hover:underline";

function yearsText(n: number): string {
  return `${n} ${n === 1 ? "year" : "years"}`;
}

export default async function RetirementPlanPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser();
  const { status } = await searchParams;
  const plan = getRetirementPlan(user.id);

  return (
    <>
      <PageHeader
        eyebrow="Retirement Plan"
        title="Are you on track to retire?"
        description="An estimate of the fund you'll need at retirement and how far your current assets are projected to go."
      />

      <p className="mb-6 flex items-start gap-2 rounded-lg border border-line bg-surface px-3.5 py-3 text-xs text-muted">
        <Icon name="info" className="mt-0.5 size-4 shrink-0 text-brand-700" />
        These are estimates from fixed formulas and your assumptions — not guaranteed outcomes or financial
        advice. Real returns, inflation and costs will differ.
      </p>

      {status === "settings-saved" ? (
        <div className="mb-6">
          <SuccessAlert>Plan-until age saved. Your retirement plan has been recalculated.</SuccessAlert>
        </div>
      ) : null}

      {plan.status === "incomplete" ? <Incomplete /> : null}
      {plan.status === "error" ? <CalculationError plan={plan} /> : null}
      {plan.status === "ready" ? <Ready plan={plan} /> : null}

      <section aria-labelledby="settings-title" className={`${card} mt-6 p-5 sm:p-6`}>
        <h2 id="settings-title" className="text-base font-semibold">
          Retirement duration
        </h2>
        <p className="mt-1 text-sm text-muted">
          How long your money needs to last. Average life expectancy in Indonesia is in the low 70s, but
          plans should allow for living longer than average.
        </p>
        <div className="mt-4">
          <SettingsForm
            planUntilAge={plan.settings.planUntilAge}
            isDefault={plan.settings.isDefault}
            retirementAge={plan.status === "ready" ? plan.result.input.retirementAge : null}
          />
        </div>
      </section>
    </>
  );
}

function Incomplete() {
  return (
    <section className={`${card} grid place-items-center px-6 py-12 text-center`}>
      <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
        <Icon name="target" className="size-6" />
      </span>
      <h2 className="mt-4 text-base font-semibold">Complete your financial profile to see your plan</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted">
        The simulation needs your current age, target retirement age, monthly living expenses and — for an
        accurate result — your savings, investments and pension balances.
      </p>
      <Link
        href="/financial-profile/edit"
        className="mt-6 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Complete financial profile
      </Link>
    </section>
  );
}

function CalculationError({ plan }: { plan: Extract<RetirementPlanView, { status: "error" }> }) {
  return (
    <div data-testid="calculation-error">
      <ErrorAlert>
        <p className="font-semibold">We couldn&apos;t calculate your retirement plan.</p>
        <p className="mt-1">{plan.message}</p>
        <p className="mt-1">
          {plan.field === "planUntilAge"
            ? "Increase the plan-until age below, or lower your target retirement age in your "
            : "Check the ages and amounts in your "}
          <Link href="/financial-profile/edit" className="font-semibold underline">
            financial profile
          </Link>
          .
        </p>
      </ErrorAlert>
    </div>
  );
}

function KeyFigure({
  label,
  value,
  detail,
  testId,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  testId: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const bg = tone === "good" ? "bg-brand-50" : tone === "bad" ? "bg-red-50" : "bg-canvas";
  return (
    <div className={`rounded-xl p-4 ${bg}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold break-words" data-testid={testId}>
        {value}
      </p>
      {detail ? <p className="mt-0.5 text-xs text-muted">{detail}</p> : null}
    </div>
  );
}

function AssetRows({ assets }: { assets: RetirementResult["currentAssets"] }) {
  const rows: [string, number][] = [
    ["Cash & savings", assets.cashAndSavings],
    ["Investments", assets.investments],
    ["JHT – BPJS Ketenagakerjaan", assets.jht],
    ["Other pension funds", assets.otherPension],
  ];
  return (
    <dl className="divide-y divide-line text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-muted">{label}</dt>
          <dd className="tabular-nums">{formatRupiah(value)}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-4 py-2 font-semibold">
        <dt>Total assets</dt>
        <dd className="tabular-nums">{formatRupiah(assets.total)}</dd>
      </div>
    </dl>
  );
}

function Ready({ plan }: { plan: Extract<RetirementPlanView, { status: "ready" }> }) {
  const r = plan.result;
  const { input } = r;
  const surplus = r.status === "surplus";

  return (
    <div className="space-y-6">
      {!plan.hasAssets ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          <span>
            You haven&apos;t recorded any savings, investments or pension balances, so projected assets are Rp 0.{" "}
            <Link href="/financial-profile" className="font-semibold underline">
              Add your assets
            </Link>{" "}
            for a realistic result.
          </span>
        </p>
      ) : null}

      <section aria-labelledby="readiness-title" className={`${card} p-5 sm:p-6`}>
        <h2 id="readiness-title" className="sr-only">
          Retirement readiness
        </h2>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <ReadinessSummary result={r} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-3">
            <KeyFigure
              label="Years until retirement"
              value={yearsText(r.yearsToRetirement)}
              detail={`Age ${input.currentAge} → ${input.retirementAge}`}
              testId="years-to-retirement"
            />
            <KeyFigure
              label="Annual living cost at retirement"
              value={formatRupiah(r.annualCostAtRetirement)}
              detail={`Today: ${formatRupiah(r.livingCost.current.annual)} a year`}
              testId="annual-cost-at-retirement"
            />
            <KeyFigure
              label="Estimated retirement fund required"
              value={formatRupiah(r.requiredFund)}
              detail={`To fund ages ${input.retirementAge}–${input.planUntilAge}`}
              testId="required-fund"
            />
            <KeyFigure
              label="Projected assets at retirement"
              value={formatRupiah(r.projectedAssets.total)}
              detail={`From ${formatRupiah(r.currentAssets.total)} today`}
              testId="projected-assets"
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="current-title" className={`${card} p-5 sm:p-6`}>
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">Today</p>
          <h2 id="current-title" className="mt-1 text-base font-semibold">
            Current financial position
          </h2>
          <p className="mt-1 text-sm text-muted">
            Age {input.currentAge} · living costs {formatRupiah(r.livingCost.current.monthly)} a month (
            {formatRupiah(r.livingCost.current.annual)} a year)
          </p>
          <div className="mt-4">
            <AssetRows assets={r.currentAssets} />
          </div>
        </section>

        <section aria-labelledby="future-title" className={`${card} p-5 sm:p-6`}>
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">
            At retirement · age {input.retirementAge}, in {yearsText(r.yearsToRetirement)}
          </p>
          <h2 id="future-title" className="mt-1 text-base font-semibold">
            Projected future position
          </h2>
          <p className="mt-1 text-sm text-muted">
            Living costs {formatRupiah(r.livingCost.atRetirement.monthly)} a month (
            {formatRupiah(r.annualCostAtRetirement)} a year) after {formatRate(input.inflationBps)} inflation
          </p>
          <div className="mt-4">
            <AssetRows assets={r.projectedAssets} />
          </div>
          <p className="mt-2 text-xs text-muted">
            Each balance grown at {formatRate(input.investmentReturnBps)} a year (×
            {r.assetGrowthFactor.toLocaleString("id-ID", { maximumFractionDigits: 3 })}). No new savings are assumed.
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="required-title" className={`${card} p-5 sm:p-6`}>
          <h2 id="required-title" className="text-base font-semibold">
            Required retirement fund
          </h2>
          <p className="mt-2 text-2xl font-semibold">{formatRupiah(r.requiredFund)}</p>
          <p className="mt-2 text-sm text-muted">
            Enough to pay your living costs for {yearsText(r.retirementYears)} (age {input.retirementAge} to{" "}
            {input.planUntilAge}), with costs rising {formatRate(input.inflationBps)} a year while the remaining
            money earns {formatRate(input.investmentReturnBps)}. That is{" "}
            {r.requiredFundMultiple.toLocaleString("id-ID", { maximumFractionDigits: 1 })} × your first-year cost.
          </p>
        </section>

        <section aria-labelledby="gap-title" className={`${card} p-5 sm:p-6`}>
          <h2 id="gap-title" className="text-base font-semibold">
            Funding {surplus ? "surplus" : "gap"}
          </h2>
          <p className={`mt-2 text-2xl font-semibold ${surplus ? "text-brand-700" : "text-red-700"}`}>
            {surplus ? "+" : "−"}
            {formatRupiah(Math.abs(r.gap))}
          </p>
          <p className="mt-2 text-sm text-muted">
            {formatRupiah(r.retirementAssets)} projected − {formatRupiah(r.requiredFund)} required ={" "}
            {formatPercent(r.fundedRatio)} funded.
          </p>
          {surplus ? null : (
            <p className="mt-3 rounded-lg bg-canvas px-3 py-2.5 text-sm" data-testid="saving-needed">
              Saving about <strong>{formatRupiah(r.monthlySavingToCloseGap)}</strong> a month from now, invested at{" "}
              {formatRate(input.investmentReturnBps)}, would close this gap by age {input.retirementAge}.
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="chart-title" className={`${card} p-5 sm:p-6`}>
        <h2 id="chart-title" className="text-base font-semibold">
          Retirement projection
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Your current assets growing toward retirement, compared with the capital you would need at each age to
          reach the required fund on time (the required fund discounted at {formatRate(input.investmentReturnBps)}).
          Where the green line is below the amber line, you are behind.
        </p>
        <RetirementChart result={r} />
      </section>

      <CalculationDetails result={r} />
    </div>
  );
}

function CalculationDetails({ result: r }: { result: RetirementResult }) {
  const { input } = r;
  return (
    <section aria-labelledby="details-title" className={`${card} p-5 sm:p-6`}>
      <h2 id="details-title" className="text-base font-semibold">
        How this was calculated
      </h2>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          <li>
            <span className="font-medium">Living cost at retirement.</span>{" "}
            <span className="font-mono text-xs break-words">
              {formatRupiah(r.livingCost.current.monthly)} × (1 + {formatRate(input.inflationBps)})
              <sup>{r.yearsToRetirement}</sup> = {formatRupiah(r.livingCost.atRetirement.monthly)}
            </span>{" "}
            a month, × 12 = {formatRupiah(r.annualCostAtRetirement)} a year.
          </li>
          <li>
            <span className="font-medium">Required fund.</span> Each retirement year&apos;s cost is paid at the start of
            the year and rises with inflation; money not yet spent earns the expected return:{" "}
            <span className="font-mono text-xs break-words">
              {formatRupiahCompact(r.annualCostAtRetirement)} × Σ<sub>k=0..{r.retirementYears - 1}</sub> ((1 +{" "}
              {formatRate(input.inflationBps)}) ÷ (1 + {formatRate(input.investmentReturnBps)}))<sup>k</sup> ={" "}
              {formatRupiah(r.requiredFund)}
            </span>
            .
          </li>
          <li>
            <span className="font-medium">Projected assets.</span>{" "}
            <span className="font-mono text-xs break-words">
              {formatRupiah(r.currentAssets.total)} × (1 + {formatRate(input.investmentReturnBps)})
              <sup>{r.yearsToRetirement}</sup> = {formatRupiah(r.projectedAssets.total)}
            </span>
            .
          </li>
          <li>
            <span className="font-medium">Gap or surplus.</span> Projected assets − required fund ={" "}
            {formatRupiah(r.gap)}.
          </li>
          <li>
            <span className="font-medium">How long the money lasts.</span> Starting from the projected assets, each
            year&apos;s cost is withdrawn and the rest grows at the expected return.{" "}
            {r.fundsRunOutAtAge === null
              ? `The balance lasts to age ${input.planUntilAge}.`
              : `The balance can't cover the cost at age ${r.fundsRunOutAtAge}.`}
          </li>
        </ol>

        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold">Assumptions used</h3>
            <dl className="mt-2 divide-y divide-line rounded-xl border border-line">
              {[
                ["Current age", `${input.currentAge}`, "/financial-profile/edit", "Financial Profile"],
                ["Target retirement age", `${input.retirementAge}`, "/financial-profile/edit", "Financial Profile"],
                ["Plan until age", `${input.planUntilAge}`, "#settings-title", "below"],
                ["Monthly living expenses", formatRupiah(input.monthlyLivingCost), "/financial-profile/edit", "Financial Profile"],
                ["General inflation", `${formatRate(input.inflationBps)} a year`, "/living-costs/assumptions", "Living Costs"],
                ["Expected investment return", `${formatRate(input.investmentReturnBps)} a year`, "/living-costs/assumptions", "Living Costs"],
              ].map(([label, value, href, source]) => (
                <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3.5 py-2">
                  <dt className="text-muted">{label}</dt>
                  <dd>
                    <span className="font-medium">{value}</span>{" "}
                    <Link href={href} className={`text-xs ${linkClass}`}>
                      edit in {source}
                    </Link>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3 className="font-semibold">Not included</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              <li>New savings or contributions from now on</li>
              <li>Rent, housing costs or buying your target property</li>
              <li>BPJS Jaminan Pensiun monthly pension or other retirement income</li>
              <li>Taxes, fees, and returns or inflation that vary from year to year</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
