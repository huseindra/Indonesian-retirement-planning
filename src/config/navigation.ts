import type { IconName } from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  description: string;
}

/** Single source of truth for the app's sections, in journey order. */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    description: "An overview of your retirement readiness.",
  },
  {
    href: "/financial-profile",
    label: "Financial Profile",
    icon: "wallet",
    description:
      "Record your income, savings, investments and pension assets such as BPJS JHT and DPLK.",
  },
  {
    href: "/living-costs",
    label: "Living Costs",
    icon: "home",
    description:
      "Estimate today's living and housing costs and how inflation will change them by retirement.",
  },
  {
    href: "/retirement-plan",
    label: "Retirement Plan",
    icon: "target",
    description:
      "Project your retirement fund year by year and see whether it covers your retirement goal.",
  },
  {
    href: "/scenarios",
    label: "Scenarios",
    icon: "branches",
    description:
      "Compare what-if scenarios such as retiring earlier, saving more or buying a home.",
  },
  {
    href: "/ai-insights",
    label: "AI Insights",
    icon: "sparkle",
    description:
      "AI-interpreted observations about your plan, with sources you can check and nothing applied without your say-so.",
  },
];
