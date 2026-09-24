import { compound, growthFactor, realRate, toTodaysMoney } from "./compound";

export interface PropertyInput {
  /** Today's price of the target property, whole Rupiah. */
  currentPrice: number;
  currentAge: number;
  purchaseAge: number;
  /** Annual property-price growth, basis points. */
  growthBps: number;
  /** Annual general inflation, basis points. */
  inflationBps: number;
}

export interface PropertyPoint {
  age: number;
  yearsFromNow: number;
  /** Price tag in future Rupiah. */
  nominalPrice: number;
  /** The same price expressed in today's money. */
  priceInTodaysMoney: number;
}

export interface PropertyProjection {
  years: number;
  growthBps: number;
  inflationBps: number;
  currentPrice: number;
  /** Nominal price at the purchase age: currentPrice × (1 + growth)^years. */
  futurePrice: number;
  /** Nominal (price-tag) increase — appreciation, not a change in the home itself. */
  nominalIncrease: number;
  nominalIncreasePercent: number;
  /** The future price with general inflation removed. */
  futurePriceInTodaysMoney: number;
  /**
   * How much more (or less) the home costs than today after removing
   * inflation. Positive when property grows faster than general prices.
   */
  realChange: number;
  realChangePercent: number;
  /** Annual growth above inflation, as a fraction. */
  realGrowthRate: number;
  /**
   * If today's price were kept as cash until the purchase age, what it
   * would buy at today's prices — the loss is purchasing power, not value
   * lost by the property.
   */
  cashPurchasingPowerAtPurchase: number;
  series: PropertyPoint[];
}

export function projectProperty(input: PropertyInput): PropertyProjection {
  const { currentPrice, currentAge, purchaseAge, growthBps, inflationBps } = input;
  if (purchaseAge < currentAge) {
    throw new RangeError("purchaseAge must not be earlier than currentAge");
  }
  const years = purchaseAge - currentAge;

  const futurePrice = compound(currentPrice, growthBps, years);
  const futurePriceInTodaysMoney = toTodaysMoney(futurePrice, inflationBps, years);

  const series: PropertyPoint[] = [];
  for (let n = 0; n <= years; n++) {
    const nominalPrice = compound(currentPrice, growthBps, n);
    series.push({
      age: currentAge + n,
      yearsFromNow: n,
      nominalPrice,
      priceInTodaysMoney: toTodaysMoney(nominalPrice, inflationBps, n),
    });
  }

  return {
    years,
    growthBps,
    inflationBps,
    currentPrice,
    futurePrice,
    nominalIncrease: futurePrice - currentPrice,
    nominalIncreasePercent: currentPrice > 0 ? futurePrice / currentPrice - 1 : 0,
    futurePriceInTodaysMoney,
    realChange: futurePriceInTodaysMoney - currentPrice,
    realChangePercent: currentPrice > 0 ? futurePriceInTodaysMoney / currentPrice - 1 : 0,
    realGrowthRate: realRate(growthBps, inflationBps),
    cashPurchasingPowerAtPurchase: Math.round(currentPrice / growthFactor(inflationBps, years)),
    series,
  };
}
