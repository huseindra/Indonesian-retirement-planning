/**
 * Financial-profile vocabulary shared by the database layer, validation,
 * services and UI. Keep these lists in sync with the CHECK constraints in
 * `src/lib/db/migrations.ts`.
 */

export const HOUSING_STATUSES = ["own", "rent", "family"] as const;
export type HousingStatus = (typeof HOUSING_STATUSES)[number];

export const HOUSING_STATUS_LABELS: Record<HousingStatus, string> = {
  own: "I own my home",
  rent: "I rent",
  family: "Living in a family-owned home",
};

export const ASSET_CATEGORIES = [
  "cash",
  "deposit",
  "mutual_fund",
  "stock",
  "bond",
  "other",
  "bpjs_jht",
  "pension",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/** The four asset groups the product reports on. */
export const ASSET_GROUPS = ["cash", "investments", "jht", "pension"] as const;
export type AssetGroup = (typeof ASSET_GROUPS)[number];

export const ASSET_GROUP_OF: Record<AssetCategory, AssetGroup> = {
  cash: "cash",
  deposit: "cash",
  mutual_fund: "investments",
  stock: "investments",
  bond: "investments",
  other: "investments",
  bpjs_jht: "jht",
  pension: "pension",
};

export const ASSET_GROUP_LABELS: Record<AssetGroup, string> = {
  cash: "Cash & savings",
  investments: "Investments",
  jht: "JHT – BPJS Ketenagakerjaan",
  pension: "Other pension funds",
};

export const ASSET_GROUP_DESCRIPTIONS: Record<AssetGroup, string> = {
  cash: "Savings accounts, cash and time deposits (deposito).",
  investments: "Mutual funds (reksa dana), stocks, bonds such as SBR/ORI, and other investments.",
  jht: "Your Jaminan Hari Tua balance with BPJS Ketenagakerjaan.",
  pension: "DPLK, employer pension plans (DPPK) and other retirement funds.",
};

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  cash: "Savings account / cash",
  deposit: "Time deposit (deposito)",
  mutual_fund: "Mutual fund (reksa dana)",
  stock: "Stocks",
  bond: "Bonds",
  other: "Other investment",
  bpjs_jht: "BPJS Ketenagakerjaan – JHT",
  pension: "Pension fund (DPLK / DPPK)",
};

export function categoriesInGroup(group: AssetGroup): AssetCategory[] {
  return ASSET_CATEGORIES.filter((c) => ASSET_GROUP_OF[c] === group);
}

/** Groups counted as retirement pension assets rather than savings. */
export function isPensionGroup(group: AssetGroup): boolean {
  return group === "jht" || group === "pension";
}

export function isAssetCategory(value: unknown): value is AssetCategory {
  return typeof value === "string" && (ASSET_CATEGORIES as readonly string[]).includes(value);
}

export function isAssetGroup(value: unknown): value is AssetGroup {
  return typeof value === "string" && (ASSET_GROUPS as readonly string[]).includes(value);
}

export function isHousingStatus(value: unknown): value is HousingStatus {
  return typeof value === "string" && (HOUSING_STATUSES as readonly string[]).includes(value);
}

// Validation limits, shared by server validation and form hints.
export const LIMITS = {
  minAge: 18,
  maxAge: 100,
  maxMoney: 1_000_000_000_000_000, // Rp 1 quadrillion; well inside Number.MAX_SAFE_INTEGER
  maxNameLength: 80,
  maxCityLength: 60,
} as const;
