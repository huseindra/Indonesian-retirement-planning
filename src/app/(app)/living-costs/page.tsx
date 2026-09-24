import type { Metadata } from "next";
import Link from "next/link";
import { deleteTargetPropertyAction } from "@/app/actions/cost-projection";
import { LineChart } from "@/components/charts/line-chart";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ErrorAlert, SuccessAlert } from "@/components/forms/alerts";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { costStatusMessage } from "@/config/cost-status";
import { requireUser } from "@/lib/auth/session";
import {
  ASSUMPTION_DESCRIPTIONS,
  ASSUMPTION_LABELS,
  type AssumptionKey,
} from "@/lib/domain/assumptions";
import { formatPercent, formatRupiah, formatRupiahCompact } from "@/lib/format/currency";
import { formatRate } from "@/lib/projection/compound";
import type { LivingCostProjection } from "@/lib/projection/living-costs";
import {
  getCostProjectionOverview,
  type AssumptionsView,
  type CostProjectionOverview,
  type PropertyView,
} from "@/lib/services/cost-projection";

export const metadata: Metadata = { title: "Living Costs" };

const card = "rounded-2xl border border-line bg-surface shadow-xs";
const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700";
const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:bg-canvas";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });

function years(n: number): string {
  return `${n} ${n === 1 ? "year" : "years"}`;
}

/** Tooltip/table labels for a yearly series that starts today. */
function ageLabels(ages: number[]): string[] {
  return ages.map((age, i) => `Age ${age}${i === 0 ? " (today)" : ` · in ${years(i)}`}`);
}

export default async function LivingCostsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser();
  const { status } = await searchParams;
  const message = costStatusMessage(status);
  const overview = getCostProjectionOverview(user.id);

  return (
    <>
      <PageHeader
        eyebrow="Living Costs"
        title="Living costs & future costs"
        description="How inflation changes what your lifestyle costs, and what a home you plan to buy may cost by the time you buy it."
      />

      {message ? (
        <div className="mb-6">
          <SuccessAlert>{message}</SuccessAlert>
        </div>
      ) : null}

      <div className="space-y-6">
        <AssumptionsPanel assumptions={overview.assumptions} />

        {overview.livingCost && overview.profile ? (
          <LivingCostSection projection={overview.livingCost} retirementAge={overview.profile.targetRetirementAge} />
        ) : (
          <NeedsProfile />
        )}

        <HousingSection overview={overview} />

        <section
          aria-labelledby="living-costs-next-title"
          className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <div>
            <h2 id="living-costs-next-title" className="text-base font-semibold">
              See what this means for retirement
            </h2>
            <p className="mt-1 text-sm text-muted">
              These costs and assumptions feed directly into your Retirement Plan and any scenarios you compare.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/retirement-plan"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-canvas"
            >
              Retirement Plan →
            </Link>
            <Link
              href="/scenarios"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-canvas"
            >
              Compare scenarios →
            </Link>
          </div>
        </section>

        <p className="text-xs text-muted">
          All figures are calculated with fixed compound-growth formulas from the assumptions above — they
          are illustrations, not forecasts or financial advice.
        </p>
      </div>
    </>
  );
}

