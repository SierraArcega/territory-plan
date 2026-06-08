// Source-row fetching for the topline detail modals (/deals route). One query set
// per metric, scoped via the shared emailFilterSql (rep = the subject email; team =
// the whole book). SQL-heavy / DB-bound, so verified live (temp diagnostics +
// :3005), not unit-tested — the pure derivation it feeds (buildUtilizationRows /
// buildDealTotals) is covered in deals.test.ts. Open/closed bucketing reuses
// stagePrefixSql so it never drifts from the Pipeline tab / DOA matview.

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { schoolYearForFY } from "@/lib/fiscal-year";
import { stagePrefixSql } from "./trajectory-source";
import { emailFilterSql, type DashboardScope } from "./scope";
import { CATEGORY_TO_SEGMENT } from "./segments";
import { districtSegment } from "./targets";
import { PIPELINE_STAGES, classifyTier } from "./pipeline";
import { fetchStageBenchmarks } from "./pipeline-source";
import type { PipelineDealRow, BookingDealRow, WonAccountAgg, DoaAccountAgg, TargetDistrictAgg } from "./deals";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

const STAGE_NAME = new Map(PIPELINE_STAGES.map((s) => [s.prefix, s.name]));
const toSegment = (category: string | null) => (category ? CATEGORY_TO_SEGMENT[category] ?? null : null);

// Each opp's activity timing: the most recent PAST touch (with the free-text note
// from that same touch) and the nearest FUTURE scheduled touch. Keyed by opp id;
// opps with no logged activity are absent.
interface OppActivity {
  last: { date: Date; note: string | null } | null;
  next: { date: Date } | null;
}
async function activityByOpp(oppIds: string[]): Promise<Map<string, OppActivity>> {
  const out = new Map<string, OppActivity>();
  if (oppIds.length === 0) return out;
  const now = new Date();
  const links = await prisma.activityOpportunity.findMany({
    where: { opportunityId: { in: oppIds }, activity: { startDate: { not: null } } },
    select: { opportunityId: true, activity: { select: { startDate: true, notes: true, outcome: true } } },
  });
  for (const l of links) {
    const d = l.activity?.startDate;
    if (!d) continue;
    const cur = out.get(l.opportunityId) ?? { last: null, next: null };
    if (d <= now) {
      if (!cur.last || d > cur.last.date) cur.last = { date: d, note: l.activity.notes ?? l.activity.outcome ?? null };
    } else if (!cur.next || d < cur.next.date) {
      cur.next = { date: d };
    }
    out.set(l.opportunityId, cur);
  }
  return out;
}

interface RawPipelineRow {
  oppId: string;
  account: string | null;
  state: string | null;
  owner: string | null;
  stagePrefix: number | null;
  category: string | null;
  committed: number;
  maxBudget: number;
  closeDate: Date | null;
  daysInStage: number;
  overdueClose: boolean;
}

