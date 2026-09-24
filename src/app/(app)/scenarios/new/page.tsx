import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { getScenarioBaseline } from "@/lib/services/scenarios";
import { baselineHints, formDefaults } from "../form-data";
import { ScenarioForm } from "../scenario-form";

export const metadata: Metadata = { title: "New Scenario" };

export default async function NewScenarioPage() {
  const user = await requireUser();
  const baseline = getScenarioBaseline(user.id);
  // Scenarios are overrides on a baseline; without a profile there is none.
  if (!baseline) redirect("/scenarios");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/scenarios" className="text-sm font-medium text-brand-700 hover:underline">
        ← Scenarios
      </Link>
      <div className="mt-3">
        <PageHeader
          title="New scenario"
          description="Starts from your baseline plan. Change only the assumptions you want to test — your saved profile is not modified."
        />
      </div>
      <ScenarioForm defaults={formDefaults(null)} baseline={baselineHints(baseline)} />
    </div>
  );
}
