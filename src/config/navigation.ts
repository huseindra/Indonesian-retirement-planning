import type { IconName } from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** "upcoming" sections are shown in navigation but not yet built. */
  status: "available" | "upcoming";
  description: string;
}

/**
 * Single source of truth for the app's sections. Later stages flip a
 * section to "available" and replace its placeholder page.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    status: "available",
    description: "An overview of your retirement readiness.",
  },
  {
    href: "/financial-profile",
    label: "Financial Profile",
    icon: "wallet",
    status: "available",
    description:
      "Record your income, savings, investments and pension assets such as BPJS JHT and DPLK.",
  },
  {
    href: "/living-costs",
    label: "Living Costs",
    icon: "home",
    status: "available",
    description:
      "Estimate today's living and housing costs and how inflation will change them by retirement.",
  },
  {
    href: "/retirement-plan",
    label: "Retirement Plan",
    icon: "target",
    status: "available",
    description:
      "Project your retirement fund year by year and see whether it covers your retirement goal.",
  },
  {
    href: "/scenarios",
    label: "Scenarios",
    icon: "branches",
    status: "available",
    description:
      "Compare what-if scenarios such as retiring earlier, saving more or buying a home.",
  },
];

export function getNavItem(href: string): NavItem {
  const item = NAV_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`Unknown navigation item: ${href}`);
  return item;
}
