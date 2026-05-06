import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { computeSuggestedTarget } from "@/features/leaderboard/lib/suggestedTarget";

export const dynamic = "force-dynamic";

interface IncreaseTargetRow {
  leaid: string;
  name: string | null;
  state_abbrev: string | null;
  enrollment: number | string | null;
  lmsid: string | null;
  category: "missing_renewal" | "fullmind_winback" | "ek12_winback";
  fy26_revenue: number | string | null;
  fy26_completed_revenue: number | string | null;
  fy26_scheduled_revenue: number | string | null;
  fy26_session_count: number | string | null;
  fy26_subscription_count: number | string | null;
  fy26_opp_bookings: number | string | null;
  fy26_opp_min_commit: number | string | null;
  prior_year_revenue: number | string | null;
  prior_year_vendor: string | null;
  prior_year_fy: string | null;
  in_fy27_plan: boolean;
  plan_ids: string[] | null;
  has_fy27_target: boolean;
  fy27_target_amount: number | string | null;
  fy27_target_rep_names: string[] | null;
  has_fy27_pipeline: boolean;
  fy27_open_pipeline: number | string | null;
  sales_rep_name: string | null;
  sales_rep_email: string | null;
  close_date: Date | string | null;
  school_yr: string | null;
  net_booking_amount: number | string | null;
  product_types: string[] | null;
  sub_products: string[] | null;
  trend_fy24: number | string | null;
  trend_fy25: number | string | null;
  trend_fy26: number | string | null;
  trend_fy27: number | string | null;
}

type IncreaseTargetCategory =
  | "missing_renewal"
  | "fullmind_winback"
  | "ek12_winback";