// pipeline metric → the scope's OPEN opps (stage prefix 0–5). net_booking is the
// committed value; maxBudget the ceiling. Source = DOA segment (motion). Mirrors
// the Pipeline tab's open-opp shape, scoped + ordered by value. Each row carries its
// owner, deal-age health (tier/overdue, graded against the same Stale 2.0 stage
// benchmarks as the Pipeline tab), and its last/next activity + note.
export async function fetchPipelineDeals(sy: string, scope: DashboardScope): Promise<PipelineDealRow[]> {
  const rowsP = prisma.$queryRaw<RawPipelineRow[]>`
    SELECT * FROM (
      SELECT o.id AS "oppId",
             o.district_name AS account,
             o.state,
             o.sales_rep_name AS owner,
             ${stagePrefixSql(Prisma.sql`o.stage`)} AS "stagePrefix",
             c.category,
             o.net_booking_amount::float AS committed,
             COALESCE(o.maximum_budget, 0)::float AS "maxBudget",
             o.close_date AS "closeDate",
             GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE((last.elem ->> 'changed_at')::timestamptz, o.created_at))) / 86400)::float AS "daysInStage",
             (o.close_date IS NOT NULL AND o.close_date < now()) AS "overdueClose"
      FROM opportunities o
      LEFT JOIN (
        SELECT district_lea_id, (ARRAY_AGG(category ORDER BY bookings DESC, open_pipeline DESC))[1] AS category
        FROM district_opportunity_actuals WHERE school_yr = ${sy} GROUP BY district_lea_id
      ) c ON c.district_lea_id = o.district_lea_id
      LEFT JOIN LATERAL (
        SELECT elem
        FROM jsonb_array_elements(o.stage_history) elem
        WHERE jsonb_typeof(o.stage_history) = 'array'
        ORDER BY (elem ->> 'changed_at')::timestamptz DESC NULLS LAST
        LIMIT 1
      ) last ON true
      WHERE o.school_yr = ${sy}
        AND o.net_booking_amount IS NOT NULL
        ${emailFilterSql(scope, Prisma.sql`o.sales_rep_email`)}
    ) t
    WHERE t."stagePrefix" BETWEEN 0 AND 5
    ORDER BY t.committed DESC NULLS LAST`;

  const [rows, benchmarks] = await Promise.all([rowsP, fetchStageBenchmarks()]);
  const activity = await activityByOpp(rows.map((r) => r.oppId));

  return rows.map((r) => {
    const act = activity.get(r.oppId);
    return {
      account: r.account ?? "—",
      state: r.state,
      stageName: r.stagePrefix == null ? "—" : STAGE_NAME.get(r.stagePrefix) ?? "—",
      source: toSegment(r.category),
      committed: r.committed,
      maxBudget: r.maxBudget,
      closeDate: r.closeDate ? r.closeDate.toISOString() : null,
      owner: r.owner,
      lastActivity: act?.last ? act.last.date.toISOString() : null,
      lastNote: act?.last?.note ?? null,
      nextActivity: act?.next ? act.next.date.toISOString() : null,
      tier: r.stagePrefix == null ? "on" : classifyTier(r.daysInStage, r.stagePrefix, benchmarks.get(r.stagePrefix)),
      overdue: r.overdueClose,
    };
  });
}

interface RawBookingRow {
  account: string | null;
  product: string | null;
  category: string | null;
  amount: number;
  minCommit: number;
  maxBudget: number;
  closedDate: Date | null;
}

// bookings metric → the scope's CLOSED-WON opps (prefix ≥6). Product = contract_type
// (the tier) — kept distinct from `source` (the DOA motion segment). amount = signed
// net booking; minCommit / maxBudget are the contract's agreed floor / max budget.
export async function fetchBookingDeals(sy: string, scope: DashboardScope): Promise<BookingDealRow[]> {
  const rows = await prisma.$queryRaw<RawBookingRow[]>`
    SELECT o.district_name AS account,
           o.contract_type AS product,
           c.category,
           o.net_booking_amount::float AS amount,
           COALESCE(o.minimum_purchase_amount, 0)::float AS "minCommit",
           COALESCE(o.maximum_budget, 0)::float AS "maxBudget",
           o.close_date AS "closedDate"
    FROM opportunities o
    LEFT JOIN (
      SELECT district_lea_id, (ARRAY_AGG(category ORDER BY bookings DESC, open_pipeline DESC))[1] AS category
      FROM district_opportunity_actuals WHERE school_yr = ${sy} GROUP BY district_lea_id
    ) c ON c.district_lea_id = o.district_lea_id
    WHERE o.school_yr = ${sy}
      AND o.net_booking_amount IS NOT NULL
      ${emailFilterSql(scope, Prisma.sql`o.sales_rep_email`)}
      AND ${stagePrefixSql(Prisma.sql`o.stage`)} >= 6
    ORDER BY o.net_booking_amount DESC NULLS LAST`;

  return rows.map((r) => ({
    account: r.account ?? "—",
    product: r.product,
    source: toSegment(r.category),
    amount: r.amount,
    minCommit: r.minCommit,
    maxBudget: r.maxBudget,
    closedDate: r.closedDate ? r.closedDate.toISOString() : null,
  }));
}

interface RawWonAggRow {
  leaid: string;
  account: string | null;
  category: string | null;
  minCommit: number;
  maxBudget: number;
}
interface RawDoaAggRow {
  leaid: string;
  revenue: number;
  take: number;
}

