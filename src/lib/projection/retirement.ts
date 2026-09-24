import { BPS_PER_UNIT, growthFactor } from "./compound";
import { projectLivingCost, type LivingCostProjection } from "./living-costs";

/**
 * Deterministic retirement simulation engine.
 *
 * Plain numbers in, plain numbers out — no database, UI or AI — so the same
 * engine serves the Retirement Plan page, the dashboard, and later scenario
 * comparison and AI explanations. Rates are basis points, money is whole
 * Rupiah; results are rounded to the Rupiah only when reported.
 *
 * Model (one step per year):
 * 1. Living cost at retirement: today's monthly cost × 12, grown by
 *    inflation for the years until retirement (see projectLivingCost).
 * 2. Required fund: the lump sum needed on the retirement date to pay that
 *    cost at the start of every retirement year, rising with inflation,
 *    while the remaining balance earns the expected return:
 *      Σ_{k=0}^{D−1} E × (1+i)^k / (1+r)^k
 * 3. Projected assets: today's assets grown at the expected return until
 *    retirement. Future contributions are NOT included.
 * 4. Gap = projected assets − required fund (negative = shortfall).
 */

export interface RetirementAssets {
  cashAndSavings: number;
  investments: number;
  jht: number;
  otherPension: number;
}

export interface RetirementInput {
  currentAge: number;
  retirementAge: number;
  /** Age the money should last until (life-expectancy assumption). */
  planUntilAge: number;
  /** Today's monthly living cost, whole Rupiah. */
  monthlyLivingCost: number;
  assets: RetirementAssets;
  inflationBps: number;
  /** Expected annual return, used before and during retirement. */
  investmentReturnBps: number;
}

export interface AccumulationPoint {
  age: number;
  /** Today's assets grown at the expected return. */
  projectedAssets: number;
  /** What would need to be invested at this age to reach the required fund by retirement. */
  requiredCapital: number;
}

export interface DrawdownPoint {
  age: number;
  startBalance: number;
  withdrawal: number;
  endBalance: number;
}

export interface RetirementResult {
  input: RetirementInput;
  yearsToRetirement: number;
  retirementYears: number;
  livingCost: LivingCostProjection;
  annualCostAtRetirement: number;
  /** Lump sum needed at retirement (future Rupiah). */
  requiredFund: number;
  /** Required fund divided by the first-year cost: "years of spending" it represents after returns. */
  requiredFundMultiple: number;
  currentAssets: RetirementAssets & { total: number };
  projectedAssets: RetirementAssets & { total: number };
  assetGrowthFactor: number;
  /** Projected assets − required fund. Negative means a shortfall. */
  gap: number;
  /** Projected assets ÷ required fund (1 = fully funded). */
  fundedRatio: number;
  status: "surplus" | "shortfall";
  /** Extra saving per month from today that would close the gap (0 when funded). */
  monthlySavingToCloseGap: number;
  /** First age at which the money cannot cover that year's cost; null if it lasts the whole plan. */
  fundsRunOutAtAge: number | null;
  accumulation: AccumulationPoint[];
  drawdown: DrawdownPoint[];
}

export class RetirementInputError extends Error {
  constructor(
    message: string,
    readonly field: keyof RetirementInput | "assets",
  ) {
    super(message);
    this.name = "RetirementInputError";
  }
}

function validate(input: RetirementInput): void {
  const { currentAge, retirementAge, planUntilAge, monthlyLivingCost, assets } = input;
  for (const [key, value] of Object.entries({ currentAge, retirementAge, planUntilAge })) {
    if (!Number.isInteger(value)) {
      throw new RetirementInputError(`${key} must be a whole number of years`, key as keyof RetirementInput);
    }
  }
  if (retirementAge <= currentAge) {
    throw new RetirementInputError("Retirement age must be later than the current age.", "retirementAge");
  }
  if (planUntilAge <= retirementAge) {
    throw new RetirementInputError(
      `The plan-until age (${planUntilAge}) must be later than the retirement age (${retirementAge}).`,
      "planUntilAge",
    );
  }
  if (monthlyLivingCost < 0) {
    throw new RetirementInputError("Monthly living cost cannot be negative.", "monthlyLivingCost");
  }
  if (Object.values(assets).some((v) => v < 0 || !Number.isFinite(v))) {
    throw new RetirementInputError("Asset balances cannot be negative.", "assets");
  }
  if (input.investmentReturnBps <= -BPS_PER_UNIT || input.inflationBps <= -BPS_PER_UNIT) {
    throw new RetirementInputError("Rates must be greater than −100%.", "investmentReturnBps");
  }
}

