import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";

// Every page in this group reads per-user data from SQLite.
export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
