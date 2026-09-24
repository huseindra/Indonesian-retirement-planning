import type { Database } from "better-sqlite3";
import { hashPassword } from "../auth/password";
import type { AssetAccountInput } from "../repositories/asset-accounts";
import type { FinancialProfileInput } from "../repositories/financial-profiles";
import type { TargetPropertyInput } from "../repositories/target-properties";
import { DEFAULT_ASSUMPTIONS, DEFAULT_PLAN_UNTIL_AGE } from "../domain/assumptions";

export const DEMO_USERNAME = "demo";
export const DEMO_PASSWORD = "demo123";

const DEMO_FULL_NAME = "Andi Wijaya";

const DEMO_PROFILE: FinancialProfileInput = {
  currentAge: 35,
  targetRetirementAge: 58,
  monthlyIncome: 25_000_000,
  monthlyExpenses: 10_000_000,
  housingStatus: "rent",
  propertyValue: null,
  monthlyRent: 4_500_000,
  city: "Jakarta",
};

const DEMO_ASSETS: AssetAccountInput[] = [
  { name: "Savings account", category: "cash", institution: "Bank account", balance: 85_000_000 },
  { name: "Time deposit (deposito)", category: "deposit", institution: "Bank account", balance: 150_000_000 },
  { name: "Mixed mutual fund (reksa dana)", category: "mutual_fund", institution: "Investment app", balance: 120_500_000 },
  { name: "Stock portfolio (IDX)", category: "stock", institution: "Brokerage", balance: 64_250_000 },
  { name: "Retail government bond (SBR)", category: "bond", institution: "Government bond", balance: 50_000_000 },
  { name: "BPJS Ketenagakerjaan – JHT", category: "bpjs_jht", institution: "BPJS Ketenagakerjaan", balance: 92_300_000 },
  { name: "DPLK pension fund", category: "pension", institution: "DPLK provider", balance: 45_000_000 },
];

const DEMO_TARGET_PROPERTY: TargetPropertyInput = {
  name: "3-bedroom landed house in Tangerang Selatan",
  currentPrice: 1_500_000_000,
  purchaseAge: 40,
  growthBps: null, // follows the housing-growth assumption
};

/**
 * Users without a financial profile, used by browser tests so they can
 * create and delete data without touching the demo account. Only seeded
 * when SEED_E2E_USERS=1.
 */
export const E2E_USERS = ["e2e-desktop", "e2e-mobile"] as const;
export const E2E_PASSWORD = "e2e-pass-123";

function insertUser(db: Database, username: string, password: string, fullName: string): number {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)")
    .run(username, hashPassword(password), fullName);
  return Number(lastInsertRowid);
}

function userExists(db: Database, username: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM users WHERE username = ?").get(username));
}

/**
 * Seeds the demo user with a financial profile, asset accounts, economic
 * assumptions, a target property and retirement settings. Skipped
 * when the demo user already exists, so it never overwrites data the user
 * has changed.
 */
export function seedDemoData(db: Database): void {
  const seed = db.transaction(() => {
    if (!userExists(db, DEMO_USERNAME)) {
      const userId = insertUser(db, DEMO_USERNAME, DEMO_PASSWORD, DEMO_FULL_NAME);

      db.prepare(
        `INSERT INTO financial_profiles
           (user_id, current_age, target_retirement_age, monthly_income, monthly_expenses,
            housing_status, property_value, monthly_rent, city)
         VALUES (@userId, @currentAge, @targetRetirementAge, @monthlyIncome, @monthlyExpenses,
                 @housingStatus, @propertyValue, @monthlyRent, @city)`,
      ).run({ userId, ...DEMO_PROFILE });

      const insertAsset = db.prepare(
        `INSERT INTO asset_accounts (user_id, name, category, institution, balance)
         VALUES (@userId, @name, @category, @institution, @balance)`,
      );
      for (const asset of DEMO_ASSETS) insertAsset.run({ userId, ...asset });

      db.prepare(
        `INSERT INTO economic_assumptions (user_id, inflation_bps, housing_growth_bps, investment_return_bps)
         VALUES (@userId, @inflationBps, @housingGrowthBps, @investmentReturnBps)`,
      ).run({ userId, ...DEFAULT_ASSUMPTIONS });

      db.prepare(
        `INSERT INTO target_properties (user_id, name, current_price, purchase_age, growth_bps)
         VALUES (@userId, @name, @currentPrice, @purchaseAge, @growthBps)`,
      ).run({ userId, ...DEMO_TARGET_PROPERTY });

      db.prepare("INSERT INTO retirement_settings (user_id, plan_until_age) VALUES (?, ?)").run(
        userId,
        DEFAULT_PLAN_UNTIL_AGE,
      );
    }

    if (process.env.SEED_E2E_USERS === "1") {
      for (const username of E2E_USERS) {
        if (!userExists(db, username)) insertUser(db, username, E2E_PASSWORD, "Test User");
      }
    }
  });

  seed.immediate();
}
