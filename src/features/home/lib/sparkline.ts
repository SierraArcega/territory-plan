// Pure assembler for the topline cards' sparklines + YoY "same-point" delta.
// Reuses the monthly engine: the caller's cumulative-YTD series for the current
// and prior FY, compared at the same column (today) for the YoY figure. DB-free
// and unit-tested; the route fetches caller-scoped rows for both years.

import { cumulativeColumns, todayColumnIndex, COLUMN_COUNT, type DatedValueRow } from "./monthly";
import { TRAJECTORY_METRICS, type TrajectoryMetricKey } from "./rank-trajectory";
import { pctChange } from "./delta";
import { getCurrentFY } from "@/lib/fiscal-year";

// Sparklines + YoY are for the four financial cards. Targets is count-based (its
// card shows district counts, not a $ trend), so it has no $ sparkline.
export type SparklineMetricKey = Exclude<TrajectoryMetricKey, "targets">;
const SPARKLINE_METRICS = TRAJECTORY_METRICS.filter((m) => m.metricKey !== "targets");

export interface Sparkline {
  current: number[]; // 13 cumulative columns, this FY
  prior: number[]; // 13 cumulative columns, prior FY (full year)
  yoy: number | null; // (current − prior) / prior at today's column; null if prior is 0
}

function callerColumns(rows: DatedValueRow[], fy: number, email: string): number[] {
  return cumulativeColumns(rows, fy).get(email) ?? new Array(COLUMN_COUNT).fill(0);
}

export function buildSparklines(params: {
  currentRows: Record<string, DatedValueRow[]>;
  priorRows: Record<string, DatedValueRow[]>;
  email: string;
  fy: number;
  now?: Date;
}): Record<SparklineMetricKey, Sparkline> {
  const { currentRows, priorRows, email, fy, now } = params;
  const todayIdx = todayColumnIndex(fy, now);
  // A future FY has no real to-date figure, so YoY would read a spurious -100%.
  // Suppress it (mirrors the WoW gate, which is current-FY only).
  const isFuture = fy > getCurrentFY(now);

  const out = {} as Record<SparklineMetricKey, Sparkline>;
  for (const { metricKey } of SPARKLINE_METRICS) {
    const current = callerColumns(currentRows[metricKey] ?? [], fy, email);
    const prior = callerColumns(priorRows[metricKey] ?? [], fy - 1, email);
    out[metricKey as SparklineMetricKey] = {
      current,
      prior,
      yoy: isFuture ? null : pctChange(current[todayIdx], prior[todayIdx]),
    };
  }
  return out;
}
