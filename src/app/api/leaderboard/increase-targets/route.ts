import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface IncreaseTargetRow {
  leaid: string;
  name: string | null;
  state_abbrev: string | null;
  enrollment: number | string | null;
  lmsid: string | null;
  fy26_revenue: number | string | null;
  fy26_completed_revenue: number | string | null;
  fy26_scheduled_revenue: number | string | null;
  fy26_session_count: number | string | null;
  fy26_subscription_count: number | string | null;
  fy26_opp_bookings: number | string | null;
  fy26_opp_min_commit: number | string | null;
  in_fy27_plan: boolean;
  plan_ids: string[] | null;
  has_fy27_target: boolean;
  has_fy27_pipeline: boolean;
  fy27_open_pipeline: number | string | null;
  sales_rep_name: string | null;
  sales_rep_email: string | null;
  close_date: Date | string | null;
  school_yr: string | null;
  net_booking_amount: number | string | null;
  product_types: string[] | null;
  sub_products: string[] | null;
}

interface IncreaseTarget {
  leaid: string;
  districtName: string;
  state: string;
  enrollment: number | null;
  lmsId: string | null;
  fy26Revenue: number;
  fy26CompletedRevenue: number;
  fy26ScheduledRevenue: number;
  fy26SessionCount: number | null;
  fy26SubscriptionCount: number | null;
  fy26OppBookings: number;
  fy26MinBookings: number;
  inFy27Plan: boolean;
  planIds: string[];
  hasFy27Target: boolean;
  hasFy27Pipeline: boolean;
  fy27OpenPipeline: number;
  // Deprecated alias kept so existing callers compile. Equivalent to inFy27Plan.
  inPlan: boolean;
  lastClosedWon: {
    repName: string | null;
    repEmail: string | null;
    closeDate: string | null;
    schoolYr: string | null;
    amount: number | null;
  } | null;
  productTypes: string[];
  subProducts: string[];
}

function toNumberOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toNumber(v: number | string | null | undefined): number {
  return toNumberOrNull(v) ?? 0;
}

function toIsoOrNull(v: Date | string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
}

