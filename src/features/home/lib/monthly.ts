// Monthly-derivation engine for the rank-trajectory chart, card sparklines, and
// the YoY "same-day" delta. Pure logic over plain dated rows (no DB) so it can be
// TDD'd in isolation; the API route feeds it source rows and reuses rankReps.
//
// Decisions locked with the user 2026-05-29:
//  - Monthly value = cumulative YTD by source date (bookings·close_date,
//    rev/take·session.start_time, open-pipeline·created_at, targets·added_at).
//  - 13 columns: a Pre-FY carryover band (same-FY rows dated before Jul 1) + Jul..Jun.
//  - Projection = carry the current standing flat into future months (dashed);
//    no pipeline-close-date modeling.

// Fullmind FY starts Jul 1, named by its end year (FY26 = Jul 2025–Jun 2026).
export const FY_COLUMN_LABELS = [
  "Pre-FY", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
] as const;

export const COLUMN_COUNT = FY_COLUMN_LABELS.length; // 13

// Maps a date to its trajectory column for the given fiscal year (UTC-based for
// determinism): 0 = Pre-FY (before Jul 1 of the FY start year), 1 = Jul … 12 = Jun.
// Dates after the FY ends clamp to the final column so they still count in YTD.
export function fyMonthIndex(date: Date, fy: number): number {
  const startYear = fy - 1; // FY26 starts in calendar 2025
  // Whole months elapsed since the FY's July (negative = before the FY).
  const offset = (date.getUTCFullYear() - startYear) * 12 + (date.getUTCMonth() - 6);
  if (offset < 0) return 0;
  return Math.min(offset + 1, COLUMN_COUNT - 1);
}