interface IncreaseTarget {
  leaid: string;
  districtName: string;
  state: string;
  enrollment: number | null;
  lmsId: string | null;
  category: IncreaseTargetCategory;
  fy26Revenue: number;
  fy26CompletedRevenue: number;
  fy26ScheduledRevenue: number;
  fy26SessionCount: number | null;
  fy26SubscriptionCount: number | null;
  fy26OppBookings: number;
  fy26MinBookings: number;
  priorYearRevenue: number;
  priorYearVendor: string | null;
  priorYearFy: string | null;
  inFy27Plan: boolean;
  planIds: string[];
  hasFy27Target: boolean;
  fy27TargetAmount: number;
  fy27TargetReps: string[];
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
  revenueTrend: {
    fy24: number | null;
    fy25: number | null;
    fy26: number | null;
    fy27: number | null;
  };
  suggestedTarget: number | null;
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
        WHERE school_yr='2025-26' AND stage ILIKE 'Closed Won%'
          AND district_lea_id IS NOT NULL AND district_lea_id != '_NOMAP'
        GROUP BY district_lea_id
        HAVING SUM(COALESCE(net_booking_amount,0))+SUM(COALESCE(minimum_purchase_amount,0)) > 0
      ),
      fy27_done AS (
        SELECT leaid FROM district_financials
        WHERE vendor='fullmind' AND fiscal_year='FY27'
          AND (COALESCE(closed_won_bookings,0)+COALESCE(total_revenue,0)) > 0
      ),
      fy27_pipe AS (
        SELECT leaid, open_pipeline FROM district_financials
        WHERE vendor='fullmind' AND fiscal_year='FY27' AND COALESCE(open_pipeline,0) > 0
      ),
      fy27_plan AS (
        SELECT tpd.district_leaid AS leaid,
          ARRAY_AGG(DISTINCT tp.id::text) AS plan_ids,
          BOOL_OR(
            COALESCE(tpd.renewal_target,0) + COALESCE(tpd.winback_target,0) +
            COALESCE(tpd.expansion_target,0) + COALESCE(tpd.new_business_target,0) > 0
          ) AS has_target,
          SUM(
            COALESCE(tpd.renewal_target,0) + COALESCE(tpd.winback_target,0) +
            COALESCE(tpd.expansion_target,0) + COALESCE(tpd.new_business_target,0)
          ) AS target_amount,
          -- Names of reps whose FY27 plan has a non-zero target on this district.
          -- Falls back to user_id for legacy plans that predate the owner_id split.
          ARRAY_AGG(DISTINCT up.full_name) FILTER (
            WHERE up.full_name IS NOT NULL
              AND COALESCE(tpd.renewal_target,0) + COALESCE(tpd.winback_target,0) +
                  COALESCE(tpd.expansion_target,0) + COALESCE(tpd.new_business_target,0) > 0
          ) AS target_rep_names
        FROM territory_plan_districts tpd
        JOIN territory_plans tp ON tp.id = tpd.plan_id
        LEFT JOIN user_profiles up ON up.id = COALESCE(tp.owner_id, tp.user_id)
        WHERE tp.fiscal_year = 2027
        GROUP BY tpd.district_leaid
      ),
      -- Prior-year Fullmind revenue (FY25 / FY24) for win-back context
      fullmind_prior AS (
        SELECT leaid, total_revenue, fiscal_year,
          ROW_NUMBER() OVER (PARTITION BY leaid ORDER BY fiscal_year DESC) AS rn
        FROM district_financials
        WHERE vendor='fullmind' AND fiscal_year IN ('FY25','FY24')
          AND total_revenue > 0
      ),
      fullmind_prior_latest AS (
        SELECT leaid, total_revenue, fiscal_year FROM fullmind_prior WHERE rn=1
      ),
      -- Prior-year EK12 revenue for win-back context
      ek12_prior AS (
        SELECT leaid, total_revenue, fiscal_year,
          ROW_NUMBER() OVER (PARTITION BY leaid ORDER BY fiscal_year DESC) AS rn
        FROM district_financials
        WHERE vendor='elevate' AND fiscal_year IN ('FY25','FY24')
          AND total_revenue > 0
      ),
      ek12_prior_latest AS (
        SELECT leaid, total_revenue, fiscal_year FROM ek12_prior WHERE rn=1
      ),
      revenue_trend AS (
        SELECT
          df.leaid,
          df.vendor,
          MAX(CASE WHEN df.fiscal_year = 'FY24' THEN df.total_revenue END) AS fy24,
          MAX(CASE WHEN df.fiscal_year = 'FY25' THEN df.total_revenue END) AS fy25,
          MAX(CASE WHEN df.fiscal_year = 'FY26' THEN df.total_revenue END) AS fy26,
          MAX(CASE WHEN df.fiscal_year = 'FY27' THEN df.total_revenue END) AS fy27
        FROM district_financials df
        WHERE df.vendor IN ('fullmind', 'elevate')
          AND df.fiscal_year IN ('FY24','FY25','FY26','FY27')
        GROUP BY df.leaid, df.vendor
      ),
      -- Source 1: FY26 Fullmind customers (df OR opp bookings)
      src_missing_renewal AS (
        SELECT leaid, 'missing_renewal'::text AS category
        FROM (SELECT leaid FROM fy26_df UNION SELECT leaid FROM fy26_opp) f
      ),
      -- Source 2: Fullmind Win Back tagged districts (FY25 / FY26 tags)
      src_fullmind_winback AS (
        SELECT DISTINCT dt.district_leaid AS leaid, 'fullmind_winback'::text AS category
        FROM district_tags dt
        JOIN tags t ON t.id = dt.tag_id
        WHERE t.name IN ('Fullmind Win Back - FY25','Fullmind Win Back - FY26')
      ),
      -- Source 3: EK12 Win Back tagged districts (FY24 / FY25 tags)
      src_ek12_winback AS (
        SELECT DISTINCT dt.district_leaid AS leaid, 'ek12_winback'::text AS category
        FROM district_tags dt
        JOIN tags t ON t.id = dt.tag_id
        WHERE t.name IN ('EK12 Win Back - FY24','EK12 Win Back - FY25')
      ),
      -- Unioned candidates; dedup with priority missing_renewal > fullmind_winback > ek12_winback
      candidates AS (
        SELECT leaid, category,
          ROW_NUMBER() OVER (
            PARTITION BY leaid
            ORDER BY CASE category
              WHEN 'missing_renewal' THEN 1
              WHEN 'fullmind_winback' THEN 2
              WHEN 'ek12_winback' THEN 3
            END
          ) AS rn
        FROM (
          SELECT * FROM src_missing_renewal
          UNION ALL SELECT * FROM src_fullmind_winback
          UNION ALL SELECT * FROM src_ek12_winback
        ) u
      ),
      eligible AS (
        SELECT leaid, category FROM candidates WHERE rn=1
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
      ),
      -- Any FY27 opp regardless of stage or amount.
      -- Catches Closed Lost and zero-dollar Stage 0 opps that
      -- district_financials' open_pipeline / closed_won_bookings miss.
      fy27_any_opp AS (
        SELECT DISTINCT district_lea_id AS leaid
        FROM opportunities
        WHERE school_yr = '2026-27'
          AND district_lea_id IS NOT NULL
          AND district_lea_id != '_NOMAP'
      )
      SELECT
        d.leaid, d.name, d.state_abbrev, d.enrollment, d.lmsid,
        eligible.category,
        fy26_df.total_revenue       AS fy26_revenue,
        fy26_df.completed_revenue   AS fy26_completed_revenue,
        fy26_df.scheduled_revenue   AS fy26_scheduled_revenue,
        fy26_df.session_count       AS fy26_session_count,
        fy26_df.subscription_count  AS fy26_subscription_count,
        fy26_opp.bookings           AS fy26_opp_bookings,
        fy26_opp.min_commit         AS fy26_opp_min_commit,
        CASE eligible.category
          WHEN 'fullmind_winback' THEN fpl.total_revenue
          WHEN 'ek12_winback'     THEN epl.total_revenue
          ELSE NULL
        END AS prior_year_revenue,
        CASE eligible.category
          WHEN 'fullmind_winback' THEN 'fullmind'
          WHEN 'ek12_winback'     THEN 'elevate'
          ELSE NULL
        END AS prior_year_vendor,
        CASE eligible.category
          WHEN 'fullmind_winback' THEN fpl.fiscal_year
          WHEN 'ek12_winback'     THEN epl.fiscal_year
          ELSE NULL
        END AS prior_year_fy,
        (fy27_plan.leaid IS NOT NULL)              AS in_fy27_plan,
        fy27_plan.plan_ids,
        COALESCE(fy27_plan.has_target, false)      AS has_fy27_target,
        COALESCE(fy27_plan.target_amount, 0)       AS fy27_target_amount,
        fy27_plan.target_rep_names                 AS fy27_target_rep_names,
        (fy27_pipe.leaid IS NOT NULL)              AS has_fy27_pipeline,
        fy27_pipe.open_pipeline                    AS fy27_open_pipeline,
        lo.sales_rep_name, lo.sales_rep_email, lo.close_date,
        lo.school_yr, lo.net_booking_amount,
        tp.product_types, tp.sub_products,
        rt.fy24 AS trend_fy24,
        rt.fy25 AS trend_fy25,
        rt.fy26 AS trend_fy26,
        rt.fy27 AS trend_fy27
      FROM eligible
      JOIN districts d ON d.leaid = eligible.leaid
      LEFT JOIN fy26_df ON fy26_df.leaid = eligible.leaid
      LEFT JOIN fy26_opp ON fy26_opp.leaid = eligible.leaid
      LEFT JOIN fullmind_prior_latest fpl ON fpl.leaid = eligible.leaid
      LEFT JOIN ek12_prior_latest epl ON epl.leaid = eligible.leaid
      LEFT JOIN revenue_trend rt
        ON rt.leaid = eligible.leaid
       AND rt.vendor = CASE WHEN eligible.category = 'ek12_winback' THEN 'elevate' ELSE 'fullmind' END
      LEFT JOIN fy27_plan ON fy27_plan.leaid = eligible.leaid
      LEFT JOIN fy27_pipe ON fy27_pipe.leaid = eligible.leaid
      LEFT JOIN last_opp lo ON lo.leaid = eligible.leaid
      LEFT JOIN top_products tp ON tp.leaid = eligible.leaid
      WHERE eligible.leaid NOT IN (SELECT leaid FROM fy27_done WHERE leaid IS NOT NULL)
        AND fy27_pipe.leaid IS NULL
        AND eligible.leaid NOT IN (SELECT leaid FROM fy27_any_opp)
        -- Win-back categories also require no FY27 plan membership;
        -- Missing Renewal Opp stays visible even when in a plan (action flips to Open in LMS).
        AND (
          eligible.category = 'missing_renewal'
          OR fy27_plan.leaid IS NULL
        )
      ORDER BY
        CASE eligible.category
          WHEN 'missing_renewal' THEN 1
          WHEN 'fullmind_winback' THEN 2
          WHEN 'ek12_winback' THEN 3
        END,
        GREATEST(
          COALESCE(fy26_df.total_revenue, 0),
          COALESCE(fy26_opp.bookings, 0),
          COALESCE(fpl.total_revenue, 0),
          COALESCE(epl.total_revenue, 0)
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
        category: row.category,
        fy26Revenue: dfRevenue > 0 ? dfRevenue : oppBookings,
        fy26CompletedRevenue: toNumber(row.fy26_completed_revenue),
        fy26ScheduledRevenue: toNumber(row.fy26_scheduled_revenue),
        fy26SessionCount: toNumberOrNull(row.fy26_session_count),
        fy26SubscriptionCount: toNumberOrNull(row.fy26_subscription_count),
        fy26OppBookings: oppBookings,
        fy26MinBookings: toNumber(row.fy26_opp_min_commit),
        priorYearRevenue: toNumber(row.prior_year_revenue),
        priorYearVendor: row.prior_year_vendor ?? null,
        priorYearFy: row.prior_year_fy ?? null,
        inFy27Plan: row.in_fy27_plan === true,
        planIds: row.plan_ids ?? [],
        hasFy27Target: row.has_fy27_target === true,
        fy27TargetAmount: toNumber(row.fy27_target_amount),
        fy27TargetReps: row.fy27_target_rep_names ?? [],
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
        revenueTrend: {
          fy24: toNumberOrNull(row.trend_fy24),
          fy25: toNumberOrNull(row.trend_fy25),
          fy26: toNumberOrNull(row.trend_fy26),
          fy27: toNumberOrNull(row.trend_fy27),
        },
        suggestedTarget: computeSuggestedTarget(
          row.category,
          dfRevenue > 0 ? dfRevenue : oppBookings,
          toNumber(row.prior_year_revenue),
        ),
      };
    });

    // Sum FY26 for renewal rows, prior-year for win-back rows — reflects
    // the dollars at stake for each category.
    const totalRevenueAtRisk = districts.reduce(
      (sum, d) =>
        sum + (d.category === "missing_renewal" ? d.fy26Revenue : d.priorYearRevenue),
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
