import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyPassword } from "../auth/password";
import { listAssetAccountsByUserId } from "../repositories/asset-accounts";
import { findFinancialProfileByUserId } from "../repositories/financial-profiles";
import { findUserByUsername } from "../repositories/users";
import { openDatabase, type Database } from "./client";
import { migrations, runMigrations } from "./migrations";
import { DEMO_PASSWORD, DEMO_USERNAME, seedDemoData } from "./seed";

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

  it("seeds a financial profile and asset accounts for the demo user", () => {
    const user = findUserByUsername(DEMO_USERNAME, db)!;
    const profile = findFinancialProfileByUserId(user.id, db);
    const accounts = listAssetAccountsByUserId(user.id, db);

    expect(profile).toMatchObject({ targetRetirementAge: 58, city: "Jakarta" });
    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts.some((a) => a.category === "pension")).toBe(true);
    // Sorted largest balance first.
    const balances = accounts.map((a) => a.balance);
    expect(balances).toEqual([...balances].sort((a, b) => b - a));
  });

  it("does not duplicate seed data when run again", () => {
    seedDemoData(db);
    const { count } = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
    expect(count).toBe(1);
  });

  it("looks up usernames case-insensitively", () => {
    expect(findUserByUsername("DEMO", db)?.username).toBe(DEMO_USERNAME);
  });
});
