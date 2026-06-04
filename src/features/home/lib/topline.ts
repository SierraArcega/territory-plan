import type { RepActuals } from "@/lib/opportunity-actuals";
import { rankReps, rankForRep } from "./ranking";
import { SEGMENT_DEFS } from "./segments";

// The four financial topline metrics that map directly onto RepActuals. Targets
// (card 1) is count-based from territory_plan_districts and is built separately.
export type ToplineMetricKey = "openPipeline" | "bookings" | "take" | "revenue";

export interface ToplineSegment {
  key: "return" | "new" | "winback" | "expansion";
  label: string;
  value: number;
}

// Open-pipeline-only extras: the caller's pipeline expressed as a commitment
// floor (Σ minimum_purchase_amount) and a budget ceiling (Σ maximum_budget),
// plus how many open opps / distinct accounts make it up. minCommit and
// maxBudget are independent totals (per-row min can exceed max in the data), so
// the UI shows them as two figures, not a guaranteed-ordered range.
export interface OpenPipelineDetail {
  minCommit: number;
  maxBudget: number;
  oppCount: number;
  accountCount: number;
}

export interface ToplineCard {
  metricKey: ToplineMetricKey;
  label: string;
  value: number;
  rank: number | null;
  totalReps: number;
  inRoster: boolean;
  // The caller's value split by source (non-zero segments only, in display order).
  segments: ToplineSegment[];
  // Open-pipeline card only: commit/budget totals + opp/account counts.
  pipelineDetail?: OpenPipelineDetail;
}

// The caller's DOA actuals grouped by category, for the segment bars. NOTE:
// revenue here is DOA scheduled+completed revenue per category, which can differ
// slightly from the blended headline (session revenue isn't categorized in the
// matview) — reconciled in the Phase 3 revenue work.
export interface CategoryActuals {
  category: string;
  openPipeline: number;
  bookings: number;
  take: number;
  revenue: number;
}

// Segment classification (category → key/label, in display order) is shared via
// segments.ts so the bars, the trajectory, and the modal can't drift.

const ZERO: RepActuals = {
  totalRevenue: 0, totalTake: 0, completedTake: 0, scheduledTake: 0,
  weightedPipeline: 0, openPipeline: 0, bookings: 0, minPurchaseBookings: 0,
  invoiced: 0,
};

// Card 4 (revenue) uses blended totalRevenue so it reconciles with the leaderboard
// (locked decision 2026-05-28). Card 5 (take) = scheduled + delivered take.
const METRICS: {
  key: ToplineMetricKey;
  label: string;
  value: (a: RepActuals) => number;
  categoryValue: (c: CategoryActuals) => number;
}[] = [
  { key: "openPipeline", label: "Open Pipeline", value: (a) => a.openPipeline, categoryValue: (c) => c.openPipeline },
  { key: "bookings", label: "Closed Won Bookings", value: (a) => a.bookings, categoryValue: (c) => c.bookings },
  { key: "revenue", label: "Sched + Delivered Rev.", value: (a) => a.totalRevenue, categoryValue: (c) => c.revenue },
  { key: "take", label: "Sched + Delivered Take", value: (a) => a.completedTake + a.scheduledTake, categoryValue: (c) => c.take },
];

function segmentsFor(
  callerCategories: CategoryActuals[],
  categoryValue: (c: CategoryActuals) => number,
): ToplineSegment[] {
  return SEGMENT_DEFS.map(({ category, key, label }) => {
    const value = callerCategories
      .filter((c) => c.category === category)
      .reduce((sum, c) => sum + categoryValue(c), 0);
    return { key, label, value };
  }).filter((s) => s.value > 0);
}

export function buildToplineCards(
  reps: { id: string; email: string }[],
  actualsByEmail: Map<string, Map<string, RepActuals>>,
  schoolYr: string,
  subjectId: string,
  subjectCategories: CategoryActuals[],
  openPipelineDetail: OpenPipelineDetail | null = null,
  mode: "rep" | "team" = "rep",
): ToplineCard[] {
  return METRICS.map(({ key, label, value, categoryValue }) => {
    const values = reps.map((r) => ({
      id: r.id,
      email: r.email,
      value: value(actualsByEmail.get(r.email)?.get(schoolYr) ?? ZERO),
    }));
    const ranking = rankReps(values);
    const standing = rankForRep(ranking, subjectId);
    const headlineValue = mode === "team" ? values.reduce((s, v) => s + v.value, 0) : standing.value;
    return {
      metricKey: key,
      label,
      value: headlineValue,
      rank: mode === "team" ? null : standing.rank,
      totalReps: ranking.totalReps,
      inRoster: mode === "team" ? true : standing.inRoster,
      segments: segmentsFor(subjectCategories, categoryValue),
      ...(key === "openPipeline" && openPipelineDetail ? { pipelineDetail: openPipelineDetail } : {}),
    };
  });
}
