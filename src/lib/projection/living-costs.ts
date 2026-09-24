import { compound, growthFactor, toTodaysMoney } from "./compound";

export interface LivingCostInput {
  /** Current monthly living cost, whole Rupiah. */
  monthlyCost: number;
  currentAge: number;
  retirementAge: number;
  /** Annual general inflation, basis points. */
  inflationBps: number;
}

export interface LivingCostPoint {
  age: number;
  yearsFromNow: number;
  monthly: number;
}

export interface LivingCostProjection {
  years: number;
  inflationBps: number;
  inflationFactor: number;
  current: { monthly: number; annual: number };
  atRetirement: { monthly: number; annual: number };
  /** Nominal increase between today and retirement. */
  increase: { monthly: number; annual: number; percent: number };
  /** What Rp 1.000.000 held as cash until retirement buys, in today's prices. */
  purchasingPowerOfOneMillion: number;
  /** Share of purchasing power left at retirement, 0–1. */
  purchasingPowerRemaining: number;
  /** One point per year from today to retirement (inclusive). */
  series: LivingCostPoint[];
}

export const ONE_MILLION = 1_000_000;

/**
 * Projects today's living cost to the retirement age with compound
 * inflation: cost × (1 + inflation)^(retirementAge − currentAge).
 *
 * Annual figures are 12 × the monthly figure (rounded monthly first), so
 * the monthly and annual numbers shown always agree with each other.
 */
export function projectLivingCost(input: LivingCostInput): LivingCostProjection {
  const { monthlyCost, currentAge, retirementAge, inflationBps } = input;
  if (retirementAge < currentAge) {
    throw new RangeError("retirementAge must not be earlier than currentAge");
  }
  const years = retirementAge - currentAge;

  const futureMonthly = compound(monthlyCost, inflationBps, years);
  const factor = growthFactor(inflationBps, years);

  const series: LivingCostPoint[] = [];
  for (let n = 0; n <= years; n++) {
    series.push({ age: currentAge + n, yearsFromNow: n, monthly: compound(monthlyCost, inflationBps, n) });
  }

  return {
    years,
    inflationBps,
    inflationFactor: factor,
    current: { monthly: monthlyCost, annual: monthlyCost * 12 },
    atRetirement: { monthly: futureMonthly, annual: futureMonthly * 12 },
    increase: {
      monthly: futureMonthly - monthlyCost,
      annual: (futureMonthly - monthlyCost) * 12,
      percent: monthlyCost > 0 ? futureMonthly / monthlyCost - 1 : 0,
    },
    purchasingPowerOfOneMillion: toTodaysMoney(ONE_MILLION, inflationBps, years),
    purchasingPowerRemaining: 1 / factor,
    series,
  };
}
