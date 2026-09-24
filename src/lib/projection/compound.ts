/**
 * Deterministic compound-growth helpers. All rates are integer basis points
 * (1 bps = 0.01%, so 300 = 3.00% per year) and all amounts are whole Rupiah.
 * Results are rounded to the nearest Rupiah only at the end of a calculation.
 */

export const BPS_PER_UNIT = 10_000;

function assertYears(years: number): void {
  if (!Number.isInteger(years) || years < 0) {
    throw new RangeError(`years must be a non-negative integer, got ${years}`);
  }
}

/** (1 + rate)^years — how many times larger an amount becomes. */
export function growthFactor(rateBps: number, years: number): number {
  assertYears(years);
  return Math.pow(1 + rateBps / BPS_PER_UNIT, years);
}

/** Future nominal amount after compounding `rateBps` for `years`. */
export function compound(amount: number, rateBps: number, years: number): number {
  return Math.round(amount * growthFactor(rateBps, years));
}

/**
 * Expresses a future amount in today's money by removing inflation — i.e.
 * what that future sum could buy at today's prices.
 */
export function toTodaysMoney(futureAmount: number, inflationBps: number, years: number): number {
  return Math.round(futureAmount / growthFactor(inflationBps, years));
}

/**
 * Growth above inflation, as a fraction: (1 + nominal) / (1 + inflation) − 1.
 * Positive means the thing grows faster than general prices.
 */
export function realRate(nominalBps: number, inflationBps: number): number {
  return (1 + nominalBps / BPS_PER_UNIT) / (1 + inflationBps / BPS_PER_UNIT) - 1;
}

/** Formats basis points as a percentage string for explanations, e.g. 350 → "3,50%". */
export function formatRate(bps: number): string {
  return `${(bps / 100).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
