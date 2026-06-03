// Top-percentile for the rank pill: #3 of 12 → "top 25%". Rounds, but never
// shows "top 0%" for a real rank (clamps to 1). Returns 0 for an empty roster.
export function rankPercentile(rank: number, totalReps: number): number {
  if (!Number.isFinite(totalReps) || totalReps <= 0) return 0;
  const pct = Math.round((rank / totalReps) * 100);
  return Math.max(1, pct);
}
