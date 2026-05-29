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

// A dated, rep-attributed, valued source row. `category` (DOA segment) is optional
// and only used when building per-segment sub-series.
export interface DatedValueRow {
  email: string;
  date: Date;
  value: number;
  category?: string;
}

// Per-rep cumulative-YTD values across the 13 FY columns: column i holds the sum
// of that rep's rows dated on or before month i (monotonic non-decreasing).
export function cumulativeColumns(rows: DatedValueRow[], fy: number): Map<string, number[]> {
  const byRep = new Map<string, number[]>();
  for (const row of rows) {
    let cols = byRep.get(row.email);
    if (!cols) {
      cols = new Array(COLUMN_COUNT).fill(0);
      byRep.set(row.email, cols);
    }
    // Add the row to its column and every later column (cumulative).
    for (let i = fyMonthIndex(row.date, fy); i < COLUMN_COUNT; i++) cols[i] += row.value;
  }
  return byRep;
}
