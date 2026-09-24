import { AnthropicInsightProvider } from "./anthropic-provider";
import { MockInsightProvider } from "./mock-provider";
import type { AiInsightProvider } from "./provider";

export type ProviderSelection = { provider: AiInsightProvider } | { provider: null; reason: string };

/**
 * Picks the AI provider from configuration:
 * - `AI_PROVIDER=mock` always uses the template-based demo provider.
 * - an `ANTHROPIC_API_KEY` uses the real Anthropic provider.
 * - `AI_PROVIDER=disabled` (or nothing configured) reports the service as
 *   unavailable — the rest of the app keeps working without it.
 */
export function getAiProvider(): ProviderSelection {
  const mode = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (mode === "mock") return { provider: new MockInsightProvider() };
  if (mode === "disabled") return { provider: null, reason: "AI Insights are turned off for this deployment." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) return { provider: new AnthropicInsightProvider(apiKey) };

  return { provider: null, reason: "AI Insights are not configured (no ANTHROPIC_API_KEY set)." };
}
