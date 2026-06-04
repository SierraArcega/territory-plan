// Metric-agnostic rep ranking for the performance dashboard. Ranks the output of
// getRepActualsBatch in JS (the roster is small — ~tens of reps — so this avoids
// fragile per-metric raw-SQL window functions; same approach as revenue-rank).

export interface RepMetricValue {
  id: string;
  email: string;
  value: number;
}

export interface RankedRep extends RepMetricValue {
  rank: number;
}

export interface MetricRanking {
  totalReps: number;
  ranked: RankedRep[];
}

// Sorts descending by value (#1 = highest) and assigns competition ranks:
// equal values share a rank and the next rank skips (1, 2, 2, 4).
export function rankReps(values: RepMetricValue[]): MetricRanking {
  const sorted = [...values].sort((a, b) => b.value - a.value);
  const ranked: RankedRep[] = sorted.map((rep, i) => ({
    ...rep,
    rank: i > 0 && rep.value === sorted[i - 1].value ? -1 : i + 1,
  }));
  // Resolve the tie placeholders to the shared (earlier) rank.
  for (let i = 1; i < ranked.length; i++) {
    if (ranked[i].rank === -1) ranked[i].rank = ranked[i - 1].rank;
  }
  return { totalReps: ranked.length, ranked };
}

// Looks up one rep's standing. A caller not in the ranked roster (e.g. a manager
// viewing their own dashboard) is reported as last+1, value 0, inRoster false —
// matching the leaderboard's revenue-rank semantics.
export function rankForRep(
  ranking: MetricRanking,
  repId: string,
): { rank: number; value: number; inRoster: boolean } {
  const found = ranking.ranked.find((r) => r.id === repId);
  if (!found) return { rank: ranking.totalReps + 1, value: 0, inRoster: false };
  return { rank: found.rank, value: found.value, inRoster: true };
}
