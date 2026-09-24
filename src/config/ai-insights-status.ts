/** Banner shown on the AI Insights page after an action, keyed by `?status=`. */
export type AiStatusTone = "success" | "info" | "warning";

export interface AiStatusMessage {
  tone: AiStatusTone;
  text: string;
}

/** `message` and `count` come from the corresponding query params, when present. */
export function aiInsightsStatusMessage(
  status: unknown,
  message: string | undefined,
  count: string | undefined,
): AiStatusMessage | null {
  if (typeof status !== "string") return null;
  switch (status) {
    case "generated":
      return { tone: "success", text: `Generated ${count ?? "some"} new insight${count === "1" ? "" : "s"} from your current plan.` };
    case "no-insights":
      return { tone: "info", text: "The AI didn't find anything notable to add right now." };
    case "unavailable":
      return { tone: "warning", text: message || "AI Insights are not available right now." };
    case "ai-error":
      return { tone: "warning", text: message ? `The AI service returned an error: ${message}` : "The AI service returned an error. Please try again." };
    case "baseline-error":
      return { tone: "warning", text: message || "Your plan has an inconsistency that needs fixing first." };
    case "incomplete":
      return { tone: "info", text: "Complete your financial profile first." };
    case "accepted":
      return { tone: "success", text: "Suggestion accepted. Nothing in your saved plan has changed yet." };
    case "rejected":
      return { tone: "success", text: "Suggestion rejected. Nothing in your saved plan was changed." };
    case "dismissed":
      return { tone: "success", text: "Suggestion dismissed. Nothing in your saved plan was changed." };
    case "edited":
      return { tone: "success", text: "Your edit was saved. Nothing in your saved plan has changed yet." };
    case "applied":
      return { tone: "success", text: "Applied to your saved plan." };
    default:
      return null;
  }
}
