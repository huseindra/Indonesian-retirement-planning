/** Success messages shown on the Living Costs page, keyed by `?status=`. */
export const COST_STATUS_MESSAGES = {
  "assumptions-saved": "Economic assumptions saved. All projections have been recalculated.",
  "assumptions-reset": "Assumptions reset to the demo defaults. All projections have been recalculated.",
  "property-created": "Target property added.",
  "property-updated": "Target property updated.",
  "property-deleted": "Target property deleted.",
} as const;

export type CostStatus = keyof typeof COST_STATUS_MESSAGES;

export function costStatusMessage(status: unknown): string | null {
  return typeof status === "string" && status in COST_STATUS_MESSAGES
    ? COST_STATUS_MESSAGES[status as CostStatus]
    : null;
}
