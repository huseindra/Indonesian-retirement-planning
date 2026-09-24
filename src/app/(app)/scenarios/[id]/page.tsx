import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteScenarioAction, duplicateScenarioAction } from "@/app/actions/scenarios";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ErrorAlert, SuccessAlert } from "@/components/forms/alerts";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { ReadinessSummary, RetirementChart } from "@/components/retirement/readiness";
import { ComparisonTable, planColor, type ComparedPlan } from "@/components/scenarios/comparison";
import { scenarioStatusMessage } from "@/config/scenario-status";
import { requireUser } from "@/lib/auth/session";
import { APPLICABLE_FIELD_LABELS } from "@/lib/domain/scenarios";
import { formatRupiah } from "@/lib/format/currency";
import { formatRate } from "@/lib/projection/compound";
import type { ResolvedValue } from "@/lib/scenarios/resolve";
import { applicableFields, getScenarioDetail } from "@/lib/services/scenarios";
import { ActionButton } from "@/components/action-button";
import { ApplyForm, type ApplyOption } from "../apply-form";

export const metadata: Metadata = { title: "Scenario" };

const card = "rounded-2xl border border-line bg-surface shadow-xs";

type Format = (value: number) => string;
const years: Format = (v) => `${v} years`;
const age: Format = (v) => `${v}`;

function AssumptionRow({ label, value, format }: { label: string; value: ResolvedValue; format: Format }) {
  const overridden = value.source === "scenario";
  return (
    <tr className="border-b border-line last:border-0">
      <th scope="row" className="py-2.5 pr-4 text-left font-normal text-muted">
        {label}
      </th>
      <td className="py-2.5 pr-4 font-medium tabular-nums">
        {format(value.value)}
        {overridden ? (
          <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800 ring-1 ring-brand-200">
            Changed
          </span>
        ) : null}
      </td>
      <td className="py-2.5 text-muted tabular-nums">{value.baseline === null ? "—" : format(value.baseline)}</td>
    </tr>
  );
}

export default async function ScenarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { status } = await searchParams;
  const scenarioId = Number(id);
  const detail = Number.isInteger(scenarioId) ? getScenarioDetail(user.id, scenarioId) : { status: "not-found" as const };
  if (detail.status === "not-found") notFound();
  const message = scenarioStatusMessage(status);
  const scenario = detail.scenario;

  return (
    <>
      <Link href="/scenarios" className="text-sm font-medium text-brand-700 hover:underline">
        ← Scenarios
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <PageHeader eyebrow="Scenario" title={scenario.name} description={scenario.description ?? undefined} />
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/scenarios/${scenario.id}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-canvas"
          >
            <Icon name="pencil" className="size-4" />
            Edit
          </Link>
          <ActionButton action={duplicateScenarioAction} hiddenFields={{ id: scenario.id }} label="Duplicate" pendingLabel="Duplicating…" />
          <ConfirmDelete
            action={deleteScenarioAction}
            hiddenFields={{ id: scenario.id }}
            triggerLabel="Delete"
            title={`Delete “${scenario.name}”?`}
            description="Only this scenario is removed. Your baseline plan and other scenarios are not affected."
          />
        </div>
      </div>

      {message ? (
        <div className="mb-6">
          <SuccessAlert>{message}</SuccessAlert>
        </div>
      ) : null}

      {detail.status === "incomplete" ? (
        <ErrorAlert>
          This scenario can&apos;t be calculated without your financial profile.{" "}
          <Link href="/financial-profile/edit" className="font-semibold underline">
            Complete your financial profile
          </Link>
          .
        </ErrorAlert>
      ) : (
        <Ready detail={detail} />
      )}
    </>
  );
}

