/**
 * Economic assumptions used by projections. Rates are integer basis points
 * (100 bps = 1%). Keep the limits in sync with the CHECK constraints in
 * migration 3 (`src/lib/db/migrations.ts`).
 */

export interface EconomicAssumptions {
  /** Annual general (consumer-price) inflation. */
  inflationBps: number;
  /** Annual growth in property prices. */
  housingGrowthBps: number;
  /** Expected annual return on invested savings (used by later stages). */
  investmentReturnBps: number;
}

/**
 * Demo defaults, chosen to be reasonable for Indonesia rather than precise
 * forecasts: Bank Indonesia's CPI target is 2.5% ± 1%, so 3% sits near the
 * upper part of that band; residential prices have tended to rise a little
 * faster than CPI; 7% is a moderate return for a balanced portfolio.
 */
export const DEFAULT_ASSUMPTIONS: EconomicAssumptions = {
  inflationBps: 300,
  housingGrowthBps: 500,
  investmentReturnBps: 700,
};

export type AssumptionKey = keyof EconomicAssumptions;

export const ASSUMPTION_LIMITS: Record<AssumptionKey, { minBps: number; maxBps: number }> = {
  inflationBps: { minBps: 0, maxBps: 3000 },
  housingGrowthBps: { minBps: -1000, maxBps: 3000 },
  investmentReturnBps: { minBps: -1000, maxBps: 3000 },
};

export const ASSUMPTION_LABELS: Record<AssumptionKey, string> = {
  inflationBps: "General inflation",
  housingGrowthBps: "Housing-price growth",
  investmentReturnBps: "Investment return",
};

export const ASSUMPTION_DESCRIPTIONS: Record<AssumptionKey, string> = {
  inflationBps:
    "How fast everyday prices rise each year. Used to project living costs and to express future amounts in today's money.",
  housingGrowthBps:
    "How fast property prices rise each year. Used for your target property unless you set a rate for it.",
  investmentReturnBps:
    "Expected yearly return on invested savings. Saved now; used by the retirement simulation.",
};

export const PROPERTY_LIMITS = {
  maxNameLength: 80,
  maxPurchaseAge: 100,
} as const;

/**
 * Default age the retirement money should last until. Indonesia's average
 * life expectancy is in the low 70s, but a plan should cover people who
 * live longer than average, so the default horizon is deliberately longer.
 */
export const DEFAULT_PLAN_UNTIL_AGE = 85;

export const PLAN_UNTIL_LIMITS = { min: 50, max: 120 } as const;
