import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { categoriesInGroup, isAssetGroup } from "@/lib/domain/financial-profile";
import { findFinancialProfileByUserId } from "@/lib/repositories/financial-profiles";
import { AssetForm } from "../../asset-form";

export const metadata: Metadata = { title: "Add Asset" };

export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const user = await requireUser();
  // Assets belong to a profile; send users to create one first.
  if (!findFinancialProfileByUserId(user.id)) redirect("/financial-profile/edit");

  const { group } = await searchParams;
  const category = isAssetGroup(group) ? categoriesInGroup(group)[0] : "";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/financial-profile" className="text-sm font-medium text-brand-700 hover:underline">
        ← Financial Profile
      </Link>
      <div className="mt-3">
        <PageHeader
          title="Add an asset"
          description="Cash and savings, investments, your BPJS Ketenagakerjaan JHT balance or another pension fund."
        />
      </div>
      <AssetForm defaults={{ name: "", category, institution: "", balance: "" }} />
    </div>
  );
}
