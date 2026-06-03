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
