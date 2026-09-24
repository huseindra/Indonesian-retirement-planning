import { LIMITS } from "../domain/financial-profile";

/** Shared parsing helpers for server-side form validation. */

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type ValidationResult<T, K extends string> =
  | { ok: true; data: T }
  | { ok: false; errors: FieldErrors<K> };

/** Raw form values, e.g. `Object.fromEntries(formData)`. */
export type RawInput = Record<string, unknown>;

export function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Parses a whole-Rupiah amount typed by a user. Accepts `25000000`,
 * `25.000.000`, `Rp 25.000.000` and `25,000,000`; rejects decimals.
 */
export function parseRupiah(value: unknown): number | null {
  let s = text(value).replace(/^rp\.?\s*/i, "").replace(/\s/g, "");
  if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+$/.test(s)) return null;
  const amount = Number(s);
  return Number.isSafeInteger(amount) ? amount : null;
}

export function money(
  value: unknown,
  label: string,
  { positive = false }: { positive?: boolean } = {},
): { value: number } | { error: string } {
  if (text(value) === "") return { error: `Enter ${label}.` };
  const amount = parseRupiah(value);
  if (amount === null) return { error: `Enter ${label} as a whole Rupiah amount, e.g. 5.000.000.` };
  if (amount > LIMITS.maxMoney) return { error: `${capitalise(label)} is too large.` };
  if (positive && amount === 0) return { error: `${capitalise(label)} must be more than Rp 0.` };
  return { value: amount };
}

export function wholeNumber(value: unknown): number | null {
  const s = text(value);
  if (!/^\d{1,3}$/.test(s)) return null;
  return Number(s);
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