// rev / take metric → the per-account utilization inputs. Min/max come from WON
// opps only (the contracted book), aggregated per district; the DOA category is
// collapsed to one segment per district (the highest-bookings category) so the
// money sums never fan out. Delivered revenue/take come from DOA. The route feeds
// both into buildUtilizationRows.
export async function fetchUtilizationSource(
  sy: string,
  scope: DashboardScope,
): Promise<{ won: WonAccountAgg[]; doa: DoaAccountAgg[] }> {
  const [wonRows, doaRows] = await Promise.all([
    prisma.$queryRaw<RawWonAggRow[]>`
      SELECT o.district_lea_id AS leaid,
             MIN(o.district_name) AS account,
             MAX(c.category) AS category,
             COALESCE(SUM(COALESCE(o.minimum_purchase_amount, 0)), 0)::float AS "minCommit",
             COALESCE(SUM(COALESCE(o.maximum_budget, 0)), 0)::float AS "maxBudget"
      FROM opportunities o
      LEFT JOIN (
        SELECT district_lea_id, (ARRAY_AGG(category ORDER BY bookings DESC, open_pipeline DESC))[1] AS category
        FROM district_opportunity_actuals WHERE school_yr = ${sy} GROUP BY district_lea_id
      ) c ON c.district_lea_id = o.district_lea_id
      WHERE o.school_yr = ${sy}
        AND o.district_lea_id IS NOT NULL
        ${emailFilterSql(scope, Prisma.sql`o.sales_rep_email`)}
        AND ${stagePrefixSql(Prisma.sql`o.stage`)} >= 6
      GROUP BY o.district_lea_id`,

    prisma.$queryRaw<RawDoaAggRow[]>`
      SELECT district_lea_id AS leaid,
             COALESCE(SUM(completed_revenue), 0)::float AS revenue,
             COALESCE(SUM(completed_take), 0)::float AS take
      FROM district_opportunity_actuals
      WHERE school_yr = ${sy}
        ${emailFilterSql(scope, Prisma.sql`sales_rep_email`)}
      GROUP BY district_lea_id`,
  ]);

  return {
    won: wonRows.map((r) => ({
      leaid: r.leaid,
      account: r.account ?? "—",
      source: toSegment(r.category),
      minCommit: r.minCommit,
      maxBudget: r.maxBudget,
    })),
    doa: doaRows.map((r) => ({ leaid: r.leaid, revenue: r.revenue, take: r.take })),
  };
}