/** Σ_{k=0}^{years−1} ((1+i)/(1+r))^k — the growing-annuity factor at the start of each year. */
export function growingAnnuityFactor(inflationBps: number, returnBps: number, years: number): number {
  const ratio = (1 + inflationBps / BPS_PER_UNIT) / (1 + returnBps / BPS_PER_UNIT);
  if (Math.abs(ratio - 1) < 1e-12) return years;
  return (1 - ratio ** years) / (1 - ratio);
}

/**
 * Level annual saving (end of each year) that grows to `target` after
 * `years` at `returnBps`: target × r / ((1+r)^years − 1).
 */
export function annualSavingFor(target: number, returnBps: number, years: number): number {
  if (target <= 0) return 0;
  if (years <= 0) return target;
  const r = returnBps / BPS_PER_UNIT;
  if (Math.abs(r) < 1e-12) return target / years;
  return (target * r) / ((1 + r) ** years - 1);
}

function scaleAssets(assets: RetirementAssets, factor: number): RetirementAssets & { total: number } {
  const scaled = {
    cashAndSavings: Math.round(assets.cashAndSavings * factor),
    investments: Math.round(assets.investments * factor),
    jht: Math.round(assets.jht * factor),
    otherPension: Math.round(assets.otherPension * factor),
  };
  return { ...scaled, total: scaled.cashAndSavings + scaled.investments + scaled.jht + scaled.otherPension };
}

export function simulateRetirement(input: RetirementInput): RetirementResult {
  validate(input);
  const { currentAge, retirementAge, planUntilAge, inflationBps, investmentReturnBps } = input;
  const yearsToRetirement = retirementAge - currentAge;
  const retirementYears = planUntilAge - retirementAge;

  // 1. Living cost at retirement — the same projection the Living Costs page uses.
  const livingCost = projectLivingCost({
    monthlyCost: input.monthlyLivingCost,
    currentAge,
    retirementAge,
    inflationBps,
  });
  const annualCostAtRetirement = livingCost.atRetirement.annual;

  // 2. Required fund at retirement.
  const annuityFactor = growingAnnuityFactor(inflationBps, investmentReturnBps, retirementYears);
  const requiredFund = Math.round(annualCostAtRetirement * annuityFactor);

  // 3. Projected assets at retirement.
  const assetGrowthFactor = growthFactor(investmentReturnBps, yearsToRetirement);
  const rawTotal =
    input.assets.cashAndSavings + input.assets.investments + input.assets.jht + input.assets.otherPension;
  const currentAssets = { ...input.assets, total: rawTotal };
  const projectedAssets = scaleAssets(input.assets, assetGrowthFactor);

  // 4. Gap or surplus.
  const gap = projectedAssets.total - requiredFund;
  const fundedRatio = requiredFund > 0 ? projectedAssets.total / requiredFund : 1;
  const monthlySavingToCloseGap =
    gap < 0 ? Math.round(annualSavingFor(-gap, investmentReturnBps, yearsToRetirement) / 12) : 0;

  const accumulation: AccumulationPoint[] = [];
  for (let n = 0; n <= yearsToRetirement; n++) {
    accumulation.push({
      age: currentAge + n,
      projectedAssets: Math.round(rawTotal * growthFactor(investmentReturnBps, n)),
      requiredCapital: Math.round(requiredFund / growthFactor(investmentReturnBps, yearsToRetirement - n)),
    });
  }

  // Retirement drawdown using the unrounded projected balance.
  const drawdown: DrawdownPoint[] = [];
  let balance = rawTotal * assetGrowthFactor;
  let fundsRunOutAtAge: number | null = null;
  const r = investmentReturnBps / BPS_PER_UNIT;
  for (let k = 0; k < retirementYears; k++) {
    const withdrawal = annualCostAtRetirement * growthFactor(inflationBps, k);
    const start = balance;
    // A tolerance of Rp 1 absorbs floating-point noise when exactly funded.
    if (fundsRunOutAtAge === null && start + 1 < withdrawal) fundsRunOutAtAge = retirementAge + k;
    balance = Math.max(0, start - withdrawal) * (1 + r);
    drawdown.push({
      age: retirementAge + k,
      startBalance: Math.round(start),
      withdrawal: Math.round(withdrawal),
      endBalance: Math.round(balance),
    });
  }

  return {
    input,
    yearsToRetirement,
    retirementYears,
    livingCost,
    annualCostAtRetirement,
    requiredFund,
    requiredFundMultiple: annuityFactor,
    currentAssets,
    projectedAssets,
    assetGrowthFactor,
    gap,
    fundedRatio,
    status: gap >= 0 ? "surplus" : "shortfall",
    monthlySavingToCloseGap,
    fundsRunOutAtAge,
    accumulation,
    drawdown,
  };
}
