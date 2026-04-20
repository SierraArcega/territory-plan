import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Raw row shape returned by the $queryRaw call below. All numeric columns
// may come back as strings (pg) or Decimal (Prisma). We coerce via Number().
interface IncreaseTargetRow {
  leaid: string;
  name: string | null;
  state_abbrev: string | null;
  enrollment: number | string | null;
  total_revenue: number | string | null;
  completed_revenue: number | string | null;
  scheduled_revenue: number | string | null;
  session_count: number | string | null;
  subscription_count: number | string | null;
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
  fy26Revenue: number;
  fy26CompletedRevenue: number;
  fy26ScheduledRevenue: number;
  fy26SessionCount: number | null;
  fy26SubscriptionCount: number | null;
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
  // Already a string — try to normalize via Date; if invalid, return as-is.
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
}

// GET /api/leaderboard/increase-targets
// Returns FY26 Fullmind customers with no FY27 activity and not already in any
// territory plan. Team-wide visibility — every rep sees the same list.
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await prisma.$queryRaw<IncreaseTargetRow[]>`
      WITH fy26 AS (
        SELECT
          leaid,
          total_revenue,
          completed_revenue,
          scheduled_revenue,
          session_count,
          subscription_count
        FROM district_financials
        WHERE vendor = 'fullmind'
          AND fiscal_year = 'FY26'
          AND total_revenue > 0
      ),
      fy27_any AS (
        SELECT leaid
        FROM district_financials
        WHERE vendor = 'fullmind'
          AND fiscal_year = 'FY27'
          AND (
            COALESCE(open_pipeline, 0)
            + COALESCE(closed_won_bookings, 0)
            + COALESCE(total_revenue, 0)
          ) > 0
      ),
      already_planned AS (
        SELECT DISTINCT district_leaid AS leaid
        FROM territory_plan_districts
      ),
      last_opp AS (
        SELECT DISTINCT ON (district_lea_id)
          district_lea_id AS leaid,
          sales_rep_name,
          sales_rep_email,
          close_date,
          net_booking_amount,
          school_yr
        FROM opportunities
        WHERE district_lea_id IS NOT NULL
          AND stage ILIKE 'Closed Won%'
        ORDER BY district_lea_id, close_date DESC
      ),
      top_products AS (
        SELECT
          o.district_lea_id AS leaid,
          ARRAY_AGG(DISTINCT s.product_type) FILTER (WHERE s.product_type IS NOT NULL) AS product_types,
          ARRAY_AGG(DISTINCT s.sub_product) FILTER (WHERE s.sub_product IS NOT NULL) AS sub_products
        FROM subscriptions s
        JOIN opportunities o ON o.id = s.opportunity_id
        WHERE o.district_lea_id IS NOT NULL
        GROUP BY o.district_lea_id
      )
      SELECT
        d.leaid,
        d.name,
        d.state_abbrev,
        d.enrollment,
        fy26.total_revenue,
        fy26.completed_revenue,
        fy26.scheduled_revenue,
        fy26.session_count,
        fy26.subscription_count,
        lo.sales_rep_name,
        lo.sales_rep_email,
        lo.close_date,
        lo.school_yr,
        lo.net_booking_amount,
        tp.product_types,
        tp.sub_products
      FROM fy26
      JOIN districts d ON d.leaid = fy26.leaid
      LEFT JOIN last_opp lo ON lo.leaid = fy26.leaid
      LEFT JOIN top_products tp ON tp.leaid = fy26.leaid
      WHERE fy26.leaid NOT IN (SELECT leaid FROM fy27_any WHERE leaid IS NOT NULL)
        AND fy26.leaid NOT IN (SELECT leaid FROM already_planned WHERE leaid IS NOT NULL)
      ORDER BY fy26.total_revenue DESC
    `;

    const districts: IncreaseTarget[] = rows.map((row) => {
      const hasLastOpp =
        row.sales_rep_name !== null ||
        row.sales_rep_email !== null ||
        row.close_date !== null ||
        row.school_yr !== null ||
        row.net_booking_amount !== null;

      return {
        leaid: row.leaid,
        districtName: row.name ?? "",
        state: row.state_abbrev ?? "",
        enrollment: toNumberOrNull(row.enrollment),
        fy26Revenue: toNumber(row.total_revenue),
        fy26CompletedRevenue: toNumber(row.completed_revenue),
        fy26ScheduledRevenue: toNumber(row.scheduled_revenue),
        fy26SessionCount: toNumberOrNull(row.session_count),
        fy26SubscriptionCount: toNumberOrNull(row.subscription_count),
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
