import { getDb, type Database } from "../db/client";
import {
  RetirementInputError,
  simulateRetirement,
  type RetirementInput,
  type RetirementResult,
} from "../projection/retirement";
import { compareScenarios, getScenarioBaseline } from "../services/scenarios";
import { getRetirementPlan } from "../services/retirement-plan";

/**
 * Deterministic "signals": structured, numeric observations derived from
 * the existing calculation engine (Stages 3–5). Nothing here is invented —
 * every figure is either read straight from an engine result or produced
 * by re-running `simulateRetirement` with one input changed, exactly like
 * a scenario does. The AI layer (`ai/provider.ts`) only narrates these
 * pre-computed numbers; it never computes financial values itself.
 */

/** How much we nudge inflation up/down to gauge sensitivity, in bps (1%). */
export const INFLATION_SENSITIVITY_DELTA_BPS = 100;
/** How many years we test delaying retirement by. */
export const DELAY_RETIREMENT_YEARS = 2;

export interface FundingGapSignal {
  kind: "funding_gap";
  hasShortfall: boolean;
  gap: number;
  fundedRatio: number;
  requiredFund: number;
  retirementAssets: number;
  monthlySavingToCloseGap: number;
  fundsRunOutAtAge: number | null;
  planUntilAge: number;
}

export interface InflationSensitivitySignal {
  kind: "inflation_sensitivity";
  baseInflationBps: number;
  deltaBps: number;
  baseGap: number;
  higherInflationGap: number;
  lowerInflationGap: number;
  /** How much the gap moves for a 1-point swing in inflation, in either direction. */
  gapSwingPerPoint: number;
}

export interface DelayRetirementSignal {
  kind: "delay_retirement";
  delayYears: number;
  currentRetirementAge: number;
  delayedRetirementAge: number;
  baseGap: number;
  delayedGap: number;
  gapImprovement: number;
}

export interface IncreaseSavingsSignal {
  kind: "increase_savings";
  baseGap: number;
  monthlySavingToCloseGap: number;
  yearsToRetirement: number;
}

export interface PropertyPurchaseSignal {
  kind: "property_purchase";
  propertyName: string;
  purchasePrice: number;
  purchaseAge: number;
  baseGap: number;
  gapWithPurchase: number;
  gapImpact: number;
  unfundedAmount: number;
  /** Set when the purchase age falls outside the working years and could not be simulated. */
  skippedReason: string | null;
}

export interface ScenarioSummary {
  id: number;
  name: string;
  status: "ready" | "error";
  retirementAge: number | null;
  gap: number | null;
  requiredFund: number | null;
  retirementAssets: number | null;
  errorMessage: string | null;
}

export interface ScenarioComparisonSignal {
  kind: "scenario_comparison";
  baselineGap: number;
  scenarios: ScenarioSummary[];
  /** The scenario whose gap differs most from the baseline, if any. */
  mostDifferentScenarioId: number | null;
}

export type FinancialSignal =
  | FundingGapSignal
  | InflationSensitivitySignal
  | DelayRetirementSignal
  | IncreaseSavingsSignal
  | PropertyPurchaseSignal
  | ScenarioComparisonSignal;

export type SignalsStatus =
  | { status: "incomplete" }
  | { status: "error"; message: string }
  | { status: "ready"; signals: FinancialSignal[]; baseline: RetirementResult };

/** Re-runs the engine with one field changed — the same pattern scenarios use. */
function rerun(base: RetirementInput, changes: Partial<RetirementInput>): RetirementResult | null {
  try {
    return simulateRetirement({ ...base, ...changes });
  } catch (error) {
    if (error instanceof RetirementInputError) return null;
    throw error;
  }
}

