import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { safeRedirectPath } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

interface LoginPageProps {
  searchParams: Promise<{ next?: string; signedOut?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, signedOut } = await searchParams;
  const nextPath = safeRedirectPath(next);

  // Already signed in: skip the form.
  if (await getCurrentUser()) redirect(nextPath);

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-brand-800 p-12 text-brand-50 lg:flex">
        <span className="text-sm font-medium uppercase tracking-widest text-brand-200">
          Pensiun Planner
        </span>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight text-white">
            Know whether you are on track for the retirement you want.
          </h2>
          <p className="mt-4 text-brand-100">
            Bring your income, savings, BPJS and DPLK balances, living costs and future housing
            plans together in one place.
          </p>
        </div>
        <p className="text-sm text-brand-200">Amounts shown in Indonesian Rupiah (IDR).</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Brand className="mb-10" />

          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1.5 text-sm text-muted">Welcome back. Sign in to view your dashboard.</p>

          {signedOut ? (
            <p
              role="status"
              className="mt-6 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-3 text-sm text-brand-800"
            >
              <Icon name="check" className="mt-0.5 size-4 shrink-0" />
              You have been signed out.
            </p>
          ) : null}

          <LoginForm nextPath={nextPath} />

          <div className="mt-8 rounded-lg border border-dashed border-line bg-surface px-3.5 py-3 text-xs text-muted">
            <p className="font-medium text-ink">Demo account</p>
            <p className="mt-1">
              Username <code className="font-mono text-ink">demo</code> · Password{" "}
              <code className="font-mono text-ink">demo123</code>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
