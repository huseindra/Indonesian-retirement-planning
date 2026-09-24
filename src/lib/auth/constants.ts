// Kept free of Node-only imports so middleware (edge runtime) can use it.
export const SESSION_COOKIE_NAME = "irp_session";

export const LOGIN_PATH = "/login";
export const DEFAULT_AUTHENTICATED_PATH = "/dashboard";

/**
 * Only allow same-origin relative paths as post-login redirects, so the
 * `next` query parameter cannot send users to another site.
 */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_AUTHENTICATED_PATH;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  if (value === LOGIN_PATH || value.startsWith(`${LOGIN_PATH}?`)) {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  return value;
}
