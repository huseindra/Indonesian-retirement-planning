import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "../repositories/users";
import { LOGIN_PATH, SESSION_COOKIE_NAME } from "./constants";
import { createSession, getUserForSessionToken, revokeSession } from "./service";

/**
 * Next.js request-scoped helpers around the session service. Anything that
 * touches cookies lives here; the rest of the auth logic stays framework-free.
 */

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? getUserForSessionToken(token) : null;
});

/** Returns the signed-in user or redirects to the login page. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

export async function startSession(userId: number): Promise<void> {
  const { token, expiresAt } = createSession(userId);
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // A `Secure` cookie is silently dropped by the browser on a plain HTTP
    // origin (anything but localhost) — `NODE_ENV === "production"` is not
    // a reliable proxy for "served over HTTPS" (e.g. `next start` behind a
    // plain-HTTP tunnel/proxy is still NODE_ENV=production), and marking
    // the cookie secure there breaks every navigation after login. Trust
    // the proxy's forwarded protocol (set by Vercel and most reverse
    // proxies) instead, defaulting to false when it's absent.
    secure: (await headers()).get("x-forwarded-proto") === "https",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) revokeSession(token);
  cookieStore.delete(SESSION_COOKIE_NAME);
}
