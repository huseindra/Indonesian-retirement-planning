import Anthropic from "@anthropic-ai/sdk";
import { INSIGHT_KINDS } from "../domain/ai-insights";
import type { AiContext } from "./context";
import type { AiInsightProvider, GenerationOutcome } from "./provider";
import { validateAiResponse } from "./validate-response";

/** Default model for this feature; override with ANTHROPIC_MODEL. */
const DEFAULT_MODEL = "claude-sonnet-5";
const REQUEST_TIMEOUT_MS = 20_000;
const TOOL_NAME = "report_insights";

const SYSTEM_PROMPT = `You are a financial-plan interpreter inside an Indonesian retirement-planning app.

You are given ALREADY-CALCULATED, deterministic simulation results (a fixed compound-interest engine
computed every number). Your job is to explain and interpret these numbers in plain language — you must
NOT invent, recalculate, or adjust any financial figure. Every number you cite in "citedValues" must be
copied from the data you were given, not computed by you.

For each signal present in the input, produce at most one insight object. Skip a signal if it has nothing
useful to say (e.g. a surplus that needs no action). "kind" must exactly match one of the signal kinds you
were given. "confidence" reflects how strongly the data supports the observation (low/medium/high), not
your certainty about the future — always frame projections as estimates from assumptions, never guarantees.

"actionType" must be one of:
- "none": purely informational, no data-modifying action.
- "create_scenario": propose creating a NEW what-if scenario (never modifies the user's saved plan).
  actionPayload: { name, retirementAge, monthlySpending, inflationBps (basis points, 300 = 3%),
  investmentReturnBps (basis points), retirementYears } — set only the fields this scenario should
  override; leave the rest null.
- "update_assumptions": propose changing the user's saved economic assumptions.
  actionPayload: { inflationBps, investmentReturnBps } (basis points, or null to leave unchanged).
Only ever propose one of these three action types — never propose editing assets, income, or any field
not listed here.

Write in plain, concise English suitable for someone with no finance background. Do not use markdown.`;

const TOOL_SCHEMA = {
  name: TOOL_NAME,
  description: "Report structured retirement-plan insights derived from the given deterministic data.",
  input_schema: {
    type: "object" as const,
    properties: {
      insights: {
        type: "array" as const,
        maxItems: 8,
        items: {
          type: "object" as const,
          properties: {
            kind: { type: "string" as const, enum: [...INSIGHT_KINDS] },
            observation: { type: "string" as const },
            reasoning: { type: "string" as const },
            citedValues: { type: "array" as const, items: { type: "string" as const } },
            confidence: { type: "string" as const, enum: ["low", "medium", "high"] },
            actionType: { type: "string" as const, enum: ["none", "create_scenario", "update_assumptions"] },
            actionLabel: { type: "string" as const },
            actionPayload: { type: "object" as const },
          },
          required: ["kind", "observation", "reasoning", "confidence", "actionType", "actionLabel"],
        },
      },
    },
    required: ["insights"],
  },
};

export class AnthropicInsightProvider implements AiInsightProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });
    this.model = model;
  }

  async generate(context: AiContext): Promise<GenerationOutcome> {
    const presentKinds = context.signals.map((s) => s.kind);
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "tool", name: TOOL_NAME },
        messages: [
          {
            role: "user",
            content: `Deterministic financial data (JSON):\n${JSON.stringify(context)}`,
          },
        ],
      });

      const toolUse = response.content.find((block) => block.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        return { status: "error", message: "The AI response did not include the expected structured output." };
      }
      const raw = (toolUse.input as { insights?: unknown }).insights;
      const insights = validateAiResponse(raw, presentKinds);
      return { status: "ready", insights, provider: this.name, model: this.model };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Anthropic insight generation failed", error);
      return { status: "error", message: `The AI service could not be reached: ${message}` };
    }
  }
}
