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

/** Selector window: the SY starting in the current calendar year + next 4 —
 *  no start year ever reads as past. The in-progress SY (Jan–Jun, started last
 *  calendar year) is still expressible: start-date derivation produces it and
 *  the selects inject out-of-window values as extra options. */
export function schoolYearOptions(today: Date = new Date()): string[] {
  const firstEnd = today.getFullYear() + 1;
  return Array.from({ length: 5 }, (_, i) => syForEndYear(firstEnd + i));
}

/** Parse a canonical-ish SY string into its year pair; null when it lacks two 4-digit years. */
export function splitSchoolYear(sy: string): { start: number; end: number } | null {
  const m = /(\d{4})\s*[-–]\s*(\d{4})/.exec(sy);
  return m ? { start: Number(m[1]), end: Number(m[2]) } : null;
}

/** Canonical SY string for an explicit year pair. */
export function joinSchoolYear(start: number, end: number): string {
  return `${start} - ${end}`;
}

/** Start years of the selector window (same 6-year window as schoolYearOptions). */
export function startYearOptions(today: Date = new Date()): number[] {
  return schoolYearOptions(today).map((sy) => splitSchoolYear(sy)!.start);
}
