import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { getNavItem } from "@/config/navigation";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Retirement Plan" };

export default async function Page() {
  await requireUser();
  return <ComingSoon item={getNavItem("/retirement-plan")} />;
}
