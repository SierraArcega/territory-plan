// Pure types + derivations behind the topline detail modals (/deals route). The
// SQL lives in deals-source.ts (verified live, not unit-tested); everything here is
// pure and covered in deals.test.ts. Domain rules locked in the design doc:
//   - utilization (rev/take) uses WON opps only for each account's min/max — the
//     contracted book that actually generates revenue.
//   - deferred = the unconsumed contractual floor (churn risk).
//   - utilPct is guarded against a zero ceiling (returns null, never NaN/Infinity).

import type { SegmentKey } from "./segments";

export type DealMetric = "pipeline" | "bookings" | "rev" | "take" | "targets";

// ── Row shapes (one per metric; the modal switches on the metric) ─────────────

export interface PipelineDealRow {
  account: string;
  state: string | null;
  stageName: string;
  source: SegmentKey | null; // DOA segment (motion), NOT contract_type
  committed: number; // net booking amount
  maxBudget: number;
  closeDate: string | null;
}

export interface BookingDealRow {
  account: string;
  product: string | null; // contract_type tier — distinct from `source` (motion)
  source: SegmentKey | null;
  amount: number; // net booking (signed)
  minCommit: number;
  maxBudget: number;
  closedDate: string | null;
}

export interface UtilizationRow {
  account: string;
  source: SegmentKey | null;
  minCommit: number; // Σ minimum_purchase_amount (won)
  maxBudget: number; // Σ maximum_budget (won)
  revenue: number; // DOA delivered revenue
  take: number; // DOA delivered take
  deferred: number; // max(0, minCommit - revenue) — unconsumed floor
  utilPct: number | null; // revenue / maxBudget; null when maxBudget == 0
  underMin: boolean; // revenue < minCommit
}

// ── Inputs to the utilization derivation (per-district aggregates from SQL) ────

export interface WonAccountAgg {
  leaid: string;
  account: string;
  source: SegmentKey | null;
  minCommit: number;
  maxBudget: number;
}

export interface DoaAccountAgg {
  leaid: string;
  revenue: number; // DOA completed_revenue
  take: number; // DOA completed_take
}

// Merge each account's won-opp commitment floor/ceiling with its DOA delivered
// revenue/take. Rows are keyed by district (leaid) and aggregated defensively in
// case SQL returns more than one row per district (e.g. one per category). Sorted
// by contracted size (max budget desc) so the biggest accounts lead; account name
// breaks ties for a stable order.
export function buildUtilizationRows(
  won: WonAccountAgg[],
  doa: DoaAccountAgg[],
): UtilizationRow[] {
  const wonByLea = new Map<string, { account: string; source: SegmentKey | null; minCommit: number; maxBudget: number }>();
  for (const w of won) {
    const acc = wonByLea.get(w.leaid);
    if (acc) {
      acc.minCommit += w.minCommit;
      acc.maxBudget += w.maxBudget;
      if (acc.source == null) acc.source = w.source;
    } else {
      wonByLea.set(w.leaid, { account: w.account, source: w.source, minCommit: w.minCommit, maxBudget: w.maxBudget });
    }
  }

  const doaByLea = new Map<string, { revenue: number; take: number }>();
  for (const d of doa) {
    const acc = doaByLea.get(d.leaid);
    if (acc) {
      acc.revenue += d.revenue;
      acc.take += d.take;
    } else {
      doaByLea.set(d.leaid, { revenue: d.revenue, take: d.take });
    }
  }

  const rows: UtilizationRow[] = [];
  for (const [leaid, w] of wonByLea) {
    const delivered = doaByLea.get(leaid);
    const revenue = delivered?.revenue ?? 0;
    const take = delivered?.take ?? 0;
    rows.push({
      account: w.account,
      source: w.source,
      minCommit: w.minCommit,
      maxBudget: w.maxBudget,
      revenue,
      take,
      deferred: Math.max(0, w.minCommit - revenue),
      utilPct: w.maxBudget > 0 ? revenue / w.maxBudget : null,
      underMin: revenue < w.minCommit,
    });
  }
  return rows.sort((a, b) => b.maxBudget - a.maxBudget || a.account.localeCompare(b.account));
}

// ── Targets drill-in (district funnel) ────────────────────────────────────────
// Behind the Targets card. The atomic unit is one DISTINCT worked district within
// the scope (an account drill-in), so pipeline sums stay consistent — in rep mode
// (the default) this is also 1:1 with the card's worked-district count. The growth
// segment is the largest of new/winback/expansion ($-weighted), or null when no
// growth target is set ("No targets set" — its own row, never guessed).

// One growth segment of a target (renewal is excluded from segment classification,
// matching the Targets card's segment split).
export type TargetSegment = "new" | "winback" | "expansion";

