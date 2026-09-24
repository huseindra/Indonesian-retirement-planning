import type { Metadata } from "next";
import Link from "next/link";
import { resetAssumptionsAction } from "@/app/actions/cost-projection";
import { ConfirmDelete } from "@/components/confirm-delete";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { DEFAULT_ASSUMPTIONS, type AssumptionKey } from "@/lib/domain/assumptions";
import { formatRate } from "@/lib/projection/compound";
import { getAssumptions } from "@/lib/services/cost-projection";
import { AssumptionsForm } from "../assumptions-form";

export const metadata: Metadata = { title: "Economic Assumptions" };

/** 350 bps → "3,5" — the format users type back in. */
function toInput(bps: number): string {
  return (bps / 100).toLocaleString("id-ID", { maximumFractionDigits: 2, useGrouping: false });
}

const KEYS: AssumptionKey[] = ["inflationBps", "housingGrowthBps", "investmentReturnBps"];

export default async function AssumptionsPage() {
  const user = await requireUser();
  const assumptions = getAssumptions(user.id);

  const defaults = Object.fromEntries(KEYS.map((k) => [k, toInput(assumptions.values[k])])) as Record<AssumptionKey, string>;
  const demoDefaults = Object.fromEntries(KEYS.map((k) => [k, formatRate(DEFAULT_ASSUMPTIONS[k])])) as Record<
    AssumptionKey,
    string
  >;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/living-costs" className="text-sm font-medium text-brand-700 hover:underline">
        ← Living Costs
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Economic assumptions"
          description="These rates drive every projection. They are your assumptions, not forecasts — change them to see the effect."
        />
        {assumptions.isDefault ? null : (
          <ConfirmDelete
            action={resetAssumptionsAction}
            tone="neutral"
            triggerIcon="reset"
            triggerLabel="Reset to defaults"
            title="Reset to the demo defaults?"
            description={
              <>
                Inflation {demoDefaults.inflationBps}, housing growth {demoDefaults.housingGrowthBps} and investment return{" "}
                {demoDefaults.investmentReturnBps} will be used again.
              </>
            }
            confirmLabel="Reset"
            pendingLabel="Resetting…"
          />
        )}
      </div>
      <AssumptionsForm defaults={defaults} demoDefaults={demoDefaults} />
    </div>
  );
}
