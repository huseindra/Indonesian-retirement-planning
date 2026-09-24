import type { AssetCategory } from "@/lib/repositories/asset-accounts";

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  cash: "Cash & savings",
  deposit: "Time deposit",
  mutual_fund: "Mutual fund",
  stock: "Stocks",
  bond: "Bonds",
  pension: "Pension",
  other: "Other",
};
