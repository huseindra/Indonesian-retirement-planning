import { describe, expect, it } from "vitest";
import { calculateAge } from "./age";

describe("calculateAge", () => {
  it("counts a birthday that already happened this year", () => {
    expect(calculateAge("1991-03-15", new Date(2026, 8, 24))).toBe(35);
  });

  it("does not count a birthday later this year", () => {
    expect(calculateAge("1991-12-01", new Date(2026, 8, 24))).toBe(34);
  });

  it("counts the birthday itself", () => {
    expect(calculateAge("1991-09-24", new Date(2026, 8, 24))).toBe(35);
    expect(calculateAge("1991-09-25", new Date(2026, 8, 24))).toBe(34);
  });

  it("rejects malformed dates", () => {
    expect(() => calculateAge("not-a-date")).toThrow();
  });
});
