import type { Database } from "better-sqlite3";
import { hashPassword } from "../auth/password";
import type { AssetCategory } from "../repositories/asset-accounts";

export const DEMO_USERNAME = "demo";
export const DEMO_PASSWORD = "demo123";

interface SeedAsset {
  name: string;
  category: AssetCategory;
  institution: string;
  balance: number;
}

const DEMO_PROFILE = {
  fullName: "Andi Wijaya",
  dateOfBirth: "1991-03-15",
  targetRetirementAge: 58,
  city: "Jakarta",
  monthlyIncome: 25_000_000,
  monthlyExpenses: 14_500_000,
};

const DEMO_ASSETS: SeedAsset[] = [
  { name: "Savings account", category: "cash", institution: "Bank account", balance: 85_000_000 },
  { name: "Time deposit (deposito)", category: "deposit", institution: "Bank account", balance: 150_000_000 },
  { name: "Mixed mutual fund (reksa dana)", category: "mutual_fund", institution: "Investment app", balance: 120_500_000 },
  { name: "Stock portfolio (IDX)", category: "stock", institution: "Brokerage", balance: 64_250_000 },
  { name: "Retail government bond (SBR)", category: "bond", institution: "Government bond", balance: 50_000_000 },
  { name: "BPJS Ketenagakerjaan – JHT", category: "pension", institution: "BPJS Ketenagakerjaan", balance: 92_300_000 },
  { name: "DPLK pension fund", category: "pension", institution: "DPLK provider", balance: 45_000_000 },
];

/**
 * Seeds the demo user with a financial profile and asset accounts. The
 * whole seed is skipped when the demo user already exists, so it never
 * overwrites data the user has changed.
 */
export function seedDemoData(db: Database): void {
  const seed = db.transaction(() => {
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(DEMO_USERNAME);
    if (existing) return;

    const { lastInsertRowid } = db
      .prepare("INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)")
      .run(DEMO_USERNAME, hashPassword(DEMO_PASSWORD), DEMO_PROFILE.fullName);
    const userId = Number(lastInsertRowid);

    db.prepare(
      `INSERT INTO financial_profiles
         (user_id, date_of_birth, target_retirement_age, city, monthly_income, monthly_expenses)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      userId,
      DEMO_PROFILE.dateOfBirth,
      DEMO_PROFILE.targetRetirementAge,
      DEMO_PROFILE.city,
      DEMO_PROFILE.monthlyIncome,
      DEMO_PROFILE.monthlyExpenses,
    );

    const insertAsset = db.prepare(
      "INSERT INTO asset_accounts (user_id, name, category, institution, balance) VALUES (?, ?, ?, ?, ?)",
    );
    for (const asset of DEMO_ASSETS) {
      insertAsset.run(userId, asset.name, asset.category, asset.institution, asset.balance);
    }
  });

  seed.immediate();
}
