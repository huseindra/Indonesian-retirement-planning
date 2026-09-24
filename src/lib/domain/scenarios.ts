/**
 * Scenario vocabulary. A scenario is a named set of optional overrides on
 * top of the user's baseline plan; `null` always means "use the baseline".
 */

export interface ScenarioOverrides {
  retirementAge: number | null;
  /** Monthly spending in retirement, in today's Rupiah. */
  monthlySpending: number | null;
  inflationBps: number | null;
  investmentReturnBps: number | null;
  /** Expected retirement duration in years. */
  retirementYears: number | null;
  /** Whether this scenario includes buying the target property. */
  includeProperty: boolean;
  /** Today's property price; null = the baseline target property's price. */
  propertyPrice: number | null;
  /** Null = the baseline target property's purchase age. */
  propertyPurchaseAge: number | null;
  /** Null = the property's own rate, else the housing-growth assumption. */
  propertyGrowthBps: number | null;
}

export interface ScenarioInput extends ScenarioOverrides {
  name: string;
  description: string | null;
}

export const NO_OVERRIDES: ScenarioOverrides = {
  retirementAge: null,
  monthlySpending: null,
  inflationBps: null,
  investmentReturnBps: null,
  retirementYears: null,
  includeProperty: false,
  propertyPrice: null,
  propertyPurchaseAge: null,
  propertyGrowthBps: null,
};

export const SCENARIO_LIMITS = {
  maxNameLength: 60,
  maxDescriptionLength: 200,
  minRetirementYears: 1,
  maxRetirementYears: 60,
  maxRetirementAge: 100,
} as const;

/** Fields a user can copy from a scenario into their baseline plan. */
export const APPLICABLE_FIELDS = [
  "retirementAge",
  "monthlySpending",
  "inflationBps",
  "investmentReturnBps",
  "retirementYears",
  "property",
] as const;
export type ApplicableField = (typeof APPLICABLE_FIELDS)[number];

export const APPLICABLE_FIELD_LABELS: Record<ApplicableField, string> = {
  retirementAge: "Target retirement age → Financial Profile",
  monthlySpending: "Monthly spending → Financial Profile (monthly living expenses)",
  inflationBps: "Inflation → Economic assumptions",
  investmentReturnBps: "Investment return → Economic assumptions",
  retirementYears: "Retirement duration → Retirement Plan (plan-until age)",
  property: "Property price, purchase age and growth → Target property",
};

/**
 * Example assumption sets. The names describe the assumptions only — a
 * "conservative" set is cautious, not a prediction that things will be worse.
 */
export const EXAMPLE_SCENARIOS: ScenarioInput[] = [
  {
    ...NO_OVERRIDES,
    name: "Base",
    description: "Your current plan's assumptions, unchanged. A reference point for the other scenarios.",
  },
  {
    ...NO_OVERRIDES,
    name: "Conservative",
    description:
      "Cautious assumptions: higher inflation (4%), lower returns (5%) and a 30-year retirement. Not a forecast.",
    inflationBps: 400,
    investmentReturnBps: 500,
    retirementYears: 30,
  },
  {
    ...NO_OVERRIDES,
    name: "Optimistic",
    description:
      "Favourable assumptions: lower inflation (2.5%) and higher returns (8.5%). Not a forecast.",
    inflationBps: 250,
    investmentReturnBps: 850,
  },
];

/** An extra demo example showing the property override. */
export const DEMO_PROPERTY_SCENARIO: ScenarioInput = {
  ...NO_OVERRIDES,
  name: "Base + buy the target home",
  description: "Base assumptions, plus buying your target property at the planned age with savings.",
  includeProperty: true,
};
