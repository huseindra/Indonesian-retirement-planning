import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../db/client";
import { DEMO_PASSWORD, DEMO_USERNAME } from "../db/seed";
import { DEFAULT_AUTHENTICATED_PATH, safeRedirectPath } from "./constants";
import { hashPassword, verifyPassword } from "./password";
import {
  SESSION_TTL_MS,
  authenticate,
  createSession,
  getUserForSessionToken,
  revokeSession,
} from "./service";

describe("password hashing", () => {
  it("verifies the original password and rejects others", () => {
    const hash = hashPassword("s3cret");
    expect(verifyPassword("s3cret", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });

  it("salts each hash", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("rejects malformed stored hashes", () => {
    expect(verifyPassword("x", "plaintext")).toBe(false);
  });
});

describe("auth service", () => {
  let db: Database;

  beforeEach(() => {
    db = openDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("authenticates the demo credentials", () => {
    expect(authenticate(DEMO_USERNAME, DEMO_PASSWORD, db)).toMatchObject({
      username: DEMO_USERNAME,
      fullName: expect.any(String),
    });
  });

  it("ignores surrounding whitespace in the username", () => {
    expect(authenticate("  demo ", DEMO_PASSWORD, db)).not.toBeNull();
  });

  it("rejects a wrong password or unknown user", () => {
    expect(authenticate(DEMO_USERNAME, "demo1234", db)).toBeNull();
    expect(authenticate("nobody", DEMO_PASSWORD, db)).toBeNull();
  });

  it("never exposes the password hash", () => {
    const user = authenticate(DEMO_USERNAME, DEMO_PASSWORD, db)!;
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("creates a session that resolves to the user until it is revoked", () => {
    const user = authenticate(DEMO_USERNAME, DEMO_PASSWORD, db)!;
    const { token } = createSession(user.id, new Date(), db);

    expect(getUserForSessionToken(token, new Date(), db)?.id).toBe(user.id);
    revokeSession(token, db);
    expect(getUserForSessionToken(token, new Date(), db)).toBeNull();
  });

  it("stores only a hash of the session token", () => {
    const user = authenticate(DEMO_USERNAME, DEMO_PASSWORD, db)!;
    const { token } = createSession(user.id, new Date(), db);
    const ids = db.prepare("SELECT id FROM sessions").all() as { id: string }[];
    expect(ids.map((row) => row.id)).not.toContain(token);
  });

  it("rejects expired sessions", () => {
    const user = authenticate(DEMO_USERNAME, DEMO_PASSWORD, db)!;
    const start = new Date("2026-01-01T00:00:00Z");
    const { token } = createSession(user.id, start, db);
    const afterExpiry = new Date(start.getTime() + SESSION_TTL_MS + 1);
    expect(getUserForSessionToken(token, afterExpiry, db)).toBeNull();
  });

  it("rejects unknown tokens", () => {
    expect(getUserForSessionToken("not-a-real-token", new Date(), db)).toBeNull();
  });
});

describe("safeRedirectPath", () => {
  it("allows same-origin relative paths", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/scenarios?tab=a")).toBe("/scenarios?tab=a");
  });

  it("falls back for external, protocol-relative or missing targets", () => {
    for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", null, ""]) {
      expect(safeRedirectPath(value)).toBe(DEFAULT_AUTHENTICATED_PATH);
    }
  });

  it("never redirects back to the login page", () => {
    expect(safeRedirectPath("/login")).toBe(DEFAULT_AUTHENTICATED_PATH);
  });
});
