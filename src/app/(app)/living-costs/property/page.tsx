import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { formatRate } from "@/lib/projection/compound";
import { findFinancialProfileByUserId } from "@/lib/repositories/financial-profiles";
import { getAssumptions, getTargetProperty } from "@/lib/services/cost-projection";
import { PropertyForm } from "../property-form";

export const metadata: Metadata = { title: "Target Property" };

export default async function TargetPropertyPage() {
  const user = await requireUser();
  const profile = findFinancialProfileByUserId(user.id);
  // The purchase age is measured against the profile's current age.
  if (!profile) redirect("/financial-profile/edit");

  const property = getTargetProperty(user.id);
  const assumptions = getAssumptions(user.id);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/living-costs" className="text-sm font-medium text-brand-700 hover:underline">
        ← Living Costs
      </Link>
      <div className="mt-3">
        <PageHeader
          title={property ? "Edit target property" : "Add a target property"}
          description="We'll estimate its price at the age you expect to buy, and show how that compares in today's money."
        />
      </div>
      <PropertyForm
        isNew={!property}
        currentAge={profile.currentAge}
        assumedGrowth={formatRate(assumptions.values.housingGrowthBps)}
        defaults={{
          name: property?.name ?? "",
          currentPrice: property ? String(property.currentPrice) : "",
          purchaseAge: property ? String(property.purchaseAge) : "",
          growthBps:
            property?.growthBps == null
              ? ""
              : (property.growthBps / 100).toLocaleString("id-ID", { maximumFractionDigits: 2, useGrouping: false }),
        }}
      />
    </div>
  );
}
