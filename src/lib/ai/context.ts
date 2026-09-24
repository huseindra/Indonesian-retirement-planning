import type { FinancialSignal, SignalsStatus } from "./signals";

/**
 * The exact JSON sent to the AI provider. This is an allowlist, not a
 * blocklist: only the numeric/categorical fields listed here ever leave
 * the server. In particular this excludes the user's name, username,
 * email, city, session data, asset/institution names, property
 * descriptions and scenario descriptions — anything free-text or
 * identifying that the analysis does not need.
 */
export interface AiContext {
  profile: {
    currentAge: number;
    retirementAge: number;
    planUntilAge: number;
    monthlyLivingCost: number;
    inflationBps: number;
    investmentReturnBps: number;
  };
  signals: FinancialSignal[];
}

/** Builds the minimal, PII-free context from already-computed signals. */
export function buildAiContext(status: Extract<SignalsStatus, { status: "ready" }>): AiContext {
  const { input } = status.baseline;
  return {
    profile: {
      currentAge: input.currentAge,
      retirementAge: input.retirementAge,
      planUntilAge: input.planUntilAge,
      monthlyLivingCost: input.monthlyLivingCost,
      inflationBps: input.inflationBps,
      investmentReturnBps: input.investmentReturnBps,
    },
    // Signals are already numeric/categorical (see signals.ts) except
    // scenario names, which the user chose themselves and are useful for
    // the AI to refer to a scenario by; no institution or asset names,
    // free-text descriptions, or personal identifiers are included here.
    signals: status.signals,
  };
}
