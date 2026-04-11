import type { FiscalYear } from "@/features/map/lib/store";

// Get default fiscal year based on current date
// If we're past June (month >= 6), we're in the next fiscal year
export function getDefaultFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 6 ? year + 1 : year;
}

/** Return store-compatible FY key, e.g. "fy26". Clamped to fy24–fy27. */
export function getDefaultFiscalYearKey(): FiscalYear {
  const fy = getDefaultFiscalYear();
  const suffix = fy % 100; // 2026 → 26
  if (suffix <= 24) return "fy24";
  if (suffix >= 27) return "fy27";
  return `fy${suffix}` as FiscalYear;
}