// GET /api/leaderboard/increase-targets
// FY26 customers (df revenue OR Closed Won opp bookings/min commits) that have
// NOT yet been renewed in FY27 (no FY27 closed_won or booked revenue).
// Each row carries three FY27 readiness signals so the rep can triage:
//   - inFy27Plan, hasFy27Target, hasFy27Pipeline
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await prisma.$queryRaw<IncreaseTargetRow[]>`
      WITH fy26_df AS (
        SELECT leaid, total_revenue, completed_revenue, scheduled_revenue,
               session_count, subscription_count
        FROM district_financials
        WHERE vendor='fullmind' AND fiscal_year='FY26' AND total_revenue > 0
      ),
      fy26_opp AS (
        SELECT district_lea_id AS leaid,
          SUM(COALESCE(net_booking_amount, 0))::numeric AS bookings,
          SUM(COALESCE(minimum_purchase_amount, 0))::numeric AS min_commit
        FROM opportunities
        WHERE school_yr='2025-26' AND stage ILIKE 'Closed Won%' AND district_lea_id IS NOT NULL
        GROUP BY district_lea_id
        HAVING SUM(COALESCE(net_booking_amount,0))+SUM(COALESCE(minimum_purchase_amount,0)) > 0
      ),
      fy26_any AS (
        SELECT leaid FROM fy26_df UNION SELECT leaid FROM fy26_opp
      ),
      fy27_done AS (
        SELECT leaid
        FROM district_financials
        WHERE vendor='fullmind' AND fiscal_year='FY27'
          AND (COALESCE(closed_won_bookings,0)+COALESCE(total_revenue,0)) > 0
      ),
      fy27_pipe AS (
        SELECT leaid, open_pipeline
        FROM district_financials
        WHERE vendor='fullmind' AND fiscal_year='FY27' AND COALESCE(open_pipeline,0) > 0
      ),
      fy27_plan AS (
        SELECT tpd.district_leaid AS leaid,
          ARRAY_AGG(DISTINCT tp.id::text) AS plan_ids,
          BOOL_OR(
            COALESCE(tpd.renewal_target,0) + COALESCE(tpd.winback_target,0) +
            COALESCE(tpd.expansion_target,0) + COALESCE(tpd.new_business_target,0) > 0
          ) AS has_target
        FROM territory_plan_districts tpd
        JOIN territory_plans tp ON tp.id = tpd.plan_id
        WHERE tp.fiscal_year = 2027
        GROUP BY tpd.district_leaid
      ),
      last_opp AS (
        SELECT DISTINCT ON (district_lea_id)
          district_lea_id AS leaid, sales_rep_name, sales_rep_email,
          close_date, net_booking_amount, school_yr
        FROM opportunities
        WHERE district_lea_id IS NOT NULL AND stage ILIKE 'Closed Won%'
        ORDER BY district_lea_id, close_date DESC
      ),
      top_products AS (
        SELECT o.district_lea_id AS leaid,
          ARRAY_AGG(DISTINCT s.product_type) FILTER (WHERE s.product_type IS NOT NULL) AS product_types,
          ARRAY_AGG(DISTINCT s.sub_product) FILTER (WHERE s.sub_product IS NOT NULL) AS sub_products
        FROM subscriptions s
        JOIN opportunities o ON o.id = s.opportunity_id
        WHERE o.district_lea_id IS NOT NULL
        GROUP BY o.district_lea_id
      )
      SELECT
        d.leaid, d.name, d.state_abbrev, d.enrollment, d.lmsid,
        fy26_df.total_revenue       AS fy26_revenue,
        fy26_df.completed_revenue   AS fy26_completed_revenue,
        fy26_df.scheduled_revenue   AS fy26_scheduled_revenue,
        fy26_df.session_count       AS fy26_session_count,
        fy26_df.subscription_count  AS fy26_subscription_count,
        fy26_opp.bookings           AS fy26_opp_bookings,
        fy26_opp.min_commit         AS fy26_opp_min_commit,
        (fy27_plan.leaid IS NOT NULL)              AS in_fy27_plan,
        fy27_plan.plan_ids,
        COALESCE(fy27_plan.has_target, false)      AS has_fy27_target,
        (fy27_pipe.leaid IS NOT NULL)              AS has_fy27_pipeline,
        fy27_pipe.open_pipeline                    AS fy27_open_pipeline,
        lo.sales_rep_name, lo.sales_rep_email, lo.close_date,
        lo.school_yr, lo.net_booking_amount,
        tp.product_types, tp.sub_products
      FROM fy26_any
      JOIN districts d ON d.leaid = fy26_any.leaid
      LEFT JOIN fy26_df ON fy26_df.leaid = fy26_any.leaid
      LEFT JOIN fy26_opp ON fy26_opp.leaid = fy26_any.leaid
      LEFT JOIN fy27_plan ON fy27_plan.leaid = fy26_any.leaid
      LEFT JOIN fy27_pipe ON fy27_pipe.leaid = fy26_any.leaid
      LEFT JOIN last_opp lo ON lo.leaid = fy26_any.leaid
      LEFT JOIN top_products tp ON tp.leaid = fy26_any.leaid
      WHERE fy26_any.leaid NOT IN (SELECT leaid FROM fy27_done WHERE leaid IS NOT NULL)
        AND fy27_pipe.leaid IS NULL
      ORDER BY
        GREATEST(
          COALESCE(fy26_df.total_revenue, 0),
          COALESCE(fy26_opp.bookings, 0)
        ) DESC
    `;

    const districts: IncreaseTarget[] = rows.map((row) => {
      const hasLastOpp =
        row.sales_rep_name !== null ||
        row.sales_rep_email !== null ||
        row.close_date !== null ||
        row.school_yr !== null ||
        row.net_booking_amount !== null;

      const dfRevenue = toNumber(row.fy26_revenue);
      const oppBookings = toNumber(row.fy26_opp_bookings);

      return {
        leaid: row.leaid,
        districtName: row.name ?? "",
        state: row.state_abbrev ?? "",
        enrollment: toNumberOrNull(row.enrollment),
        lmsId: row.lmsid && row.lmsid !== "0" ? row.lmsid : null,
        fy26Revenue: dfRevenue > 0 ? dfRevenue : oppBookings,
        fy26CompletedRevenue: toNumber(row.fy26_completed_revenue),
        fy26ScheduledRevenue: toNumber(row.fy26_scheduled_revenue),
        fy26SessionCount: toNumberOrNull(row.fy26_session_count),
        fy26SubscriptionCount: toNumberOrNull(row.fy26_subscription_count),
        fy26OppBookings: oppBookings,
        fy26MinBookings: toNumber(row.fy26_opp_min_commit),
        inFy27Plan: row.in_fy27_plan === true,
        planIds: row.plan_ids ?? [],
        hasFy27Target: row.has_fy27_target === true,
        hasFy27Pipeline: row.has_fy27_pipeline === true,
        fy27OpenPipeline: toNumber(row.fy27_open_pipeline),
        inPlan: row.in_fy27_plan === true,
        lastClosedWon: hasLastOpp
          ? {
              repName: row.sales_rep_name ?? null,
              repEmail: row.sales_rep_email ?? null,
              closeDate: toIsoOrNull(row.close_date),
              schoolYr: row.school_yr ?? null,
              amount: toNumberOrNull(row.net_booking_amount),
            }
          : null,
        productTypes: row.product_types ?? [],
        subProducts: row.sub_products ?? [],
      };
    });

    const totalRevenueAtRisk = districts.reduce(
      (sum, d) => sum + d.fy26Revenue,
      0,
    );

    return NextResponse.json({ districts, totalRevenueAtRisk });
  } catch (error) {
    console.error("Error fetching at-risk districts:", error);
    return NextResponse.json(
      { error: "Failed to load at-risk districts" },
      { status: 500 },
    );
  }
}
