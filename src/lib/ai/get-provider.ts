import { AnthropicInsightProvider } from "./anthropic-provider";
import { MockInsightProvider } from "./mock-provider";
import type { AiInsightProvider, GenerationOutcome } from "./provider";

export type ProviderSelection = { provider: AiInsightProvider } | { provider: null; reason: string };

/** Always fails, for exercising the "AI error" reliability path in tests without a live service. */
class AlwaysErrorProvider implements AiInsightProvider {
  readonly name = "mock-error";
  async generate(): Promise<GenerationOutcome> {
    return { status: "error", message: "Simulated failure for testing (AI_PROVIDER=mock-error)." };
  }
}

/**
 * Picks the AI provider from configuration:
 * - `AI_PROVIDER=mock` always uses the template-based demo provider.
 * - `AI_PROVIDER=mock-error` always reports an AI error — used to test that path.
 * - an `ANTHROPIC_API_KEY` uses the real Anthropic provider.
 * - `AI_PROVIDER=disabled` (or nothing configured) reports the service as
 *   unavailable — the rest of the app keeps working without it.
 */
export function getAiProvider(): ProviderSelection {
  const mode = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (mode === "mock") return { provider: new MockInsightProvider() };
  if (mode === "mock-error") return { provider: new AlwaysErrorProvider() };
  if (mode === "disabled") return { provider: null, reason: "AI Insights are turned off for this deployment." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) return { provider: new AnthropicInsightProvider(apiKey) };

  return { provider: null, reason: "AI Insights are not configured (no ANTHROPIC_API_KEY set)." };
}
