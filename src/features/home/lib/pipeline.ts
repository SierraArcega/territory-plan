// Pure pipeline-tab aggregation: per-stage health (count/$ /weighted/age/stalled +
// rank vs team) over plain open-opp rows. DB-free and TDD'd; the route fetches the
// rows. Stage weights + open stages mirror the DOA matview (prefix 0-5 = open).

import { rankReps } from "./ranking";
import { CATEGORY_TO_SEGMENT, type SegmentKey } from "./segments";

// weight = DOA stage weight; healthyMax = days-in-stage past which a deal is
// "stalled". (The stage_history is_stale flag is NOT usable — it's true for every
// open opp, i.e. it marks the current/ongoing stage, not a staleness signal.)
export const PIPELINE_STAGES: { prefix: number; name: string; weight: number; healthyMax: number }[] = [
  { prefix: 0, name: "Meeting Booked", weight: 0.05, healthyMax: 14 },
  { prefix: 1, name: "Discovery", weight: 0.1, healthyMax: 28 },
  { prefix: 2, name: "Presentation", weight: 0.25, healthyMax: 32 },
  { prefix: 3, name: "Proposal", weight: 0.5, healthyMax: 35 },
  { prefix: 4, name: "Negotiation", weight: 0.75, healthyMax: 28 },
  { prefix: 5, name: "Commitment", weight: 0.9, healthyMax: 14 },
];

// Plum-ramp accent per stage, indexed by stage prefix (shared by the coverage
// bar, the stage-health table, and the funnel so they stay in sync).
export const STAGE_ACCENTS = ["#C2BBD4", "#9A8FC0", "#7E72A8", "#6E5FA8", "#544A85", "#403770"];

const HEALTHY_MAX_BY_PREFIX = new Map(PIPELINE_STAGES.map((s) => [s.prefix, s.healthyMax]));

// A single open opportunity, rep-attributed. daysInStage / overdueClose are
// derived from stage_history + close_date in the fetch layer.
export interface OpenOppRow {
  email: string;
  stagePrefix: number; // 0-5
  netBooking: number;
  minPurchase: number;
  maxBudget: number;
  daysInStage: number;
  overdueClose: boolean;
  category?: string;
}

// A deal is "stalled" when it's sat in its current stage past that stage's
// healthy age.
export function isStalled(opp: Pick<OpenOppRow, "stagePrefix" | "daysInStage">): boolean {
  return opp.daysInStage > (HEALTHY_MAX_BY_PREFIX.get(opp.stagePrefix) ?? Infinity);
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
      stalled: callerOpps.filter(isStalled).length,
      rank,
      totalReps: ranking.totalReps,
    };
  });
}

// An open opp with the display fields the top-opportunities table needs.
export interface PipelineOpp extends OpenOppRow {
  account: string | null;
  state: string | null;
  closeDate: Date | null;
}

export type DealHealth = "on" | "stall" | "slip";

const STAGE_NAME_BY_PREFIX = new Map(PIPELINE_STAGES.map((s) => [s.prefix, s.name]));
const WEIGHT_BY_PREFIX = new Map(PIPELINE_STAGES.map((s) => [s.prefix, s.weight]));

// Per-deal health: an overdue close date is a "slip" (takes priority), a deal past
// its stage's healthy age is a "stall", everything else is "on track".
export function classifyHealth(opp: Pick<OpenOppRow, "stagePrefix" | "daysInStage" | "overdueClose">): DealHealth {
  if (opp.overdueClose) return "slip";
  if (isStalled(opp)) return "stall";
  return "on";
}

export interface StageGroup {
  prefix: number;
  name: string;
  count: number;
  min: number; // Σ min commit in this stage
  max: number; // Σ max budget
}

// Groups the caller's open opps into the 6 funnel stages (optionally filtered to one
// source segment), summing min/max. Powers the structural funnel + source filter.
export function groupOppsByStage(opps: OppView[], source: SegmentKey | "all"): StageGroup[] {
  const filtered = source === "all" ? opps : opps.filter((o) => o.source === source);
  return PIPELINE_STAGES.map(({ prefix, name }) => {
    const inStage = filtered.filter((o) => o.stagePrefix === prefix);
    return {
      prefix,
      name,
      count: inStage.length,
      min: inStage.reduce((s, o) => s + o.minPurchase, 0),
      max: inStage.reduce((s, o) => s + o.maxBudget, 0),
    };
  });
}

export interface OppView {
  account: string | null;
  state: string | null;
  source: SegmentKey | null;
  stageName: string;
  stagePrefix: number;
  netBooking: number;
  minPurchase: number;
  maxBudget: number;
  weighted: number;
  closeDate: Date | null;
  daysInStage: number;
  health: DealHealth;
}

// Maps the caller's open opps to display rows (stage name, source segment, health),
// sorted by weighted $ (highest-value first).
export function buildOppViews(opps: PipelineOpp[]): OppView[] {
  return opps
    .map((o) => ({
      account: o.account,
      state: o.state,
      source: o.category ? CATEGORY_TO_SEGMENT[o.category] ?? null : null,
      stageName: STAGE_NAME_BY_PREFIX.get(o.stagePrefix) ?? "—",
      stagePrefix: o.stagePrefix,
      netBooking: o.netBooking,
      minPurchase: o.minPurchase,
      maxBudget: o.maxBudget,
      weighted: o.netBooking * (WEIGHT_BY_PREFIX.get(o.stagePrefix) ?? 0),
      closeDate: o.closeDate,
      daysInStage: o.daysInStage,
      health: classifyHealth(o),
    }))
    .sort((a, b) => b.weighted - a.weighted);
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
