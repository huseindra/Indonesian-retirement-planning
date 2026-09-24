import type { AiInsightContent, ConfidenceLabel } from "../domain/ai-insights";
import { formatRupiah } from "../format/currency";
import { formatRate } from "../projection/compound";
import type { AiContext } from "./context";
import type { AiInsightProvider, GenerationOutcome } from "./provider";
import type { FinancialSignal } from "./signals";

/**
 * A template-based provider that narrates the same deterministic signals
 * the real Anthropic provider would receive — no network call. It exists
 * so the app has a working "AI" demo mode without an API key, and so the
 * successful-generation path can be tested without depending on a live
 * external service. It is not a substitute for the real thing: text is
 * assembled from fixed sentences around the actual numbers, not composed
 * freely. Selected with `AI_PROVIDER=mock`, or automatically when no
 * `ANTHROPIC_API_KEY` is configured and `AI_PROVIDER` is unset.
 */

function magnitudeConfidence(ratio: number): ConfidenceLabel {
  const abs = Math.abs(ratio);
  if (abs >= 0.15) return "high";
  if (abs >= 0.05) return "medium";
  return "low";
}

function insightFor(signal: FinancialSignal): AiInsightContent | null {
  switch (signal.kind) {
    case "funding_gap":
      return signal.hasShortfall
        ? {
            kind: "funding_gap",
            observation: `Your plan is projected to fall short by ${formatRupiah(Math.abs(signal.gap))} at retirement.`,
            reasoning: `Projected assets of ${formatRupiah(signal.retirementAssets)} cover ${(signal.fundedRatio * 100).toFixed(1)}% of the ${formatRupiah(signal.requiredFund)} required to fund your living costs to age ${signal.planUntilAge}.${signal.fundsRunOutAtAge !== null ? ` At the current trajectory, funds are projected to run out at age ${signal.fundsRunOutAtAge}.` : ""}`,
            citedValues: [formatRupiah(signal.gap), `${(signal.fundedRatio * 100).toFixed(1)}% funded`],
            confidence: magnitudeConfidence(1 - signal.fundedRatio),
            actionType: "none",
            actionLabel: "Review the Retirement Plan page for the full breakdown",
            actionPayload: {},
          }
        : {
            kind: "funding_gap",
            observation: `Your plan is projected to have a surplus of ${formatRupiah(signal.gap)} at retirement.`,
            reasoning: `Projected assets of ${formatRupiah(signal.retirementAssets)} are ahead of the ${formatRupiah(signal.requiredFund)} required to fund your living costs to age ${signal.planUntilAge}.`,
            citedValues: [formatRupiah(signal.gap)],
            confidence: "medium",
            actionType: "none",
            actionLabel: "No action needed under these assumptions",
            actionPayload: {},
          };

    case "inflation_sensitivity": {
      const swing = Math.abs(signal.gapSwingPerPoint);
      return {
        kind: "inflation_sensitivity",
        observation: `Your plan is sensitive to inflation: each 1-point change moves your funding gap by roughly ${formatRupiah(swing)}.`,
        reasoning: `At ${formatRate(signal.baseInflationBps + signal.deltaBps)} inflation the gap would be ${formatRupiah(signal.higherInflationGap)}; at ${formatRate(Math.max(0, signal.baseInflationBps - signal.deltaBps))} it would be ${formatRupiah(signal.lowerInflationGap)}, versus ${formatRupiah(signal.baseGap)} today at ${formatRate(signal.baseInflationBps)}.`,
        citedValues: [formatRupiah(signal.higherInflationGap), formatRupiah(signal.lowerInflationGap)],
        confidence: magnitudeConfidence(swing / Math.max(1, Math.abs(signal.baseGap))),
        actionType: "create_scenario",
        actionLabel: `Create a "Higher inflation" scenario at ${formatRate(signal.baseInflationBps + signal.deltaBps)}`,
        actionPayload: {
          name: "Higher inflation",
          retirementAge: null,
          monthlySpending: null,
          inflationBps: signal.baseInflationBps + signal.deltaBps,
          investmentReturnBps: null,
          retirementYears: null,
        },
      };
    }

    case "delay_retirement":
      if (signal.gapImprovement <= 0) return null;
      return {
        kind: "delay_retirement",
        observation: `Delaying retirement by ${signal.delayYears} years is projected to improve your funding gap by ${formatRupiah(signal.gapImprovement)}.`,
        reasoning: `Retiring at ${signal.delayedRetirementAge} instead of ${signal.currentRetirementAge} gives assets more time to grow and shortens the retirement period being funded, moving the gap from ${formatRupiah(signal.baseGap)} to ${formatRupiah(signal.delayedGap)}.`,
        citedValues: [formatRupiah(signal.gapImprovement)],
        confidence: magnitudeConfidence(signal.gapImprovement / Math.max(1, Math.abs(signal.baseGap))),
        actionType: "create_scenario",
        actionLabel: `Create a "Retire at ${signal.delayedRetirementAge}" scenario`,
        actionPayload: {
          name: `Retire at ${signal.delayedRetirementAge}`,
          retirementAge: signal.delayedRetirementAge,
          monthlySpending: null,
          inflationBps: null,
          investmentReturnBps: null,
          retirementYears: null,
        },
      };

    case "increase_savings":
      return {
        kind: "increase_savings",
        observation: `Saving an extra ${formatRupiah(signal.monthlySavingToCloseGap)} a month from now would be projected to close your funding gap by retirement.`,
        reasoning: `This is the level monthly saving, invested until retirement, that offsets today's shortfall of ${formatRupiah(Math.abs(signal.baseGap))} over the remaining ${signal.yearsToRetirement} years.`,
        citedValues: [formatRupiah(signal.monthlySavingToCloseGap)],
        confidence: "medium",
        actionType: "none",
        actionLabel: "Consider whether this saving rate is realistic for your budget",
        actionPayload: {},
      };

    case "property_purchase":
      if (signal.skippedReason) return null;
      return {
        kind: "property_purchase",
        observation:
          signal.gapImpact < 0
            ? `Buying "${signal.propertyName}" at age ${signal.purchaseAge} is projected to widen your funding gap by ${formatRupiah(Math.abs(signal.gapImpact))}.`
            : `Buying "${signal.propertyName}" at age ${signal.purchaseAge} has little projected effect on your retirement funding.`,
        reasoning: `Paying ${formatRupiah(signal.purchasePrice)} (at today's price) from savings at age ${signal.purchaseAge} changes the projected gap from ${formatRupiah(signal.baseGap)} to ${formatRupiah(signal.gapWithPurchase)}.${signal.unfundedAmount > 0 ? ` ${formatRupiah(signal.unfundedAmount)} of the purchase is projected to exceed what your assets can cover at that age.` : ""}`,
        citedValues: [formatRupiah(signal.gapImpact)],
        confidence: magnitudeConfidence(signal.gapImpact / Math.max(1, Math.abs(signal.baseGap))),
        actionType: "create_scenario",
        actionLabel: `Compare a scenario that includes buying "${signal.propertyName}"`,
        actionPayload: {
          name: `Buy ${signal.propertyName}`,
          retirementAge: null,
          monthlySpending: null,
          inflationBps: null,
          investmentReturnBps: null,
          retirementYears: null,
        },
      };

    case "scenario_comparison": {
      const most = signal.scenarios.find((s) => s.id === signal.mostDifferentScenarioId);
      if (!most || most.gap === null) return null;
      return {
        kind: "scenario_comparison",
        observation: `Of your saved scenarios, "${most.name}" differs most from your current plan, with a projected gap of ${formatRupiah(most.gap)} versus ${formatRupiah(signal.baselineGap)} today.`,
        reasoning: `Comparing ${signal.scenarios.length} scenarios against your baseline plan, "${most.name}" shows the largest change in funding outcome.`,
        citedValues: [formatRupiah(most.gap)],
        confidence: "medium",
        actionType: "none",
        actionLabel: `Open "${most.name}" to see the full comparison`,
        actionPayload: {},
      };
    }
  }
}

export class MockInsightProvider implements AiInsightProvider {
  readonly name = "mock";

  async generate(context: AiContext): Promise<GenerationOutcome> {
    const insights = context.signals.map(insightFor).filter((i): i is AiInsightContent => i !== null);
    return { status: "ready", insights, provider: this.name, model: null };
  }
}
