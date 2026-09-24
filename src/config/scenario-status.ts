/** Success messages on the Scenarios pages, keyed by `?status=`. */
export const SCENARIO_STATUS_MESSAGES = {
  created: "Scenario created. Its results were calculated from your baseline plan with the overrides you set.",
  updated: "Scenario updated and recalculated. Your baseline plan was not changed.",
  duplicated: "Scenario duplicated. Adjust the copy to explore a variation.",
  deleted: "Scenario deleted. Your baseline plan was not changed.",
  "examples-added": "Example scenarios added: Base, Conservative and Optimistic.",
  applied: "Selected assumptions were applied to your baseline plan.",
} as const;

export type ScenarioStatus = keyof typeof SCENARIO_STATUS_MESSAGES;

export function scenarioStatusMessage(status: unknown): string | null {
  return typeof status === "string" && status in SCENARIO_STATUS_MESSAGES
    ? SCENARIO_STATUS_MESSAGES[status as ScenarioStatus]
    : null;
}
