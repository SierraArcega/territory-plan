// Fullmind fiscal year starts July 1 and is named by its END year:
// July 2025–June 2026 == FY26 == school-year string "2025-26" (the form
// `opportunities.school_yr` / `district_opportunity_actuals.school_yr` use).
//
// Extracted from the duplicated derivations in
// `src/features/leaderboard/lib/fetch-leaderboard.ts` and
// `src/app/api/leaderboard/revenue-rank/route.ts`.

export function getCurrentFY(now: Date = new Date()): number {
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

export function schoolYearForFY(fy: number): string {
  return `${fy - 1}-${String(fy).slice(-2)}`;
}

export interface FyPill {
  fy: number;
  schoolYr: string;
  label: string;
}

// The dashboard FY selector: FY+1 down to FY-2 (e.g. FY27 · FY26 · FY25 · FY24).
export function fyPills(currentFY: number = getCurrentFY()): FyPill[] {
  return [currentFY + 1, currentFY, currentFY - 1, currentFY - 2].map((fy) => ({
    fy,
    schoolYr: schoolYearForFY(fy),
    label: `FY${String(fy).slice(-2)}`,
  }));
}
