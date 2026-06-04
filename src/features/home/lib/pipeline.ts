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

// Empirical staleness tiers (see the "Stale 2.0" saved report). Each open stage's
// age is graded against how long deals that eventually closed spent in that stage.
export type AgeTier = "on" | "watch" | "concerning" | "stale";

export interface StageBenchmark {
  wonMedian: number; // median days a Closed-Won deal spent in this stage
  lostMedian: number | null; // median for Closed Lost (null when no lost history)
  lostP75: number | null; // 75th percentile for Closed Lost
}

export type BenchmarkMap = Map<number, StageBenchmark>; // keyed by stage prefix 0-5

// Lower rank = more urgent; used to sort the at-risk list by severity.
export const TIER_RANK: Record<AgeTier, number> = { stale: 0, concerning: 1, watch: 2, on: 3 };

// Grades an open deal's days-in-stage against its stage benchmark. Cascades
// on -> watch -> concerning -> stale. Null lost thresholds are skipped (a deal
// past the won median in a stage with no lost history escalates to stale).
// Falls back to the hardcoded healthy age when the stage has no benchmark at all.
export function classifyTier(
  daysInStage: number,
  stagePrefix: number,
  benchmark: StageBenchmark | undefined,
): AgeTier {
  if (!benchmark) {
    const max = HEALTHY_MAX_BY_PREFIX.get(stagePrefix) ?? Infinity;
    return daysInStage > max ? "stale" : "on";
  }
  if (daysInStage <= benchmark.wonMedian) return "on";
  if (benchmark.lostMedian != null && daysInStage <= benchmark.lostMedian) return "watch";
  if (benchmark.lostP75 != null && daysInStage <= benchmark.lostP75) return "concerning";
  return "stale";
}

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

// An open opp with the display fields the top-opportunities table needs.
export interface PipelineOpp extends OpenOppRow {
  account: string | null;
  state: string | null;
  closeDate: Date | null;
  detailsLink: string | null; // deep-link to this opp in the LMS (opportunities.details_link)
}

const STAGE_NAME_BY_PREFIX = new Map(PIPELINE_STAGES.map((s) => [s.prefix, s.name]));
const WEIGHT_BY_PREFIX = new Map(PIPELINE_STAGES.map((s) => [s.prefix, s.weight]));

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
  tier: AgeTier;
  overdue: boolean; // close date already passed (overlay on the tier)
  detailsLink: string | null; // deep-link to this opp in the LMS
}

// Maps the caller's open opps to display rows (stage name, source segment, age
// tier, overdue), sorted by weighted $ (highest-value first).
export function buildOppViews(opps: PipelineOpp[], benchmarks: BenchmarkMap): OppView[] {
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
      tier: classifyTier(o.daysInStage, o.stagePrefix, benchmarks.get(o.stagePrefix)),
      overdue: o.overdueClose,
      detailsLink: o.detailsLink,
    }))
    .sort((a, b) => b.weighted - a.weighted);
}

const DAY_MS = 86_400_000;

// Stage label by prefix for the "Newly created" column's trailing detail.
// Reuses the open-stage names; closed deals created this week show their closed label.
const STAGE_LABEL_BY_PREFIX = new Map<number, string>([
  ...PIPELINE_STAGES.map((s) => [s.prefix, s.name] as [number, string]),
  [6, "Closed Won"],
  [-1, "Closed Lost"],
]);

// Compact motion tag from the DOA category, using the design-system short label.
const MOTION_BY_CATEGORY = new Map(SEGMENT_DEFS.map((d) => [d.category, d.label]));

// Raw deal row for the last-7-days "This week" section (one rep, window-scoped).
export interface ThisWeekDealRow {
  account: string | null;
  value: number; // net_booking_amount
  minPurchase: number; // minimum_purchase_amount (floor)
  maxBudget: number; // maximum_budget (ceiling)
  category: string | null; // DOA segment category -> motion tag
  contractType: string | null; // product tag
  stagePrefix: number | null; // 0-5 open, 6 won, -1 lost
  createdAt: Date | null;
  closeDate: Date | null;
}

export interface ThisWeekDeal {
  account: string;
  value: number; // absolute; the column applies the +/- sign
  min: number; // floor (min commit)
  max: number; // ceiling (max budget)
  motion: string | null;
  product: string | null;
  daysToClose?: number; // Won only
  stage?: string; // Created only
}

