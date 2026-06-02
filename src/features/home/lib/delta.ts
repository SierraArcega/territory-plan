// Shared "improvement is green" delta convention for the dashboard, plus the
// percent-change helper with a zero/undefined-baseline guard. Used by the YoY and
// WoW chips (StatCard), the rank-delta chip (RankTrajectoryCard), and the
// sparkline/WoW math so the convention can't drift.

export const DELTA_UP = "#2E7D5B"; // improvement
export const DELTA_DOWN = "#F37167"; // regression (coral)
export const DELTA_MUTED = "#8A80A8"; // no change / n/a

export function deltaColor(value: number): string {
  return value === 0 ? DELTA_MUTED : value > 0 ? DELTA_UP : DELTA_DOWN;
}

// Percent change vs a baseline; null when the baseline is 0 or negative (a % is
// not meaningfully defined). Returns a ratio (0.18 = +18%).
export function pctChange(current: number, prior: number): number | null {
  return prior > 0 ? (current - prior) / prior : null;
}
