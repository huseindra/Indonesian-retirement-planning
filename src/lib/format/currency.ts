const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formats whole Rupiah, e.g. `Rp 85.000.000`. */
export function formatRupiah(amount: number): string {
  // Intl separates the symbol with a non-breaking space; normalise it to a
  // regular space so output is predictable in tests and copy/paste.
  return rupiahFormatter.format(amount).replace(/ /g, " ");
}

const COMPACT_UNITS = [
  { value: 1_000_000_000_000, suffix: "T" }, // triliun
  { value: 1_000_000_000, suffix: "M" }, // miliar
  { value: 1_000_000, suffix: "jt" }, // juta
  { value: 1_000, suffix: "rb" }, // ribu
] as const;

const compactNumber = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/** Short Indonesian notation, e.g. `Rp 1,2 M` or `Rp 85 jt`. */
export function formatRupiahCompact(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);
  const unit = COMPACT_UNITS.find((u) => absolute >= u.value);
  if (!unit) return formatRupiah(amount);
  return `${sign}Rp ${compactNumber.format(absolute / unit.value)} ${unit.suffix}`;
}