export interface ThisWeekColumn {
  count: number;
  total: number;
  totalMin: number; // Σ floor across the current-window deals
  totalMax: number; // Σ ceiling across the current-window deals
  deals: ThisWeekDeal[]; // value-desc (current 7-day window)
  prevCount: number; // count in the prior 7-day window (days 8-14) — for WoW deltas
  prevTotal: number; // Σ value in the prior 7-day window
}

export interface ThisWeek {
  won: ThisWeekColumn;
  lost: ThisWeekColumn;
  created: ThisWeekColumn;
}

function toColumn(deals: ThisWeekDeal[], prevCount: number, prevTotal: number): ThisWeekColumn {
  const sorted = [...deals].sort((a, b) => b.value - a.value);
  return {
    count: sorted.length,
    total: sorted.reduce((s, d) => s + d.value, 0),
    totalMin: sorted.reduce((s, d) => s + d.min, 0),
    totalMax: sorted.reduce((s, d) => s + d.max, 0),
    deals: sorted,
    prevCount,
    prevTotal,
  };
}

// Classify the caller's deal rows into won / lost / created for the current 7-day
// window, carrying the prior window (days 8-14) count + total for week-over-week
// deltas. Closed events use close_date bounded to [windowStart, now] — a future
// close_date is not "won/lost this week"; created uses created_at. A deal created
// AND closed in the same window lands in both Created and its close column.
export function buildThisWeek(rows: ThisWeekDealRow[], nowMs: number): ThisWeek {
  const windowStart = nowMs - 7 * DAY_MS;
  const priorStart = nowMs - 14 * DAY_MS;
  const won: ThisWeekDeal[] = [];
  const lost: ThisWeekDeal[] = [];
  const created: ThisWeekDeal[] = [];
  const prev = { wonC: 0, wonT: 0, lostC: 0, lostT: 0, createdC: 0, createdT: 0 };

  for (const r of rows) {
    const value = Math.abs(r.value);
    const min = Math.max(0, r.minPurchase);
    const max = Math.max(0, r.maxBudget);
    const motion = r.category ? (MOTION_BY_CATEGORY.get(r.category) ?? r.category) : null;
    const product = r.contractType;
    const account = r.account ?? "Unknown";
    const createdMs = r.createdAt ? r.createdAt.getTime() : null;
    const closeMs = r.closeDate ? r.closeDate.getTime() : null;

    const closeCurrent = closeMs !== null && closeMs >= windowStart && closeMs <= nowMs;
    const closePrior = closeMs !== null && closeMs >= priorStart && closeMs < windowStart;
    const createdCurrent = createdMs !== null && createdMs >= windowStart && createdMs <= nowMs;
    const createdPrior = createdMs !== null && createdMs >= priorStart && createdMs < windowStart;

    const isWon = r.stagePrefix !== null && r.stagePrefix >= 6;
    const isLost = r.stagePrefix === -1;

    if (isWon) {
      if (closeCurrent) {
        const daysToClose =
          createdMs !== null && closeMs !== null ? Math.max(0, Math.round((closeMs - createdMs) / DAY_MS)) : undefined;
        won.push({ account, value, min, max, motion, product, daysToClose });
      } else if (closePrior) {
        prev.wonC++;
        prev.wonT += value;
      }
    }
    if (isLost) {
      if (closeCurrent) lost.push({ account, value, min, max, motion, product });
      else if (closePrior) {
        prev.lostC++;
        prev.lostT += value;
      }
    }
    if (createdCurrent) {
      const stage = r.stagePrefix !== null ? STAGE_LABEL_BY_PREFIX.get(r.stagePrefix) : undefined;
      created.push({ account, value, min, max, motion, product, stage });
    } else if (createdPrior) {
      prev.createdC++;
      prev.createdT += value;
    }
  }

  return {
    won: toColumn(won, prev.wonC, prev.wonT),
    lost: toColumn(lost, prev.lostC, prev.lostT),
    created: toColumn(created, prev.createdC, prev.createdT),
  };
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
  prefix: number; // 0-5 open stages; 6 = the Closed Won tip band
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

// The caller's pre-pipe Targets row: a single estimated target value (no floor/
// ceiling split — renewal_target is unpopulated org-wide) + share of the team total.
export interface TargetsRow {
  count: number;
  value: number; // caller Σ target columns over targeted pre-pipe districts
  teamValue: number; // Σ value across all reps
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
  rank: number | null; // null in team mode (no individual ranking)
  totalReps: number;
  targets: TargetsRow; // attached by the route via buildTargetsRow
  won: FunnelStage; // Closed Won tip band (prefix 6), attached by the route via buildWonStage
}

// Per-rep pre-pipe target aggregate: plan districts (FY) with a target set and NO
// open opp. value = Σ all four target columns (the rep's estimated target revenue).
export interface TargetRepAgg {
  email: string;
  count: number;
  value: number;
}

// The caller's pre-pipe Targets row: a single estimated target value (no floor/
// ceiling split — renewal_target is unpopulated org-wide) + share of the team total.
export function buildTargetsRow(byRep: TargetRepAgg[], callerEmail: string): TargetsRow {
  const mine = byRep.find((r) => r.email === callerEmail);
  const teamValue = byRep.reduce((s, r) => s + r.value, 0);
  const value = mine?.value ?? 0;
  return {
    count: mine?.count ?? 0,
    value,
    teamValue,
    sharePct: teamValue > 0 ? Math.round((value / teamValue) * 100) : 0,
  };
}

// Per-rep closed-won aggregate: deal count + floor/ceiling (Σ minPurchase / Σ
// maxBudget) over the rep's closed-won deals this SY. Feeds the funnel's Closed Won band.
export interface WonRepAgg {
  email: string;
  count: number;
  min: number;
  max: number;
}

// The caller's Closed Won funnel band (prefix 6, the post-pipe tip): their closed-won
// floor/ceiling + share of the team's won floor. Mirrors buildTargetsRow; attached by
// the route like the Targets row, so the card's per-source re-scoping leaves it fixed.
export function buildWonStage(byRep: WonRepAgg[], callerEmail: string): FunnelStage {
  const mine = byRep.find((r) => r.email === callerEmail);
  const teamMin = byRep.reduce((s, r) => s + r.min, 0);
  const min = mine?.min ?? 0;
  return {
    prefix: 6,
    name: "Closed Won",
    count: mine?.count ?? 0,
    min,
    max: mine?.max ?? 0,
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
): Omit<FunnelData, "targets" | "won"> {
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

// Whole-team funnel: the team IS the subject, so each stage headline = the team
// total and share is trivially 100%. No rank. Mirrors buildFunnel's return shape.
export function buildFunnelTeam(teamOpps: OpenOppRow[], source: SegmentKey | "all"): Omit<FunnelData, "targets" | "won"> {
  const scoped = source === "all" ? teamOpps : teamOpps.filter((o) => sourceOf(o) === source);
  const stages: FunnelStage[] = PIPELINE_STAGES.map(({ prefix, name }) => {
    const inStage = scoped.filter((o) => o.stagePrefix === prefix);
    const min = inStage.reduce((s, o) => s + o.minPurchase, 0);
    return {
      prefix,
      name,
      count: inStage.length,
      min,
      max: inStage.reduce((s, o) => s + o.maxBudget, 0),
      teamMin: min,
      sharePct: min > 0 ? 100 : 0,
    };
  });
  const totalMin = stages.reduce((s, x) => s + x.min, 0);
  const totalMax = stages.reduce((s, x) => s + x.max, 0);
  const sources: SourceShare[] = SEGMENT_DEFS.map((d) => {
    const team = scoped.filter((o) => sourceOf(o) === d.key).reduce((s, o) => s + o.minPurchase, 0);
    return { key: d.key, label: d.label, color: d.color, you: team, team, pct: team > 0 ? 100 : 0 };
  });
  return {
    stages,
    sources,
    openCount: scoped.length,
    totalMin,
    totalMax,
    spread: totalMax - totalMin,
    teamMinTotal: totalMin,
    overallSharePct: totalMin > 0 ? 100 : 0,
    rank: null,
    totalReps: 0,
  };
}

// Team Closed-Won tip: sum every rep's won aggregate; share is 100%.
export function buildWonStageTeam(byRep: WonRepAgg[]): FunnelStage {
  const min = byRep.reduce((s, r) => s + r.min, 0);
  return {
    prefix: 6,
    name: "Closed Won",
    count: byRep.reduce((s, r) => s + r.count, 0),
    min,
    max: byRep.reduce((s, r) => s + r.max, 0),
    teamMin: min,
    sharePct: min > 0 ? 100 : 0,
  };
}

// Team pre-pipe Targets row: sum every rep's targets; share is 100%.
export function buildTargetsRowTeam(byRep: TargetRepAgg[]): TargetsRow {
  const value = byRep.reduce((s, r) => s + r.value, 0);
  return {
    count: byRep.reduce((s, r) => s + r.count, 0),
    value,
    teamValue: value,
    sharePct: value > 0 ? 100 : 0,
  };
}
