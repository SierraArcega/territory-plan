import type { IncreaseTargetCategory } from "./types";

export function computeSuggestedTarget(
  category: IncreaseTargetCategory,
  fy26Revenue: number,
  priorYearRevenue: number,
): number | null {
  if (category === "missing_renewal") {
    if (fy26Revenue <= 0) return null;
    return Math.round((fy26Revenue * 1.05) / 5000) * 5000;
  }
  if (priorYearRevenue <= 0) return null;
  return Math.round((priorYearRevenue * 0.9) / 5000) * 5000;
}
