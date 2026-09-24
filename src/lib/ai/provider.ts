import type { AiInsightContent } from "../domain/ai-insights";
import type { AiContext } from "./context";

/**
 * How a generation attempt can end. Kept distinct from HTTP-style errors
 * so the UI can tell "no AI is configured" (expected, calm) apart from
 * "we tried and it failed" (worth a retry).
 */
export type GenerationOutcome =
  | { status: "ready"; insights: AiInsightContent[]; provider: string; model: string | null }
  | { status: "unavailable"; reason: string }
  | { status: "error"; message: string };

export interface AiInsightProvider {
  readonly name: string;
  generate(context: AiContext): Promise<GenerationOutcome>;
}
