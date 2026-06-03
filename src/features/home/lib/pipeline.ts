// Pure pipeline-tab aggregation: per-stage health (count/$ /weighted/age/stalled +
// rank vs team) over plain open-opp rows. DB-free and TDD'd; the route fetches the
// rows. Stage weights + open stages mirror the DOA matview (prefix 0-5 = open).

import { rankReps } from "./ranking";
import { CATEGORY_TO_SEGMENT, SEGMENT_DEFS, type SegmentKey } from "./segments";

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

export interface FunnelStage {
  prefix: number; // 0-5
  name: string;
  count: number; // caller's opps in this stage
  min: number; // caller Σ minPurchase
  max: number; // caller Σ maxBudget
  teamMin: number; // Σ minPurchase across all reps in this stage
  sharePct: number; // round(min / teamMin × 100); 0 when teamMin is 0
}

export interface SourceShare {
  key: SegmentKey;
  label: string;
  color: string;
  you: number; // caller Σ minPurchase for this source
  team: number; // team Σ minPurchase for this source
  pct: number; // round(you / team × 100); 0 when team is 0
}

// Placeholder; replaced by the real shape when buildTargetsRow is added in a later task.
export interface TargetsRow {
  count: number;
  min: number;
  max: number;
  teamMin: number;
  sharePct: number;
}

export interface FunnelData {
  stages: FunnelStage[];
  sources: SourceShare[];
  openCount: number;
  totalMin: number;
  totalMax: number;
  spread: number; // totalMax − totalMin (upside)
  teamMinTotal: number;
  overallSharePct: number;
  rank: number;
  totalReps: number;
  targets: TargetsRow; // attached by the route via buildTargetsRow
}

// Per-rep pre-pipe target aggregate (districts on the plan with NO open opp).
// floorMin = Σ renewal_target (the high-confidence floor); ceilMax = Σ all four
// target columns (full upside). Produced by the targets query in pipeline-source.
export interface TargetRepAgg {
  email: string;
  count: number;
  floorMin: number;
  ceilMax: number;
}

// The caller's pre-pipe Targets row plus their share of the team's target floor.
export function buildTargetsRow(byRep: TargetRepAgg[], callerEmail: string): TargetsRow {
  const mine = byRep.find((r) => r.email === callerEmail);
  const teamMin = byRep.reduce((s, r) => s + r.floorMin, 0);
  const min = mine?.floorMin ?? 0;
  return {
    count: mine?.count ?? 0,
    min,
    max: mine?.ceilMax ?? 0,
    teamMin,
    sharePct: teamMin > 0 ? Math.round((min / teamMin) * 100) : 0,
  };
}

const pct = (you: number, team: number) => (team > 0 ? Math.round((you / team) * 100) : 0);
const sourceOf = (o: OpenOppRow): SegmentKey | null => (o.category ? CATEGORY_TO_SEGMENT[o.category] ?? null : null);

// Builds the Stage Funnel payload for one caller from the team-wide open book.
// `source` ("all" or a segment) scopes BOTH the caller and the team aggregates so
// every share figure stays within-source. Targets row is attached separately.
export function buildFunnel(
  teamOpps: OpenOppRow[],
  reps: { id: string; email: string }[],
  callerId: string,
  source: SegmentKey | "all",
): Omit<FunnelData, "targets"> {
  const callerEmail = reps.find((r) => r.id === callerId)?.email ?? null;
  const scoped = source === "all" ? teamOpps : teamOpps.filter((o) => sourceOf(o) === source);
  const callerScoped = callerEmail ? scoped.filter((o) => o.email === callerEmail) : [];

  const stages: FunnelStage[] = PIPELINE_STAGES.map(({ prefix, name }) => {
    const teamIn = scoped.filter((o) => o.stagePrefix === prefix);
    const callerIn = callerScoped.filter((o) => o.stagePrefix === prefix);
    const min = callerIn.reduce((s, o) => s + o.minPurchase, 0);
    const teamMin = teamIn.reduce((s, o) => s + o.minPurchase, 0);
    return {
      prefix,
      name,
      count: callerIn.length,
      min,
      max: callerIn.reduce((s, o) => s + o.maxBudget, 0),
      teamMin,
      sharePct: pct(min, teamMin),
    };
  });

  const totalMin = stages.reduce((s, x) => s + x.min, 0);
  const totalMax = stages.reduce((s, x) => s + x.max, 0);
  const teamMinTotal = stages.reduce((s, x) => s + x.teamMin, 0);

  const minByEmail = new Map<string, number>();
  for (const o of scoped) minByEmail.set(o.email, (minByEmail.get(o.email) ?? 0) + o.minPurchase);
  const ranking = rankReps(reps.map((r) => ({ id: r.id, email: r.email, value: minByEmail.get(r.email) ?? 0 })));
  const rank = ranking.ranked.find((r) => r.id === callerId)?.rank ?? ranking.totalReps + 1;

  const sources: SourceShare[] = SEGMENT_DEFS.map((d) => {
    const you = callerScoped.filter((o) => sourceOf(o) === d.key).reduce((s, o) => s + o.minPurchase, 0);
    const team = scoped.filter((o) => sourceOf(o) === d.key).reduce((s, o) => s + o.minPurchase, 0);
    return { key: d.key, label: d.label, color: d.color, you, team, pct: pct(you, team) };
  });

  return {
    stages,
    sources,
    openCount: callerScoped.length,
    totalMin,
    totalMax,
    spread: totalMax - totalMin,
    teamMinTotal,
    overallSharePct: pct(totalMin, teamMinTotal),
    rank,
    totalReps: ranking.totalReps,
  };
}
