import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../db/client";
import { DEMO_USERNAME } from "../db/seed";
import { listAssetAccountsByUserId } from "../repositories/asset-accounts";
import { findUserByUsername } from "../repositories/users";
import {
  createAsset,
  deleteFinancialData,
  getAsset,
  getFinancialOverview,
  removeAsset,
  saveFinancialProfile,
  updateAsset,
} from "./financial-profile";

const profileForm = {
  currentAge: "30",
  targetRetirementAge: "55",
  monthlyIncome: "15.000.000",
  monthlyExpenses: "7.000.000",
  housingStatus: "own",
  propertyValue: "900.000.000",
};

describe("financial profile service", () => {
  let db: Database;
  let demoId: number;
  let newUserId: number;

  beforeEach(() => {
    db = openDatabase(":memory:");
    demoId = findUserByUsername(DEMO_USERNAME, db)!.id;
    newUserId = Number(
      db
        .prepare("INSERT INTO users (username, password_hash, full_name) VALUES ('new', 'x', 'New')")
        .run().lastInsertRowid,
    );
  });

  afterEach(() => {
    db.close();
  });

  it("groups assets into the four reporting groups", () => {
    const overview = getFinancialOverview(demoId, db);
    const totals = Object.fromEntries(overview.groups.map((g) => [g.group, g.total]));

    expect(totals).toEqual({
      cash: 235_000_000,
      investments: 234_750_000,
      jht: 92_300_000,
      pension: 45_000_000,
    });
    expect(overview.totals).toEqual({
      savings: 469_750_000,
      pension: 137_300_000,
      all: 607_050_000,
    });
  });

  it("returns an empty overview for a user without data", () => {
    const overview = getFinancialOverview(newUserId, db);
    expect(overview.profile).toBeNull();
    expect(overview.accountCount).toBe(0);
    expect(overview.totals.all).toBe(0);
  });

  it("creates, then updates, a profile", () => {
    expect(saveFinancialProfile(newUserId, profileForm, db)).toEqual({ ok: true, created: true });
    expect(getFinancialOverview(newUserId, db).profile).toMatchObject({
      currentAge: 30,
      housingStatus: "own",
      propertyValue: 900_000_000,
    });

    const update = saveFinancialProfile(
      newUserId,
      { ...profileForm, housingStatus: "family", propertyValue: "" },
      db,
    );
    expect(update).toEqual({ ok: true, created: false });
    expect(getFinancialOverview(newUserId, db).profile).toMatchObject({
      housingStatus: "family",
      propertyValue: null,
    });
  });

  it("does not save an invalid profile", () => {
    const result = saveFinancialProfile(newUserId, { ...profileForm, currentAge: "" }, db);
    expect(result.ok).toBe(false);
    expect(getFinancialOverview(newUserId, db).profile).toBeNull();
  });

  it("requires a profile before assets can be added", () => {
    const result = createAsset(newUserId, { name: "Cash", category: "cash", balance: "1000" }, db);
    expect(result).toEqual({ ok: false, formError: expect.stringMatching(/financial profile/) });
  });

  it("creates, updates and deletes an asset", () => {
    saveFinancialProfile(newUserId, profileForm, db);
    expect(createAsset(newUserId, { name: "Cash", category: "cash", balance: "1.000.000" }, db).ok).toBe(true);
    const [asset] = listAssetAccountsByUserId(newUserId, db);

    expect(
      updateAsset(newUserId, asset.id, { name: "Emergency fund", category: "deposit", balance: "2.000.000" }, db),
    ).toEqual({ ok: true });
    expect(getAsset(newUserId, asset.id, db)).toMatchObject({
      name: "Emergency fund",
      category: "deposit",
      balance: 2_000_000,
    });

    expect(removeAsset(newUserId, asset.id, db)).toEqual({ ok: true });
    expect(getAsset(newUserId, asset.id, db)).toBeNull();
  });

  it("never lets a user read, change or delete another user's asset", () => {
    const demoAsset = listAssetAccountsByUserId(demoId, db)[0];

    expect(getAsset(newUserId, demoAsset.id, db)).toBeNull();
    expect(
      updateAsset(newUserId, demoAsset.id, { name: "Hacked", category: "cash", balance: "0" }, db).ok,
    ).toBe(false);
    expect(removeAsset(newUserId, demoAsset.id, db).ok).toBe(false);
    expect(getAsset(demoId, demoAsset.id, db)?.name).toBe(demoAsset.name);
  });

  it("deletes the profile together with all asset records", () => {
    expect(deleteFinancialData(demoId, db)).toEqual({ ok: true });
    const overview = getFinancialOverview(demoId, db);
    expect(overview.profile).toBeNull();
    expect(overview.accountCount).toBe(0);

    expect(deleteFinancialData(demoId, db).ok).toBe(false);
  });
});
