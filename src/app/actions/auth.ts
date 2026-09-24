"use server";

import { redirect } from "next/navigation";
import { LOGIN_PATH, safeRedirectPath } from "@/lib/auth/constants";
import { authenticate } from "@/lib/auth/service";
import { endSession, startSession } from "@/lib/auth/session";

export interface LoginState {
  error: string | null;
  username: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Please enter both your username and password.", username };
  }

  try {
    const user = authenticate(username, password);
    if (!user) {
      return { error: "Incorrect username or password. Please try again.", username };
    }
    await startSession(user.id);
  } catch (error) {
    console.error("Login failed", error);
    return { error: "We couldn't sign you in right now. Please try again shortly.", username };
  }

  // redirect() throws, so it must stay outside the try/catch above.
  redirect(safeRedirectPath(formData.get("next")));
}

export async function logout(): Promise<void> {
  await endSession();
  redirect(`${LOGIN_PATH}?signedOut=1`);
}
