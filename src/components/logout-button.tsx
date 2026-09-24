"use client";

import { useFormStatus } from "react-dom";
import { logout } from "@/app/actions/auth";
import { Icon } from "./icons";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-70"
    >
      <Icon name={pending ? "spinner" : "logout"} className={`size-5 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function LogoutButton() {
  return (
    <form action={logout}>
      <SubmitButton />
    </form>
  );
}
