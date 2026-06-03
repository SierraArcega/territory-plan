// Velocity metrics for the Pipeline tab: close rate, avg deal size, gross margin,
// deals won — each ranked vs the team with a prior-FY delta. Pure; the SQL that
// feeds it lives in velocity-source.ts. All four metrics are higher-is-better.

export type VelocityMetricKey = "closeRate" | "avgDealSize" | "grossMargin" | "dealsWon";
export type DeltaUnit = "pts" | "pct" | "count";

// Per-rep raw aggregate for one fiscal year (from velocity-source).
export interface RepVelocityAgg {
  wonCount: number;     // closed-won opps
  closedCount: number;  // closed-won + closed-lost
  wonBookingSum: number; // Σ net_booking_amount over won
  takeSum: number;      // Σ completed_take + scheduled_take (DOA)
  revSum: number;       // Σ completed_revenue + scheduled_revenue (DOA)
}

export interface VelocityCell {
  metricKey: VelocityMetricKey;
  label: string;
  format: "percent" | "currency" | "count";
  value: number;        // percent metrics as a fraction (0-1); deal size in $; deals won count
  delta: number | null; // in deltaUnit; null when not in roster or no prior value
  deltaUnit: DeltaUnit;
  teamMedian: number;   // same scale as value
  rank: number;
  totalReps: number;
  inRoster: boolean;
}

// Median of a numeric list; 0 for empty.
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

import { rankReps, rankForRep } from "./ranking";

const ZERO: RepVelocityAgg = { wonCount: 0, closedCount: 0, wonBookingSum: 0, takeSum: 0, revSum: 0 };

const METRICS: {
  key: VelocityMetricKey;
  label: string;
  format: "percent" | "currency" | "count";
  deltaUnit: DeltaUnit;
  value: (a: RepVelocityAgg) => number;
}[] = [
  { key: "closeRate", label: "Close rate", format: "percent", deltaUnit: "pts", value: (a) => (a.closedCount > 0 ? a.wonCount / a.closedCount : 0) },
  { key: "avgDealSize", label: "Avg deal size", format: "currency", deltaUnit: "pct", value: (a) => (a.wonCount > 0 ? a.wonBookingSum / a.wonCount : 0) },
  { key: "grossMargin", label: "Gross margin", format: "percent", deltaUnit: "pts", value: (a) => (a.revSum > 0 ? a.takeSum / a.revSum : 0) },
  { key: "dealsWon", label: "Deals won", format: "count", deltaUnit: "count", value: (a) => a.wonCount },
];

// pts: percentage-point change (×100). pct: relative % change (null if prior 0).
// count: absolute difference. All rounded to whole numbers.
function computeDelta(unit: DeltaUnit, current: number, prior: number): number | null {
  if (unit === "pts") return Math.round((current - prior) * 100);
  if (unit === "count") return Math.round(current - prior);
  return prior > 0 ? Math.round(((current - prior) / prior) * 100) : null;
}

// Build the four velocity cells: per-rep metric value → rank (higher is better) +
// team median; the caller's standing and prior-FY delta. `priorCallerAgg` is the
// caller's same-metric aggregate for fy-1 (null when unavailable).
export function buildVelocity(
  reps: { id: string; email: string }[],
  currentByEmail: Map<string, RepVelocityAgg>,
  priorCallerAgg: RepVelocityAgg | null,
  callerId: string,
): VelocityCell[] {
  return METRICS.map(({ key, label, format, deltaUnit, value }) => {
    const values = reps.map((r) => ({ id: r.id, email: r.email, value: value(currentByEmail.get(r.email) ?? ZERO) }));
    const ranking = rankReps(values);
    const standing = rankForRep(ranking, callerId);
    const teamMedian = median(values.map((v) => v.value));
    const delta =
      standing.inRoster && priorCallerAgg ? computeDelta(deltaUnit, standing.value, value(priorCallerAgg)) : null;
    return {
      metricKey: key,
      label,
      format,
      value: standing.value,
      delta,
      deltaUnit,
      teamMedian,
      rank: standing.rank,
      totalReps: ranking.totalReps,
      inRoster: standing.inRoster,
    };
  });
}
