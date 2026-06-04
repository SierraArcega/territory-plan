// Source-row fetching for the topline detail modals (/deals route). One query set
// per metric, scoped via the shared emailFilterSql (rep = the subject email; team =
// the whole book). SQL-heavy / DB-bound, so verified live (temp diagnostics +
// :3005), not unit-tested — the pure derivation it feeds (buildUtilizationRows /
// buildDealTotals) is covered in deals.test.ts. Open/closed bucketing reuses
// stagePrefixSql so it never drifts from the Pipeline tab / DOA matview.

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { stagePrefixSql } from "./trajectory-source";
import { emailFilterSql, type DashboardScope } from "./scope";
import { CATEGORY_TO_SEGMENT } from "./segments";
import { PIPELINE_STAGES } from "./pipeline";
import type { PipelineDealRow, BookingDealRow, WonAccountAgg, DoaAccountAgg } from "./deals";

const STAGE_NAME = new Map(PIPELINE_STAGES.map((s) => [s.prefix, s.name]));
const toSegment = (category: string | null) => (category ? CATEGORY_TO_SEGMENT[category] ?? null : null);

interface RawPipelineRow {
  account: string | null;
  state: string | null;
  stagePrefix: number | null;
  category: string | null;
  committed: number;
  maxBudget: number;
  closeDate: Date | null;
}

// pipeline metric → the scope's OPEN opps (stage prefix 0–5). net_booking is the
// committed value; maxBudget the ceiling. Source = DOA segment (motion). Mirrors
// the Pipeline tab's open-opp shape, scoped + ordered by value.
export async function fetchPipelineDeals(sy: string, scope: DashboardScope): Promise<PipelineDealRow[]> {
  const rows = await prisma.$queryRaw<RawPipelineRow[]>`
    SELECT o.district_name AS account,
           o.state,
           ${stagePrefixSql(Prisma.sql`o.stage`)} AS "stagePrefix",
           c.category,
           o.net_booking_amount::float AS committed,
           COALESCE(o.maximum_budget, 0)::float AS "maxBudget",
           o.close_date AS "closeDate"
    FROM opportunities o
    LEFT JOIN (
      SELECT district_lea_id, (ARRAY_AGG(category ORDER BY bookings DESC, open_pipeline DESC))[1] AS category
      FROM district_opportunity_actuals WHERE school_yr = ${sy} GROUP BY district_lea_id
    ) c ON c.district_lea_id = o.district_lea_id
    WHERE o.school_yr = ${sy}
      AND o.net_booking_amount IS NOT NULL
      ${emailFilterSql(scope, Prisma.sql`o.sales_rep_email`)}
      AND ${stagePrefixSql(Prisma.sql`o.stage`)} BETWEEN 0 AND 5
    ORDER BY o.net_booking_amount DESC NULLS LAST`;

  return rows.map((r) => ({
    account: r.account ?? "—",
    state: r.state,
    stageName: r.stagePrefix == null ? "—" : STAGE_NAME.get(r.stagePrefix) ?? "—",
    source: toSegment(r.category),
    committed: r.committed,
    maxBudget: r.maxBudget,
    closeDate: r.closeDate ? r.closeDate.toISOString() : null,
  }));
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