export function computeFinancialSignals(userId: number, db: Database = getDb()): SignalsStatus {
  const plan = getRetirementPlan(userId, db);
  if (plan.status === "incomplete") return { status: "incomplete" };
  if (plan.status === "error") return { status: "error", message: plan.message };

  const base = plan.result;
  const input = base.input;
  const signals: FinancialSignal[] = [];

  signals.push({
    kind: "funding_gap",
    hasShortfall: base.status === "shortfall",
    gap: base.gap,
    fundedRatio: base.fundedRatio,
    requiredFund: base.requiredFund,
    retirementAssets: base.retirementAssets,
    monthlySavingToCloseGap: base.monthlySavingToCloseGap,
    fundsRunOutAtAge: base.fundsRunOutAtAge,
    planUntilAge: input.planUntilAge,
  });

  const higher = rerun(input, { inflationBps: input.inflationBps + INFLATION_SENSITIVITY_DELTA_BPS });
  const lower = rerun(input, {
    inflationBps: Math.max(0, input.inflationBps - INFLATION_SENSITIVITY_DELTA_BPS),
  });
  if (higher && lower) {
    signals.push({
      kind: "inflation_sensitivity",
      baseInflationBps: input.inflationBps,
      deltaBps: INFLATION_SENSITIVITY_DELTA_BPS,
      baseGap: base.gap,
      higherInflationGap: higher.gap,
      lowerInflationGap: lower.gap,
      gapSwingPerPoint: Math.round((lower.gap - higher.gap) / 2),
    });
  }

  const delayed = rerun(input, { retirementAge: input.retirementAge + DELAY_RETIREMENT_YEARS });
  if (delayed) {
    signals.push({
      kind: "delay_retirement",
      delayYears: DELAY_RETIREMENT_YEARS,
      currentRetirementAge: input.retirementAge,
      delayedRetirementAge: input.retirementAge + DELAY_RETIREMENT_YEARS,
      baseGap: base.gap,
      delayedGap: delayed.gap,
      gapImprovement: delayed.gap - base.gap,
    });
  }

  if (base.status === "shortfall" && base.monthlySavingToCloseGap > 0) {
    signals.push({
      kind: "increase_savings",
      baseGap: base.gap,
      monthlySavingToCloseGap: base.monthlySavingToCloseGap,
      yearsToRetirement: base.yearsToRetirement,
    });
  }

  const baseline = getScenarioBaseline(userId, db);
  const targetProperty = baseline?.targetProperty ?? null;
  if (targetProperty) {
    const growthBps = targetProperty.growthBps ?? baseline!.housingGrowthBps;
    const withPurchase = rerun(input, {
      propertyPurchase: {
        currentPrice: targetProperty.currentPrice,
        purchaseAge: targetProperty.purchaseAge,
        growthBps,
      },
    });
    if (withPurchase) {
      signals.push({
        kind: "property_purchase",
        propertyName: targetProperty.name,
        purchasePrice: targetProperty.currentPrice,
        purchaseAge: targetProperty.purchaseAge,
        baseGap: base.gap,
        gapWithPurchase: withPurchase.gap,
        gapImpact: withPurchase.gap - base.gap,
        unfundedAmount: withPurchase.property?.unfundedAmount ?? 0,
        skippedReason: null,
      });
    } else {
      signals.push({
        kind: "property_purchase",
        propertyName: targetProperty.name,
        purchasePrice: targetProperty.currentPrice,
        purchaseAge: targetProperty.purchaseAge,
        baseGap: base.gap,
        gapWithPurchase: base.gap,
        gapImpact: 0,
        unfundedAmount: 0,
        skippedReason: `The purchase age (${targetProperty.purchaseAge}) is outside your working years (${input.currentAge}–${input.retirementAge}), so it could not be simulated.`,
      });
    }
  }

  const comparison = compareScenarios(userId, db);
  if (comparison.status === "ready" && comparison.scenarios.length > 0) {
    const summaries: ScenarioSummary[] = comparison.scenarios.map(({ scenario, outcome }) => ({
      id: scenario.id,
      name: scenario.name,
      status: outcome.status,
      retirementAge: outcome.status === "ready" ? outcome.result.input.retirementAge : null,
      gap: outcome.status === "ready" ? outcome.result.gap : null,
      requiredFund: outcome.status === "ready" ? outcome.result.requiredFund : null,
      retirementAssets: outcome.status === "ready" ? outcome.result.retirementAssets : null,
      errorMessage: outcome.status === "error" ? outcome.message : null,
    }));
    const withGap = summaries.filter((s): s is ScenarioSummary & { gap: number } => s.gap !== null);
    const mostDifferent = withGap.reduce<ScenarioSummary | null>((worst, s) => {
      if (!worst || worst.gap === null) return s;
      return Math.abs(s.gap - base.gap) > Math.abs(worst.gap - base.gap) ? s : worst;
    }, null);
    signals.push({
      kind: "scenario_comparison",
      baselineGap: base.gap,
      scenarios: summaries,
      mostDifferentScenarioId: mostDifferent?.id ?? null,
    });
  }

  return { status: "ready", signals, baseline: base };
}
