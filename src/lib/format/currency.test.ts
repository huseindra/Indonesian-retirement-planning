import { describe, expect, it } from "vitest";
import { formatRupiah, formatRupiahCompact } from "./currency";

describe("formatRupiah", () => {
  it("uses Indonesian thousand separators and no decimals", () => {
    expect(formatRupiah(85_000_000)).toBe("Rp 85.000.000");
    expect(formatRupiah(1_250_500)).toBe("Rp 1.250.500");
    expect(formatRupiah(0)).toBe("Rp 0");
  });

  it("rounds fractional amounts to whole Rupiah", () => {
    expect(formatRupiah(999.6)).toBe("Rp 1.000");
  });
});

describe("formatRupiahCompact", () => {
  it("uses Indonesian unit suffixes", () => {
    expect(formatRupiahCompact(85_000_000)).toBe("Rp 85 jt");
    expect(formatRupiahCompact(1_250_000_000)).toBe("Rp 1,3 M");
    expect(formatRupiahCompact(2_000_000_000_000)).toBe("Rp 2 T");
    expect(formatRupiahCompact(15_000)).toBe("Rp 15 rb");
  });

  it("falls back to full format for small amounts", () => {
    expect(formatRupiahCompact(500)).toBe("Rp 500");
  });
});
