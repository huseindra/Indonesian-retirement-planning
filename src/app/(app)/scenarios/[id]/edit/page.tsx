import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SuccessAlert } from "@/components/forms/alerts";
import { PageHeader } from "@/components/page-header";
import { scenarioStatusMessage } from "@/config/scenario-status";
import { requireUser } from "@/lib/auth/session";
import { getScenario, getScenarioBaseline } from "@/lib/services/scenarios";
import { baselineHints, formDefaults } from "../../form-data";
import { ScenarioForm } from "../../scenario-form";

export const metadata: Metadata = { title: "Edit Scenario" };

export default async function EditScenarioPage({
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
  const scenario = Number.isInteger(scenarioId) ? getScenario(user.id, scenarioId) : null;
  if (!scenario) notFound();
  const baseline = getScenarioBaseline(user.id);
  if (!baseline) redirect("/scenarios");
  const message = scenarioStatusMessage(status);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/scenarios/${scenario.id}`} className="text-sm font-medium text-brand-700 hover:underline">
        ← {scenario.name}
      </Link>
      <div className="mt-3">
        <PageHeader title={`Edit “${scenario.name}”`} description="Changes recalculate this scenario only. Your baseline plan is not modified." />
      </div>
      {message ? (
        <div className="mb-6">
          <SuccessAlert>{message}</SuccessAlert>
        </div>
      ) : null}
      <ScenarioForm defaults={formDefaults(scenario)} baseline={baselineHints(baseline)} />
    </div>
  );
}