// Per-district input: the deduped target $ plus the account's DOA pipeline/won, the
// rep(s) working it, and its activity timing. Assembled in deals-source.ts.
export interface TargetDistrictAgg {
  leaid: string;
  account: string;
  state: string | null;
  segment: TargetSegment | null; // largest growth target; null = none set
  targetDollars: number; // Σ new+winback+expansion target $
  openPipe: number; // DOA open pipeline on the account
  won: number; // DOA closed-won on the account
  owners: string[]; // display names of the rep(s) whose plan(s) work this district
  lastActivity: string | null; // ISO date of the most recent past logged activity
  nextActivity: string | null; // ISO date of the nearest future scheduled activity
  active: boolean; // a logged activity within the last 90 days
}

export interface TargetDetailRow {
  account: string;
  state: string | null;
  segment: TargetSegment | null;
  targetDollars: number;
  openPipe: number;
  won: number;
  pipeline: number; // openPipe + won
  converted: boolean; // has open pipeline (openPipe > 0)
  owners: string[];
  lastActivity: string | null;
  nextActivity: string | null;
  active: boolean;
}

// Derive the funnel fields per district and order biggest-target-first. Pure: the
// source layer has already deduped to one row per district. Tie-broken by pipeline
// then account name so the order is stable.
export function buildTargetDetailRows(aggs: TargetDistrictAgg[]): TargetDetailRow[] {
  return aggs
    .map((a) => ({
      account: a.account,
      state: a.state,
      segment: a.segment,
      targetDollars: a.targetDollars,
      openPipe: a.openPipe,
      won: a.won,
      pipeline: a.openPipe + a.won,
      converted: a.openPipe > 0,
      owners: a.owners,
      lastActivity: a.lastActivity,
      nextActivity: a.nextActivity,
      active: a.active,
    }))
    .sort(
      (a, b) =>
        b.targetDollars - a.targetDollars ||
        b.pipeline - a.pipeline ||
        a.account.localeCompare(b.account),
    );
}

// ── Totals footer per metric ──────────────────────────────────────────────────

export interface DealTotals {
  count: number;
  committed?: number; // pipeline: Σ net booking
  amount?: number; // bookings: Σ signed net booking
  minCommit?: number;
  maxBudget?: number;
  revenue?: number; // rev/take
  take?: number; // rev/take
  deferred?: number; // rev/take
  utilPct?: number | null; // rev/take: blended Σrevenue / Σmaxbudget
  targetDollars?: number; // targets: Σ growth target $
  openPipe?: number; // targets: Σ open pipeline on the accounts
  won?: number; // targets: Σ closed-won on the accounts
  pipeline?: number; // targets: Σ open + won
  converted?: number; // targets: # districts with open pipeline
  active?: number; // targets: # districts touched in 90d
}

function sum<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((s, r) => s + pick(r), 0);
}

// Footer totals for the open metric. Pipeline/bookings sum money straight; rev/take
// also derive a BLENDED utilization (Σrevenue / Σmaxbudget), not the mean of the
// per-row percentages, so a few large accounts dominate as they should.
export function buildDealTotals(
  metric: DealMetric,
  rows: PipelineDealRow[] | BookingDealRow[] | UtilizationRow[] | TargetDetailRow[],
): DealTotals {
  if (metric === "targets") {
    const r = rows as TargetDetailRow[];
    return {
      count: r.length,
      targetDollars: sum(r, (x) => x.targetDollars),
      openPipe: sum(r, (x) => x.openPipe),
      won: sum(r, (x) => x.won),
      pipeline: sum(r, (x) => x.pipeline),
      converted: r.filter((x) => x.converted).length,
      active: r.filter((x) => x.active).length,
    };
  }
  if (metric === "pipeline") {
    const r = rows as PipelineDealRow[];
    return { count: r.length, committed: sum(r, (x) => x.committed), maxBudget: sum(r, (x) => x.maxBudget) };
  }
  if (metric === "bookings") {
    const r = rows as BookingDealRow[];
    return {
      count: r.length,
      amount: sum(r, (x) => x.amount),
      minCommit: sum(r, (x) => x.minCommit),
      maxBudget: sum(r, (x) => x.maxBudget),
    };
  }
  // rev | take
  const r = rows as UtilizationRow[];
  const maxBudget = sum(r, (x) => x.maxBudget);
  const revenue = sum(r, (x) => x.revenue);
  return {
    count: r.length,
    minCommit: sum(r, (x) => x.minCommit),
    maxBudget,
    revenue,
    take: sum(r, (x) => x.take),
    deferred: sum(r, (x) => x.deferred),
    utilPct: maxBudget > 0 ? revenue / maxBudget : null,
  };
}
