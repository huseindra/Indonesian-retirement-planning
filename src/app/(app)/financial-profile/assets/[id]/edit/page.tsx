import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAssetAction } from "@/app/actions/financial-profile";
import { ConfirmDelete } from "@/components/confirm-delete";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { formatRupiah } from "@/lib/format/currency";
import { getAsset } from "@/lib/services/financial-profile";
import { AssetForm } from "../../../asset-form";

export const metadata: Metadata = { title: "Edit Asset" };

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const assetId = Number(id);
  const asset = Number.isInteger(assetId) ? getAsset(user.id, assetId) : null;
  if (!asset) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/financial-profile" className="text-sm font-medium text-brand-700 hover:underline">
        ← Financial Profile
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <PageHeader title={`Edit “${asset.name}”`} description="Update the details or current balance." />
        <ConfirmDelete
          action={deleteAssetAction}
          hiddenFields={{ id: asset.id }}
          triggerLabel="Delete"
          title={`Delete “${asset.name}”?`}
          description={<>This removes the record with a balance of {formatRupiah(asset.balance)}.</>}
        />
      </div>
      <AssetForm
        defaults={{
          id: asset.id,
          name: asset.name,
          category: asset.category,
          institution: asset.institution ?? "",
          balance: String(asset.balance),
        }}
      />
    </div>
  );
}
