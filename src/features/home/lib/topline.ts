import type { RepActuals } from "@/lib/opportunity-actuals";
import { rankReps, rankForRep } from "./ranking";

// The four financial topline metrics that map directly onto RepActuals. Targets
// (card 1) is count-based from territory_plan_districts and is built separately.
export type ToplineMetricKey = "openPipeline" | "bookings" | "take" | "revenue";

export interface ToplineCard {
  metricKey: ToplineMetricKey;
  label: string;
  value: number;
  rank: number;
  totalReps: number;
  inRoster: boolean;
}

const ZERO: RepActuals = {
  totalRevenue: 0, totalTake: 0, completedTake: 0, scheduledTake: 0,
  weightedPipeline: 0, openPipeline: 0, bookings: 0, minPurchaseBookings: 0,
  invoiced: 0,
};

// Card 4 (revenue) uses blended totalRevenue so it reconciles with the leaderboard
// (locked decision 2026-05-28). Card 5 (take) = scheduled + delivered take.
const METRICS: { key: ToplineMetricKey; label: string; value: (a: RepActuals) => number }[] = [
  { key: "openPipeline", label: "Open Pipeline", value: (a) => a.openPipeline },
  { key: "bookings", label: "Closed Won Bookings", value: (a) => a.bookings },
  { key: "take", label: "Sched + Delivered Take", value: (a) => a.completedTake + a.scheduledTake },
  { key: "revenue", label: "Sched + Delivered Rev.", value: (a) => a.totalRevenue },
];

export function buildToplineCards(
  reps: { id: string; email: string }[],
  actualsByEmail: Map<string, Map<string, RepActuals>>,
  schoolYr: string,
  callerId: string,
): ToplineCard[] {
  return METRICS.map(({ key, label, value }) => {
    const values = reps.map((r) => ({
      id: r.id,
      email: r.email,
      value: value(actualsByEmail.get(r.email)?.get(schoolYr) ?? ZERO),
    }));
    const ranking = rankReps(values);
    const standing = rankForRep(ranking, callerId);
    return {
      metricKey: key,
      label,
      value: standing.value,
      rank: standing.rank,
      totalReps: ranking.totalReps,
      inRoster: standing.inRoster,
    };
  });
}
