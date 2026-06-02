// Pure pipeline-tab aggregation: per-stage health (count/$ /weighted/age/stalled +
// rank vs team) over plain open-opp rows. DB-free and TDD'd; the route fetches the
// rows. Stage weights + open stages mirror the DOA matview (prefix 0-5 = open).

import { rankReps } from "./ranking";

export const PIPELINE_STAGES: { prefix: number; name: string; weight: number }[] = [
  { prefix: 0, name: "Meeting Booked", weight: 0.05 },
  { prefix: 1, name: "Discovery", weight: 0.1 },
  { prefix: 2, name: "Presentation", weight: 0.25 },
  { prefix: 3, name: "Proposal", weight: 0.5 },
  { prefix: 4, name: "Negotiation", weight: 0.75 },
  { prefix: 5, name: "Commitment", weight: 0.9 },
];

// A single open opportunity, rep-attributed. daysInStage / isStale / overdueClose
// are derived from stage_history + close_date in the fetch layer.
export interface OpenOppRow {
  email: string;
  stagePrefix: number; // 0-5
  netBooking: number;
  minPurchase: number;
  maxBudget: number;
  daysInStage: number;
  isStale: boolean;
  overdueClose: boolean;
  category?: string;
}

export interface StageHealth {
  prefix: number;
  name: string;
  weight: number;
  count: number;
  atStake: number; // Σ net booking (caller)
  weighted: number; // Σ net booking × stage weight
  avgAge: number; // mean days-in-stage
  stalled: number; // count flagged stale
  rank: number; // caller's rank vs team by $ at-stake in this stage
  totalReps: number;
}

// Per-stage rollup of the caller's open book, with the caller ranked against all
// reps by $ at-stake within each stage. Returns all six stages in funnel order.
export function buildStageHealth(
  opps: OpenOppRow[],
  reps: { id: string; email: string }[],
  callerId: string,
): StageHealth[] {
  const callerEmail = reps.find((r) => r.id === callerId)?.email ?? null;

  return PIPELINE_STAGES.map(({ prefix, name, weight }) => {
    const inStage = opps.filter((o) => o.stagePrefix === prefix);

    // Rank every rep by their $ at-stake in this stage.
    const atStakeByEmail = new Map<string, number>();
    for (const o of inStage) atStakeByEmail.set(o.email, (atStakeByEmail.get(o.email) ?? 0) + o.netBooking);
    const ranking = rankReps(reps.map((r) => ({ id: r.id, email: r.email, value: atStakeByEmail.get(r.email) ?? 0 })));
    const rank = ranking.ranked.find((r) => r.id === callerId)?.rank ?? ranking.totalReps + 1;

    const callerOpps = callerEmail ? inStage.filter((o) => o.email === callerEmail) : [];
    const atStake = callerOpps.reduce((sum, o) => sum + o.netBooking, 0);
    const avgAge = callerOpps.length ? callerOpps.reduce((sum, o) => sum + o.daysInStage, 0) / callerOpps.length : 0;

    return {
      prefix,
      name,
      weight,
      count: callerOpps.length,
      atStake,
      weighted: atStake * weight,
      avgAge,
      stalled: callerOpps.filter((o) => o.isStale).length,
      rank,
      totalReps: ranking.totalReps,
    };
  });
}

export interface Coverage {
  minCommit: number; // Σ minimum_purchase_amount on open opps (floor)
  maxBudget: number; // Σ maximum_budget on open opps (ceiling)
  openCount: number;
  weightedPipeline: number; // Σ net booking × stage weight ("most likely")
  gap: number; // FY target − won bookings (0 once met)
  coverageMin: number | null; // minCommit / gap (null once target met)
  coverageMax: number | null; // maxBudget / gap
  byStage: { prefix: number; name: string; min: number; max: number }[];
}

const WEIGHT_BY_PREFIX = new Map(PIPELINE_STAGES.map((s) => [s.prefix, s.weight]));

// The caller's open-book coverage vs the gap to their FY bookings target, plus the
// simplified forecast (weighted pipeline = "most likely") and a per-stage floor/
// ceiling breakdown.
export function buildCoverage(callerOpps: OpenOppRow[], wonBookings: number, fyTarget: number): Coverage {
  const minCommit = callerOpps.reduce((sum, o) => sum + o.minPurchase, 0);
  const maxBudget = callerOpps.reduce((sum, o) => sum + o.maxBudget, 0);
  const weightedPipeline = callerOpps.reduce((sum, o) => sum + o.netBooking * (WEIGHT_BY_PREFIX.get(o.stagePrefix) ?? 0), 0);
  const gap = Math.max(0, fyTarget - wonBookings);

  const byStage = PIPELINE_STAGES.map(({ prefix, name }) => {
    const inStage = callerOpps.filter((o) => o.stagePrefix === prefix);
    return {
      prefix,
      name,
      min: inStage.reduce((sum, o) => sum + o.minPurchase, 0),
      max: inStage.reduce((sum, o) => sum + o.maxBudget, 0),
    };
  });

  return {
    minCommit,
    maxBudget,
    openCount: callerOpps.length,
    weightedPipeline,
    gap,
    coverageMin: gap > 0 ? minCommit / gap : null,
    coverageMax: gap > 0 ? maxBudget / gap : null,
    byStage,
  };
}
