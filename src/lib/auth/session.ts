import { cookies } from "next/headers";
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
    secure: process.env.NODE_ENV === "production",
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