function Ready({ detail }: { detail: Extract<ReturnType<typeof getScenarioDetail>, { status: "ready" }> }) {
  const { scenario, resolved, outcome, baseline, baselineOutcome } = detail;
  const v = resolved.values;

  const plans: ComparedPlan[] = [
    { key: "baseline", name: "Your current plan", href: "/retirement-plan", color: planColor(0), isBaseline: true, outcome: baselineOutcome },
    { key: "scenario", name: scenario.name, href: `/scenarios/${scenario.id}`, color: planColor(1), isBaseline: false, outcome },
  ];

  const change = (field: keyof typeof v, format: Format) => `${format(v[field].baseline ?? 0)} → ${format(v[field].value)}`;
  const options: ApplyOption[] = applicableFields(scenario).map((field) => ({
    field,
    label: APPLICABLE_FIELD_LABELS[field],
    change:
      field === "retirementAge"
        ? change("retirementAge", age)
        : field === "monthlySpending"
          ? change("monthlySpending", formatRupiah)
          : field === "inflationBps"
            ? change("inflationBps", formatRate)
            : field === "investmentReturnBps"
              ? change("investmentReturnBps", formatRate)
              : field === "retirementYears"
                ? change("retirementYears", years)
                : resolved.property
                  ? `${formatRupiah(resolved.property.currentPrice.value)} at age ${resolved.property.purchaseAge.value}, growing ${formatRate(resolved.property.growthBps.value)} a year`
                  : "",
  }));

  return (
    <div className="space-y-6">
      <section aria-labelledby="assumptions-title" className={`${card} p-5 sm:p-6`}>
        <h2 id="assumptions-title" className="text-base font-semibold">
          Assumptions
        </h2>
        <p className="mt-1 text-sm text-muted">
          Values marked “Changed” are this scenario&apos;s overrides; the rest come from your baseline plan. Your age (
          {baseline.input.currentAge}) and assets always come from your Financial Profile.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm" data-testid="scenario-assumptions">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Assumption</th>
                <th scope="col" className="py-2 pr-4 font-medium">This scenario</th>
                <th scope="col" className="py-2 font-medium">Your plan</th>
              </tr>
            </thead>
            <tbody>
              <AssumptionRow label="Target retirement age" value={v.retirementAge} format={age} />
              <AssumptionRow label="Monthly spending (today's Rp)" value={v.monthlySpending} format={formatRupiah} />
              <AssumptionRow label="Annual inflation" value={v.inflationBps} format={formatRate} />
              <AssumptionRow label="Expected investment return" value={v.investmentReturnBps} format={formatRate} />
              <AssumptionRow label="Retirement duration" value={v.retirementYears} format={years} />
              {resolved.property ? (
                <>
                  <AssumptionRow label="Property price today" value={resolved.property.currentPrice} format={formatRupiah} />
                  <AssumptionRow label="Property purchase age" value={resolved.property.purchaseAge} format={age} />
                  <AssumptionRow label="Property-price growth" value={resolved.property.growthBps} format={formatRate} />
                </>
              ) : (
                <tr>
                  <th scope="row" className="py-2.5 pr-4 text-left font-normal text-muted">Property purchase</th>
                  <td className="py-2.5 pr-4 font-medium">Not included</td>
                  <td className="py-2.5 text-muted">Not included</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {outcome.status === "error" ? (
        <div data-testid="scenario-error">
          <ErrorAlert>
            <p className="font-semibold">This scenario can&apos;t be calculated.</p>
            <p className="mt-1">{outcome.message}</p>
            <Link href={`/scenarios/${scenario.id}/edit`} className="mt-1 inline-block font-semibold underline">
              Edit the scenario
            </Link>
          </ErrorAlert>
        </div>
      ) : (
        <>
          <section aria-labelledby="result-title" className={`${card} p-5 sm:p-6`}>
            <h2 id="result-title" className="mb-4 text-base font-semibold">
              Result under this scenario
            </h2>
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <ReadinessSummary result={outcome.result} />
              </div>
              <div className="lg:col-span-3">
                <RetirementChart result={outcome.result} />
              </div>
            </div>
          </section>
        </>
      )}

      <section aria-labelledby="versus-title" className={`${card} p-5 sm:p-6`}>
        <h2 id="versus-title" className="text-base font-semibold">
          Compared with your current plan
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">Both calculated by the same retirement engine.</p>
        <ComparisonTable plans={plans} />
      </section>

      <section aria-labelledby="apply-title" className={`${card} p-5 sm:p-6`}>
        <h2 id="apply-title" className="text-base font-semibold">
          Apply to your plan
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Experimenting here never changes your saved data. If you want to adopt some of these assumptions, choose them
          below — only the ticked values are copied.
        </p>
        {options.length === 0 ? (
          <p className="rounded-lg bg-canvas px-3.5 py-3 text-sm text-muted">
            This scenario doesn&apos;t change any assumption that can be applied — it matches your plan.
          </p>
        ) : (
          <ApplyForm scenarioId={scenario.id} options={options} />
        )}
      </section>
    </div>
  );
}
