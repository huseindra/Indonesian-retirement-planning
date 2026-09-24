import type { Metadata } from "next";
import Link from "next/link";
import { addExamplesAction, deleteScenarioAction, duplicateScenarioAction } from "@/app/actions/scenarios";
import { ConfirmDelete } from "@/components/confirm-delete";
import { SuccessAlert } from "@/components/forms/alerts";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { ComparisonTable, TrajectoryChart, planColor, type ComparedPlan } from "@/components/scenarios/comparison";
import { scenarioStatusMessage } from "@/config/scenario-status";
import { requireUser } from "@/lib/auth/session";
import { compareScenarios } from "@/lib/services/scenarios";
import { ActionButton } from "@/components/action-button";

export const metadata: Metadata = { title: "Scenarios" };

const card = "rounded-2xl border border-line bg-surface shadow-xs";
const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700";

export default async function ScenariosPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser();
  const { status } = await searchParams;
  const message = scenarioStatusMessage(status);
  const comparison = compareScenarios(user.id);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Scenarios"
          title="Compare what-if scenarios"
          description="Change assumptions in a scenario to see the trade-offs. Your baseline plan stays exactly as saved unless you choose to apply a scenario's assumptions to it."
        />
        {comparison.status === "ready" ? (
          <Link href="/scenarios/new" className={primaryButton}>
            <Icon name="plus" className="size-4" />
            New scenario
          </Link>
        ) : null}
      </div>

      <p className="mb-6 flex items-start gap-2 rounded-lg border border-line bg-surface px-3.5 py-3 text-xs text-muted">
        <Icon name="info" className="mt-0.5 size-4 shrink-0 text-brand-700" />
        Scenario names such as “Conservative” and “Optimistic” describe sets of assumptions, not predictions. Every
        result is an estimate from the same formulas as your Retirement Plan.
      </p>

      {message ? (
        <div className="mb-6">
          <SuccessAlert>{message}</SuccessAlert>
        </div>
      ) : null}

      {comparison.status === "incomplete" ? (
        <section className={`${card} grid place-items-center px-6 py-12 text-center`}>
          <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
            <Icon name="branches" className="size-6" />
          </span>
          <h2 className="mt-4 text-base font-semibold">Complete your financial profile to compare scenarios</h2>
          <p className="mt-1.5 max-w-md text-sm text-muted">
            Scenarios start from your baseline plan — your age, living costs and assets — and change only the
            assumptions you choose.
          </p>
          <Link href="/financial-profile/edit" className={`${primaryButton} mt-6`}>
            Complete financial profile
          </Link>
        </section>
      ) : (
        <Comparison comparison={comparison} />
      )}
    </>
  );
}

function Comparison({ comparison }: { comparison: Extract<ReturnType<typeof compareScenarios>, { status: "ready" }> }) {
  const plans: ComparedPlan[] = [
    {
      key: "baseline",
      name: "Your current plan",
      href: "/retirement-plan",
      color: planColor(0),
      isBaseline: true,
      outcome: comparison.baselineOutcome,
    },
    ...comparison.scenarios.map((s, i) => ({
      key: `scenario-${s.scenario.id}`,
      name: s.scenario.name,
      href: `/scenarios/${s.scenario.id}`,
      color: planColor(i + 1),
      isBaseline: false,
      outcome: s.outcome,
    })),
  ];

  return (
    <div className="space-y-6">
      {comparison.scenarios.length === 0 ? (
        <section className={`${card} grid place-items-center px-6 py-10 text-center`} data-testid="scenarios-empty">
          <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
            <Icon name="branches" className="size-6" />
          </span>
          <h2 className="mt-4 text-base font-semibold">No scenarios yet</h2>
          <p className="mt-1.5 max-w-md text-sm text-muted">
            Create your own, or start from three example assumption sets: Base, Conservative and Optimistic.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/scenarios/new" className={primaryButton}>
              <Icon name="plus" className="size-4" />
              New scenario
            </Link>
            <ActionButton action={addExamplesAction} label="Add example scenarios" pendingLabel="Adding…" />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="comparison-title" className={`${card} p-5 sm:p-6`}>
        <h2 id="comparison-title" className="text-base font-semibold">
          Side-by-side comparison
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Your current plan and each scenario, calculated by the same retirement engine.
        </p>
        <ComparisonTable plans={plans} />
      </section>

      <section aria-labelledby="trajectory-title" className={`${card} p-5 sm:p-6`}>
        <h2 id="trajectory-title" className="text-base font-semibold">
          Retirement trajectories
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Projected asset balance at each age: growing until retirement, then drawn down to pay living costs. A line
          reaching Rp 0 means the money runs out at that age. Plans with identical assumptions (such as Base and your
          current plan) overlap, and plans with a calculation error are left out.
        </p>
        <TrajectoryChart plans={plans} />
      </section>

      {comparison.scenarios.length > 0 ? (
        <section aria-labelledby="manage-title" className={`${card}`}>
          <h2 id="manage-title" className="border-b border-line px-5 py-4 text-base font-semibold sm:px-6">
            Your scenarios
          </h2>
          <ul className="divide-y divide-line">
            {comparison.scenarios.map(({ scenario, outcome }, i) => (
              <li key={scenario.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ background: planColor(i + 1) }} />
                    <Link href={`/scenarios/${scenario.id}`} className="hover:underline">
                      {scenario.name}
                    </Link>
                    {outcome.status === "error" ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-red-200">
                        Needs attention
                      </span>
                    ) : null}
                  </p>
                  {scenario.description ? <p className="mt-0.5 text-sm text-muted">{scenario.description}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/scenarios/${scenario.id}`}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-canvas"
                  >
                    View
                  </Link>
                  <Link
                    href={`/scenarios/${scenario.id}/edit`}
                    aria-label={`Edit ${scenario.name}`}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-canvas"
                  >
                    Edit
                  </Link>
                  <ActionButton
                    action={duplicateScenarioAction}
                    hiddenFields={{ id: scenario.id }}
                    label="Duplicate"
                    ariaLabel={`Duplicate ${scenario.name}`}
                    pendingLabel="Duplicating…"
                    size="sm"
                  />
                  <ConfirmDelete
                    action={deleteScenarioAction}
                    hiddenFields={{ id: scenario.id }}
                    variant="icon"
                    triggerLabel="Delete"
                    triggerAriaLabel={`Delete ${scenario.name}`}
                    title={`Delete “${scenario.name}”?`}
                    description="Only this scenario is removed. Your baseline plan and other scenarios are not affected."
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
