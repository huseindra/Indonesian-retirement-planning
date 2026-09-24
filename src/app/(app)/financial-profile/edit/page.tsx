import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { findFinancialProfileByUserId } from "@/lib/repositories/financial-profiles";
import { ProfileForm, type ProfileFormDefaults } from "../profile-form";

export const metadata: Metadata = { title: "Edit Financial Profile" };

const toText = (value: number | null) => (value === null ? "" : String(value));

export default async function EditFinancialProfilePage() {
  const user = await requireUser();
  const profile = findFinancialProfileByUserId(user.id);

  const defaults: ProfileFormDefaults = profile
    ? {
        currentAge: String(profile.currentAge),
        targetRetirementAge: String(profile.targetRetirementAge),
        monthlyIncome: String(profile.monthlyIncome),
        monthlyExpenses: String(profile.monthlyExpenses),
        housingStatus: profile.housingStatus,
        propertyValue: toText(profile.propertyValue),
        monthlyRent: toText(profile.monthlyRent),
        city: profile.city ?? "",
      }
    : {
        currentAge: "",
        targetRetirementAge: "",
        monthlyIncome: "",
        monthlyExpenses: "",
        housingStatus: "",
        propertyValue: "",
        monthlyRent: "",
        city: "",
      };

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/financial-profile" className="text-sm font-medium text-brand-700 hover:underline">
        ← Financial Profile
      </Link>
      <div className="mt-3">
        <PageHeader
          title={profile ? "Edit financial profile" : "Create your financial profile"}
          description="All amounts are in Rupiah. You can change these at any time."
        />
      </div>
      <ProfileForm defaults={defaults} isNew={!profile} />
    </div>
  );
}
