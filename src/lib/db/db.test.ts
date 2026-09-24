import BetterSqlite3 from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyPassword } from "../auth/password";
import { listAssetAccountsByUserId } from "../repositories/asset-accounts";
import { findFinancialProfileByUserId } from "../repositories/financial-profiles";
import { findUserByUsername } from "../repositories/users";
import { openDatabase, type Database } from "./client";
import { migrations, runMigrations } from "./migrations";
import { DEMO_PASSWORD, DEMO_USERNAME, E2E_USERS, seedDemoData } from "./seed";

describe("database setup", () => {
  let db: Database;

  beforeEach(() => {
    db = openDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("records every migration exactly once", () => {
    runMigrations(db);
    const applied = db.prepare("SELECT id FROM schema_migrations ORDER BY id").all();
    expect(applied).toEqual(migrations.map((m) => ({ id: m.id })));
  });

  it("seeds the demo user with a verifiable password", () => {
    const user = findUserByUsername(DEMO_USERNAME, db);
    expect(user).not.toBeNull();
    expect(user!.passwordHash).not.toContain(DEMO_PASSWORD);
    expect(verifyPassword(DEMO_PASSWORD, user!.passwordHash)).toBe(true);
  });

  it("seeds a complete financial profile and asset records for the demo user", () => {
    const user = findUserByUsername(DEMO_USERNAME, db)!;
    const profile = findFinancialProfileByUserId(user.id, db);
    const accounts = listAssetAccountsByUserId(user.id, db);

    expect(profile).toMatchObject({
      currentAge: 35,
      targetRetirementAge: 58,
      housingStatus: "rent",
      monthlyRent: 4_500_000,
      propertyValue: null,
    });
    expect(accounts.map((a) => a.category)).toEqual(
      expect.arrayContaining(["cash", "bpjs_jht", "pension"]),
    );
    const balances = accounts.map((a) => a.balance);
    expect(balances).toEqual([...balances].sort((a, b) => b - a));
  });

  it("does not duplicate seed data when run again", () => {
    seedDemoData(db);
    const { count } = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
    expect(count).toBe(1);
  });

  it("only seeds browser-test users when asked to", () => {
    process.env.SEED_E2E_USERS = "1";
    try {
      seedDemoData(db);
    } finally {
      delete process.env.SEED_E2E_USERS;
    }
    for (const username of E2E_USERS) {
      expect(findUserByUsername(username, db)).not.toBeNull();
    }
  });

  it("looks up usernames case-insensitively", () => {
    expect(findUserByUsername("DEMO", db)?.username).toBe(DEMO_USERNAME);
  });

  it("enforces housing consistency in the schema", () => {
    const userId = findUserByUsername(DEMO_USERNAME, db)!.id;
    expect(() =>
      db
        .prepare("UPDATE financial_profiles SET housing_status = 'family' WHERE user_id = ?")
        .run(userId),
    ).toThrow(/CHECK constraint/); // monthly_rent is still set
  });
});

describe("migration 2 (financial profile module)", () => {
  it("upgrades a Stage 1 database without losing data", () => {
    const db = new BetterSqlite3(":memory:");
    db.pragma("foreign_keys = ON");
    runMigrations(db, migrations.filter((m) => m.id === 1));

    const { lastInsertRowid } = db
      .prepare("INSERT INTO users (username, password_hash, full_name) VALUES ('old', 'x', 'Old User')")
      .run();
    const userId = Number(lastInsertRowid);
    db.prepare(
      `INSERT INTO financial_profiles
         (user_id, date_of_birth, target_retirement_age, city, monthly_income, monthly_expenses)
       VALUES (?, '1990-01-01', 60, 'Bandung', 20000000, 9000000)`,
    ).run(userId);
    const insertAsset = db.prepare(
      "INSERT INTO asset_accounts (user_id, name, category, institution, balance) VALUES (?, ?, ?, ?, ?)",
    );
    insertAsset.run(userId, "JHT", "pension", "BPJS Ketenagakerjaan", 50_000_000);
    insertAsset.run(userId, "DPLK", "pension", "Some DPLK", 10_000_000);
    insertAsset.run(userId, "Tabungan", "cash", "Bank", 5_000_000);

    runMigrations(db);

    const profile = findFinancialProfileByUserId(userId, db)!;
    const expectedAge = new Date().getFullYear() - 1990; // birthday is 1 January
    expect(profile).toMatchObject({
      currentAge: expectedAge,
      targetRetirementAge: 60,
      monthlyIncome: 20_000_000,
      monthlyExpenses: 9_000_000,
      housingStatus: "family",
      city: "Bandung",
    });

    const categories = Object.fromEntries(
      listAssetAccountsByUserId(userId, db).map((a) => [a.name, a.category]),
    );
    expect(categories).toEqual({ JHT: "bpjs_jht", DPLK: "pension", Tabungan: "cash" });
    db.close();
  });
});

describe("resolveDatabasePath", () => {
  const saved = { DATABASE_PATH: process.env.DATABASE_PATH, VERCEL: process.env.VERCEL };

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("prefers DATABASE_PATH, then /tmp on Vercel, then data/app.db", async () => {
    const { resolveDatabasePath } = await import("./client");
    delete process.env.DATABASE_PATH;
    delete process.env.VERCEL;
    expect(resolveDatabasePath()).toMatch(/data[/\\]app\.db$/);

    process.env.VERCEL = "1";
    expect(resolveDatabasePath()).toBe("/tmp/app.db");

    process.env.DATABASE_PATH = "/var/data/custom.db";
    expect(resolveDatabasePath()).toBe("/var/data/custom.db");
  });
});
