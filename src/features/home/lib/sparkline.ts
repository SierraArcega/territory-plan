// Pure assembler for the topline cards' sparklines + YoY "same-point" delta.
// Reuses the monthly engine: the caller's cumulative-YTD series for the current
// and prior FY, compared at the same column (today) for the YoY figure. DB-free
// and unit-tested; the route fetches caller-scoped rows for both years.

import { cumulativeColumns, todayColumnIndex, COLUMN_COUNT, type DatedValueRow } from "./monthly";
import { TRAJECTORY_METRICS, type TrajectoryMetricKey } from "./rank-trajectory";

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
}): Record<TrajectoryMetricKey, Sparkline> {
  const { currentRows, priorRows, email, fy, now } = params;
  const todayIdx = todayColumnIndex(fy, now);

  const out = {} as Record<TrajectoryMetricKey, Sparkline>;
  for (const { metricKey } of TRAJECTORY_METRICS) {
    const current = callerColumns(currentRows[metricKey] ?? [], fy, email);
    const prior = callerColumns(priorRows[metricKey] ?? [], fy - 1, email);
    const priorToDate = prior[todayIdx];
    out[metricKey] = {
      current,
      prior,
      yoy: priorToDate > 0 ? (current[todayIdx] - priorToDate) / priorToDate : null,
    };
  }
  return out;
}
