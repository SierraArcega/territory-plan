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

import { rankReps } from "./ranking";

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

// The "today" column for a given FY relative to `now` — the solid→dashed boundary.
// A past FY is fully delivered (12); a future FY hasn't started (0); the current FY
// resolves to its in-progress month. (fyMonthIndex already clamps both extremes.)
export function todayColumnIndex(fy: number, now: Date = new Date()): number {
  return fyMonthIndex(now, fy);
}

// Projection (locked decision): carry the current standing flat into future months.
// Columns after `todayIndex` take the today-column value; columns up to it are kept.
export function flatCarry(columns: number[], todayIndex: number): number[] {
  return columns.map((v, i) => (i > todayIndex ? columns[todayIndex] : v));
}

export interface RepColumnSeries {
  id: string;
  email: string;
  ranks: number[]; // 13, per-column competition rank (#1 = highest cumulative)
  values: number[]; // 13, cumulative & flat-carried after today
}

export interface MetricTrajectory {
  todayIndex: number;
  caller: { ranks: number[]; values: number[]; inRoster: boolean };
  reps: RepColumnSeries[];
}

// Assembles one metric's monthly trajectory: buckets rows into cumulative columns,
// applies the flat-carry projection, then ranks every rep within each column
// (reusing rankReps). Returns the caller's line plus all reps' lines (for the
// modal team breakdown). A caller outside the roster is reported as last+1 / zeros.
export function buildMetricTrajectory(params: {
  rows: DatedValueRow[];
  fy: number;
  reps: { id: string; email: string }[];
  callerId: string;
  now?: Date;
}): MetricTrajectory {
  const { rows, fy, reps, callerId, now } = params;
  const todayIndex = todayColumnIndex(fy, now);
  const cumulative = cumulativeColumns(rows, fy);

  // Per-rep value columns (zeros when a rep has no rows), flat-carried after today.
  const valuesByEmail = new Map<string, number[]>();
  for (const rep of reps) {
    const cols = cumulative.get(rep.email) ?? new Array(COLUMN_COUNT).fill(0);
    valuesByEmail.set(rep.email, flatCarry(cols, todayIndex));
  }

  // Rank reps independently per column.
  const ranksByEmail = new Map<string, number[]>(reps.map((r) => [r.email, new Array(COLUMN_COUNT).fill(0)]));
  for (let col = 0; col < COLUMN_COUNT; col++) {
    const { ranked } = rankReps(reps.map((r) => ({ id: r.id, email: r.email, value: valuesByEmail.get(r.email)![col] })));
    for (const r of ranked) ranksByEmail.get(r.email)![col] = r.rank;
  }

  const repSeries: RepColumnSeries[] = reps.map((rep) => ({
    id: rep.id,
    email: rep.email,
    ranks: ranksByEmail.get(rep.email)!,
    values: valuesByEmail.get(rep.email)!,
  }));

  const callerSeries = repSeries.find((r) => r.id === callerId);
  const caller = callerSeries
    ? { ranks: callerSeries.ranks, values: callerSeries.values, inRoster: true }
    : {
        ranks: new Array(COLUMN_COUNT).fill(reps.length + 1),
        values: new Array(COLUMN_COUNT).fill(0),
        inRoster: false,
      };

  return { todayIndex, caller, reps: repSeries };
}

export interface SegmentedTrajectory {
  all: MetricTrajectory;
  byCategory: Map<string, MetricTrajectory>;
}

// Builds the combined ("all") trajectory plus one trajectory per DOA category
// present in the rows, each ranked across the full roster using only that
// category's rows. Powers the modal's segment filter.
export function buildSegmentedTrajectory(params: {
  rows: DatedValueRow[];
  fy: number;
  reps: { id: string; email: string }[];
  callerId: string;
  now?: Date;
}): SegmentedTrajectory {
  const { rows, ...rest } = params;
  const all = buildMetricTrajectory({ rows, ...rest });

  const categories = [...new Set(rows.map((r) => r.category).filter((c): c is string => c != null))];
  const byCategory = new Map<string, MetricTrajectory>(
    categories.map((cat) => [
      cat,
      buildMetricTrajectory({ rows: rows.filter((r) => r.category === cat), ...rest }),
    ]),
  );

  return { all, byCategory };
}