function AssumptionsPanel({ assumptions }: { assumptions: AssumptionsView }) {
  const keys: AssumptionKey[] = ["inflationBps", "housingGrowthBps", "investmentReturnBps"];

  return (
    <section aria-labelledby="assumptions-title" className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h2 id="assumptions-title" className="flex flex-wrap items-center gap-2 text-base font-semibold">
            Economic assumptions
            {assumptions.isDefault ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                Demo defaults
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {assumptions.isDefault || !assumptions.updatedAt
              ? "You haven't saved your own rates yet. Adjust them to match your expectations."
              : `Saved ${dateFormatter.format(new Date(assumptions.updatedAt))}. Every projection on this page uses these rates.`}
          </p>
        </div>
        <Link href="/living-costs/assumptions" className={secondaryButton}>
          <Icon name="pencil" className="size-4" />
          Edit assumptions
        </Link>
      </div>
      <dl className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {keys.map((key) => (
          <div key={key} className="px-5 py-4 sm:px-6">
            <dt className="text-sm font-medium text-muted">{ASSUMPTION_LABELS[key]}</dt>
            <dd>
              <span className="mt-1 block text-2xl font-semibold" data-testid={`assumption-${key}`}>
                {formatRate(assumptions.values[key])}
              </span>
              <span className="text-xs text-muted">per year · {ASSUMPTION_DESCRIPTIONS[key]}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function NeedsProfile() {
  return (
    <section className={`${card} grid place-items-center px-6 py-12 text-center`}>
      <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
        <Icon name="wallet" className="size-6" />
      </span>
      <h2 className="mt-4 text-base font-semibold">Add your financial profile to project living costs</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted">
        We need your current age, target retirement age and monthly living expenses.
      </p>
      <Link href="/financial-profile/edit" className={`${primaryButton} mt-6`}>
        Complete financial profile
      </Link>
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
  emphasis = false,
  testId,
}: {
  label: string;
  value: string;
  detail?: string;
  emphasis?: boolean;
  testId?: string;
}) {
  return (
    <div className={`rounded-xl p-4 ${emphasis ? "bg-brand-50" : "bg-canvas"}`}>
      <p className={`text-xs font-medium ${emphasis ? "text-brand-800" : "text-muted"}`}>{label}</p>
      <p className="mt-1 text-lg font-semibold break-words sm:text-xl" data-testid={testId}>
        {value}
      </p>
      {detail ? <p className="mt-0.5 text-xs text-muted">{detail}</p> : null}
    </div>
  );
}

function LivingCostSection({ projection: p, retirementAge }: { projection: LivingCostProjection; retirementAge: number }) {
  return (
    <section aria-labelledby="living-cost-title" className={`${card} p-5 sm:p-6`}>
      <h2 id="living-cost-title" className="text-base font-semibold">
        Living-cost projection
      </h2>
      <p className="mt-1 text-sm text-muted">
        Your monthly living expenses from your financial profile, grown by {formatRate(p.inflationBps)} inflation
        a year for the {years(p.years)} until you retire at {retirementAge}. Rent and other housing costs are
        covered separately below.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Current monthly living cost" value={formatRupiah(p.current.monthly)} testId="current-monthly" />
        <Stat label="Current annual living cost" value={formatRupiah(p.current.annual)} detail="12 × monthly" testId="current-annual" />
        <Stat
          label={`Monthly cost at retirement (age ${retirementAge})`}
          value={formatRupiah(p.atRetirement.monthly)}
          detail={`+${formatPercent(p.increase.percent)} vs today`}
          emphasis
          testId="retirement-monthly"
        />
        <Stat
          label={`Annual cost at retirement (age ${retirementAge})`}
          value={formatRupiah(p.atRetirement.annual)}
          detail="12 × monthly"
          emphasis
          testId="retirement-annual"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h3 className="text-sm font-semibold">Monthly living cost by age</h3>
          <p className="mb-3 text-xs text-muted">The same lifestyle, priced in the Rupiah of each future year.</p>
          <LineChart
            description={`Monthly living cost rising from ${formatRupiah(p.current.monthly)} at age ${p.series[0].age} to ${formatRupiah(p.atRetirement.monthly)} at age ${retirementAge}.`}
            x={p.series.map((pt) => pt.age)}
            xAxisLabel="Age"
            xLabels={ageLabels(p.series.map((pt) => pt.age))}
            series={[
              {
                key: "monthly",
                label: "Monthly living cost",
                color: "var(--color-series-1)",
                values: p.series.map((pt) => pt.monthly),
              },
            ]}
            area
          />
        </div>

        <div className="space-y-3 text-sm lg:col-span-2">
          <div className="rounded-xl border border-line p-4">
            <h3 className="font-semibold">How this is calculated</h3>
            <p className="mt-2 font-mono text-xs leading-relaxed break-words text-ink">
              {formatRupiah(p.current.monthly)} × (1 + {formatRate(p.inflationBps)})
              <sup>{p.years}</sup> = {formatRupiah(p.atRetirement.monthly)}
            </p>
            <p className="mt-2 text-xs text-muted">
              Compound growth: each year&apos;s cost is last year&apos;s plus {formatRate(p.inflationBps)}. Over{" "}
              {years(p.years)} prices multiply by{" "}
              {p.inflationFactor.toLocaleString("id-ID", { maximumFractionDigits: 3 })}.
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-900">Purchasing power</h3>
            <p className="mt-2 text-xs text-amber-900" data-testid="purchasing-power">
              Rp 1.000.000 kept as cash until you retire will buy only what{" "}
              <strong>{formatRupiah(p.purchasingPowerOfOneMillion)}</strong> buys today — about{" "}
              {formatPercent(p.purchasingPowerRemaining)} of its current value. Your lifestyle doesn&apos;t get more
              expensive; each Rupiah buys less.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HousingSection({ overview }: { overview: CostProjectionOverview }) {
  const { property, profile } = overview;

  return (
    <section aria-labelledby="housing-title" className={`${card} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="housing-title" className="text-base font-semibold">
            Housing projection
          </h2>
          <p className="mt-1 text-sm text-muted">
            A home you plan to buy, and how its price may change before you buy it.
          </p>
        </div>
        {property ? (
          <div className="flex flex-wrap gap-2">
            <Link href="/living-costs/property" className={secondaryButton}>
              <Icon name="pencil" className="size-4" />
              Edit property
            </Link>
            <ConfirmDelete
              action={deleteTargetPropertyAction}
              title="Delete your target property?"
              description={<>“{property.property.name}” and its projection will be removed.</>}
              triggerLabel="Delete"
            />
          </div>
        ) : null}
      </div>

      {!property ? (
        <div className="mt-5 grid place-items-center rounded-xl border border-dashed border-line px-6 py-10 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-700">
            <Icon name="home" className="size-6" />
          </span>
          <h3 className="mt-3 text-sm font-semibold">No target property yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Add the price of a home you&apos;d like to buy and the age you expect to buy it.
          </p>
          {profile ? (
            <Link href="/living-costs/property" className={`${primaryButton} mt-5`}>
              <Icon name="plus" className="size-4" />
              Add target property
            </Link>
          ) : (
            <p className="mt-4 text-sm text-muted">
              <Link href="/financial-profile/edit" className="font-medium text-brand-700 hover:underline">
                Complete your financial profile
              </Link>{" "}
              first — we need your current age.
            </p>
          )}
        </div>
      ) : property.projection ? (
        <PropertyDetails view={property} inflationBps={overview.assumptions.values.inflationBps} />
      ) : (
        <div className="mt-5">
          <ErrorAlert>
            {profile ? (
              <>
                The planned purchase age ({property.property.purchaseAge}) is earlier than your current age (
                {profile.currentAge}), so it can&apos;t be projected.{" "}
                <Link href="/living-costs/property" className="font-semibold underline">
                  Update the purchase age
                </Link>
                .
              </>
            ) : (
              <>
                Your financial profile is missing, so we can&apos;t tell how far away the purchase is.{" "}
                <Link href="/financial-profile/edit" className="font-semibold underline">
                  Complete your financial profile
                </Link>
                .
              </>
            )}
          </ErrorAlert>
        </div>
      )}
    </section>
  );
}

function PropertyDetails({ view, inflationBps }: { view: PropertyView; inflationBps: number }) {
  const p = view.projection!;
  const { property } = view;
  const outpacesInflation = p.realChange > 0;
  const tracksInflation = p.realChange === 0;
  const growthSource =
    view.growthSource === "property" ? "set for this property" : "from your housing-growth assumption";

  return (
    <div className="mt-5">
      <p className="text-sm">
        <span className="font-semibold">{property.name}</span>
        <span className="text-muted">
          {" "}
          · buying at age {property.purchaseAge} ({p.years === 0 ? "now" : `in ${years(p.years)}`}) · prices growing{" "}
          {formatRate(view.growthBps)} a year, {growthSource}
        </span>
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Price today" value={formatRupiah(p.currentPrice)} testId="property-current" />
        <Stat
          label={`Estimated price at age ${property.purchaseAge}`}
          value={formatRupiah(p.futurePrice)}
          detail="Nominal price in future Rupiah"
          emphasis
          testId="property-future"
        />
        <Stat
          label="Nominal price increase"
          value={`${p.nominalIncrease >= 0 ? "+" : "−"}${formatRupiah(Math.abs(p.nominalIncrease))}`}
          detail={`${p.nominalIncreasePercent >= 0 ? "+" : ""}${formatPercent(p.nominalIncreasePercent)} from price growth`}
          testId="property-increase"
        />
        <Stat
          label="Future price in today's money"
          value={formatRupiah(p.futurePriceInTodaysMoney)}
          detail={`${p.realChangePercent >= 0 ? "+" : ""}${formatPercent(p.realChangePercent)} vs today after inflation`}
          testId="property-real"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h3 className="text-sm font-semibold">Property price by age</h3>
          <p className="mb-3 text-xs text-muted">
            The price tag (nominal) versus the same price with general inflation removed.
          </p>
          <LineChart
            description={`Property price rising from ${formatRupiah(p.currentPrice)} to ${formatRupiah(p.futurePrice)} by age ${property.purchaseAge}; in today's money that is ${formatRupiah(p.futurePriceInTodaysMoney)}.`}
            x={p.series.map((pt) => pt.age)}
            xAxisLabel="Age"
            xLabels={ageLabels(p.series.map((pt) => pt.age))}
            series={[
              {
                key: "nominal",
                label: "Price tag (nominal)",
                color: "var(--color-series-1)",
                values: p.series.map((pt) => pt.nominalPrice),
              },
              {
                key: "real",
                label: "In today's money",
                color: "var(--color-series-2)",
                values: p.series.map((pt) => pt.priceInTodaysMoney),
              },
            ]}
          />
        </div>

        <div className="space-y-3 text-sm lg:col-span-2" data-testid="housing-explanation">
          <h3 className="font-semibold">Two different effects</h3>
          <div className="rounded-xl border border-line p-4">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
              <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-[var(--color-series-1)]" />
              1 · Price growth (nominal)
            </p>
            <p className="mt-1.5 text-xs">
              The price tag {p.nominalIncrease >= 0 ? "rises" : "falls"} from {formatRupiahCompact(p.currentPrice)} to{" "}
              {formatRupiahCompact(p.futurePrice)} because property prices are assumed to change by{" "}
              {formatRate(view.growthBps)} a year:{" "}
              <span className="font-mono">
                {formatRupiah(p.currentPrice)} × (1 + {formatRate(view.growthBps)})<sup>{p.years}</sup>
              </span>
              . This is a change in the price, not the home losing or gaining quality.
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
              <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-[var(--color-series-2)]" />
              2 · Money buys less (purchasing power)
            </p>
            <p className="mt-1.5 text-xs">
              At {formatRate(inflationBps)} general inflation, {formatRupiahCompact(p.currentPrice)} kept as cash until age{" "}
              {property.purchaseAge} will buy only what <strong>{formatRupiah(p.cashPurchasingPowerAtPurchase)}</strong>{" "}
              buys today. The Rupiah loses purchasing power; the property does not.
            </p>
          </div>
          <div className="rounded-xl bg-canvas p-4">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">Putting them together</p>
            <p className="mt-1.5 text-xs">
              In today&apos;s money the future price is {formatRupiah(p.futurePriceInTodaysMoney)}.{" "}
              {tracksInflation
                ? "Property prices are assumed to rise exactly with inflation, so in real terms the home costs the same as today."
                : outpacesInflation
                  ? `That is ${formatRupiahCompact(p.realChange)} more than today in real terms, because property prices are assumed to grow faster than general prices.`
                  : `That is ${formatRupiahCompact(Math.abs(p.realChange))} less than today in real terms, because property prices are assumed to grow more slowly than general prices — even though the price tag ${p.nominalIncrease >= 0 ? "still rises" : "falls"}.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
