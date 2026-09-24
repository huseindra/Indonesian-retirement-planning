"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";
import { Icon } from "@/components/icons";

const initialState: LoginState = { error: null, username: "" };

const inputClass =
  "mt-1.5 block w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-base text-ink shadow-xs " +
  "placeholder:text-muted/70 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25 " +
  "disabled:opacity-60 aria-invalid:border-red-500 sm:text-sm";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const hasError = Boolean(state.error);

  return (
    <form action={formAction} className="mt-6 space-y-5" noValidate>
      <input type="hidden" name="next" value={nextPath} />

      {hasError ? (
        <div
          id="login-error"
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
        >
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div>
        <label htmlFor="username" className="block text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.username}
          // Re-mount after each failed attempt so the returned username is shown.
          key={state.username}
          disabled={pending}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? "login-error" : undefined}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? "login-error" : undefined}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? (
          <>
            <Icon name="spinner" className="size-4 animate-spin" />
            Signing in…
          </>
        ) : (
          <>
            <Icon name="lock" className="size-4" />
            Sign in
          </>
        )}
      </button>
    </form>
  );
}