// targets metric → the per-district funnel behind the Targets card. Mirrors the
// Targets card's data assembly (targets/route.ts) so the drill-in can't drift from
// the headline: worked districts come from PLAN OWNERSHIP (team = every fy plan;
// rep = the subject's plans), summed to one row per DISTINCT district. Pipeline/won
// come from DOA scoped by sales_rep_email; the 90-day "active" flag from logged
// activities (team = any plan owner; rep = the subject). Deduping to distinct
// districts keeps pipeline sums consistent — in rep mode it's 1:1 with the card's
// worked-district count. Fed into buildTargetDetailRows by the route.
export async function fetchTargetDetail(
  fy: number,
  scope: DashboardScope,
  callerUserId: string,
): Promise<TargetDistrictAgg[]> {
  const schoolYr = schoolYearForFY(fy);

  // Worked plan-districts for the scope. Team = the whole book; rep = the subject's
  // own plans (ownerId, or a legacy userId-owned plan with no ownerId).
  const planWhere =
    scope.mode === "team"
      ? { fiscalYear: fy }
      : {
          OR: [{ ownerId: scope.rep.id }, { userId: scope.rep.id, ownerId: null }],
          fiscalYear: fy,
        };

  const planRows = await prisma.territoryPlanDistrict.findMany({
    where: { plan: planWhere },
    select: {
      districtLeaid: true,
      winbackTarget: true,
      expansionTarget: true,
      newBusinessTarget: true,
      plan: { select: { ownerId: true, userId: true } },
    },
  });

  // Dedupe to one row per distinct district, summing the growth target columns and
  // collecting the owner(s) — a district can appear in several plans, or be worked
  // by multiple reps in team mode.
  const byLea = new Map<string, { newB: number; winback: number; expansion: number; owners: Set<string> }>();
  const allOwners = new Set<string>();
  for (const r of planRows) {
    const owner = r.plan.ownerId ?? r.plan.userId;
    if (owner) allOwners.add(owner);
    const acc = byLea.get(r.districtLeaid) ?? { newB: 0, winback: 0, expansion: 0, owners: new Set<string>() };
    if (owner) acc.owners.add(owner);
    acc.newB += Number(r.newBusinessTarget ?? 0);
    acc.winback += Number(r.winbackTarget ?? 0);
    acc.expansion += Number(r.expansionTarget ?? 0);
    byLea.set(r.districtLeaid, acc);
  }
  const leaids = Array.from(byLea.keys());
  if (leaids.length === 0) return [];

  // Team = a logged activity by ANY plan owner counts; rep = the subject only.
  const activityUserIds =
    scope.mode === "team" ? Array.from(new Set([...allOwners, callerUserId])) : [scope.rep.id];
  const ninetyDaysAgo = new Date(Date.now() - NINETY_DAYS_MS);
  const now = new Date();

  const [districts, doaRows, activityRows, profiles] = await Promise.all([
    prisma.district.findMany({
      where: { leaid: { in: leaids } },
      select: { leaid: true, name: true, stateAbbrev: true },
    }),
    prisma.$queryRaw<{ leaid: string; openPipe: number; won: number }[]>`
      SELECT district_lea_id AS leaid,
             COALESCE(SUM(open_pipeline), 0)::float AS "openPipe",
             COALESCE(SUM(bookings), 0)::float AS won
      FROM district_opportunity_actuals
      WHERE school_yr = ${schoolYr}
        ${emailFilterSql(scope, Prisma.sql`sales_rep_email`)}
        AND district_lea_id = ANY(${leaids})
      GROUP BY district_lea_id`,
    // Every in-scope activity touch on these districts, with its date — reduced
    // below to each district's last-logged (past) and next-scheduled (future) dates.
    prisma.activityDistrict.findMany({
      where: {
        districtLeaid: { in: leaids },
        activity: { createdByUserId: { in: activityUserIds }, startDate: { not: null } },
      },
      select: { districtLeaid: true, activity: { select: { startDate: true } } },
    }),
    prisma.userProfile.findMany({
      where: { id: { in: Array.from(allOwners) } },
      select: { id: true, fullName: true, email: true },
    }),
  ]);

  const metaByLea = new Map(districts.map((d) => [d.leaid, { name: d.name, state: d.stateAbbrev }]));
  const doaByLea = new Map(doaRows.map((d) => [d.leaid, d]));
  const nameById = new Map(profiles.map((p) => [p.id, p.fullName ?? p.email]));

  // Reduce activity links to each district's most recent past date and nearest
  // future date in one pass.
  const lastByLea = new Map<string, Date>();
  const nextByLea = new Map<string, Date>();
  for (const a of activityRows) {
    const d = a.activity?.startDate;
    if (!d) continue;
    if (d <= now) {
      const cur = lastByLea.get(a.districtLeaid);
      if (!cur || d > cur) lastByLea.set(a.districtLeaid, d);
    } else {
      const cur = nextByLea.get(a.districtLeaid);
      if (!cur || d < cur) nextByLea.set(a.districtLeaid, d);
    }
  }

  return leaids.map((leaid) => {
    const t = byLea.get(leaid)!;
    const doa = doaByLea.get(leaid);
    const meta = metaByLea.get(leaid);
    const last = lastByLea.get(leaid) ?? null;
    const next = nextByLea.get(leaid) ?? null;
    return {
      leaid,
      account: meta?.name ?? "—",
      state: meta?.state ?? null,
      segment: districtSegment({
        newBusinessTarget: t.newB,
        winbackTarget: t.winback,
        expansionTarget: t.expansion,
      }),
      targetDollars: t.newB + t.winback + t.expansion,
      openPipe: doa?.openPipe ?? 0,
      won: doa?.won ?? 0,
      owners: Array.from(t.owners)
        .map((id) => nameById.get(id))
        .filter((n): n is string => !!n)
        .sort(),
      lastActivity: last ? last.toISOString() : null,
      nextActivity: next ? next.toISOString() : null,
      active: last != null && last >= ninetyDaysAgo,
    };
  });
}
