/** Success messages shown after a financial-profile change, keyed by `?status=`. */
export const PROFILE_STATUS_MESSAGES = {
  "profile-created": "Your financial profile has been created. Your dashboard is now up to date.",
  "profile-updated": "Your financial profile has been updated.",
  "profile-deleted": "Your financial profile and all asset records have been deleted.",
  "asset-added": "Asset record added.",
  "asset-updated": "Asset record updated.",
  "asset-deleted": "Asset record deleted.",
} as const;

export type ProfileStatus = keyof typeof PROFILE_STATUS_MESSAGES;

export function profileStatusMessage(status: unknown): string | null {
  return typeof status === "string" && status in PROFILE_STATUS_MESSAGES
    ? PROFILE_STATUS_MESSAGES[status as ProfileStatus]
    : null;
}
