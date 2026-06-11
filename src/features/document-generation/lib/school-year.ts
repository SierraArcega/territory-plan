import { getCurrentFY } from "@/lib/fiscal-year";
import { parseLocalDate } from "@/features/shared/lib/date-utils";

/** Canonical school-year string for the SY ending in `end` (e.g. 2027 → "2026 - 2027").
 *  This is the format the SP6 naming regex and existing rows use. */
const syForEndYear = (end: number) => `${end - 1} - ${end}`;

/** SY containing the given ISO date (July-1 boundary via the canonical FY rule);
 *  null for empty/unparseable input. */
export function schoolYearFromDate(dateStr: string): string | null {
  const t = dateStr.trim();
  if (!t) return null;
  const d = parseLocalDate(t);
  if (Number.isNaN(d.getTime())) return null;
  return syForEndYear(getCurrentFY(d));
}

/** Pre-dates fallback: the SY that STARTS in the current calendar year —
 *  in June reps quote next fall, in October they're in it; both resolve here. */
export function defaultSchoolYear(today: Date = new Date()): string {
  return syForEndYear(today.getFullYear() + 1);
}

/** Selector window: previous + current (FY rule) + next 4. */
export function schoolYearOptions(today: Date = new Date()): string[] {
  const currentEnd = getCurrentFY(today);
  return Array.from({ length: 6 }, (_, i) => syForEndYear(currentEnd - 1 + i));
}
