import type { RetirementResult } from "../projection/retirement";

/**
 * Reshapes engine output for charts — no new calculations. The balance
 * path is the accumulation series up to retirement followed by the
 * drawdown end-of-year balances until the plan ends.
 */
export function assetTrajectory(result: RetirementResult): { age: number; balance: number }[] {
  const points = result.accumulation.map((p) => ({ age: p.age, balance: p.projectedAssets }));
  for (const year of result.drawdown) points.push({ age: year.age + 1, balance: year.endBalance });
  return points;
}

/** Puts several trajectories on one age axis; null where a plan has no value for that age. */
export function alignTrajectories(results: RetirementResult[]): { ages: number[]; series: (number | null)[][] } {
  if (results.length === 0) return { ages: [], series: [] };
  const paths = results.map(assetTrajectory);
  const start = Math.min(...paths.map((p) => p[0].age));
  const end = Math.max(...paths.map((p) => p[p.length - 1].age));
  const ages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const series = paths.map((path) => {
    const byAge = new Map(path.map((p) => [p.age, p.balance]));
    return ages.map((age) => byAge.get(age) ?? null);
  });
  return { ages, series };
}
