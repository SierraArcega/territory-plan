// src/lib/opportunity-actuals.ts
// TODO: Consider consolidating district_opportunity_actuals with refresh_fullmind_financials().
// Both aggregate from the same opportunities source — the mat view aggregates by rep+category
// while the DB function aggregates by district+vendor+FY. Potential to unify into one pipeline.
import prisma from "@/lib/prisma";

/**
 * Safely execute a raw query, returning fallback if the relation doesn't exist yet.
 * Catches PostgreSQL error 42P01 (undefined_table) which occurs when the
 * materialized view or opportunities table hasn't been created.
 */
async function safeQueryRaw<T>(query: Promise<T>, fallback: T): Promise<T> {
  try {
    return await query;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2010" &&
      error.message.includes("42P01")
    ) {
      return fallback;
    }
    throw error;
  }
}

/**
 * Convert a fiscal year number (26 or 2026) to school year string ("2025-26").
 * School year "2025-26" = FY26 (fiscal year starts July 1 of the first year).
 */
export function fiscalYearToSchoolYear(fy: number): string {
  const year = fy < 100 ? 2000 + fy : fy;
  const startYear = year - 1;
  const endYearShort = String(year).slice(-2);
  return `${startYear}-${endYearShort}`;
}

export interface DistrictActuals {
  totalRevenue: number;
  completedRevenue: number;
  scheduledRevenue: number;
  totalTake: number;
  completedTake: number;
  scheduledTake: number;
  weightedPipeline: number;
  openPipeline: number;
  bookings: number;
  invoiced: number;
  credited: number;
  oppCount: number;
  takeRate: number | null;
}

interface RawDistrictActuals {
  total_revenue: number;
  completed_revenue: number;
  scheduled_revenue: number;
  total_take: number;
  completed_take: number;
  scheduled_take: number;
  weighted_pipeline: number;
  open_pipeline: number;
  bookings: number;
  invoiced: number;
  credited: number;
  opp_count: number;
}

const EMPTY_ACTUALS: DistrictActuals = {
  totalRevenue: 0,
  completedRevenue: 0,
  scheduledRevenue: 0,
  totalTake: 0,
  completedTake: 0,
  scheduledTake: 0,
  weightedPipeline: 0,
  openPipeline: 0,
  bookings: 0,
  invoiced: 0,
  credited: 0,
  oppCount: 0,
  takeRate: null,
};

function mapRawToActuals(row: RawDistrictActuals): DistrictActuals {
  const totalRevenue = Number(row.total_revenue);
  const totalTake = Number(row.total_take);
  return {
    totalRevenue,
    completedRevenue: Number(row.completed_revenue),
    scheduledRevenue: Number(row.scheduled_revenue),
    totalTake,
    completedTake: Number(row.completed_take),
    scheduledTake: Number(row.scheduled_take),
    weightedPipeline: Number(row.weighted_pipeline),
    openPipeline: Number(row.open_pipeline),
    bookings: Number(row.bookings),
    invoiced: Number(row.invoiced),
    credited: Number(row.credited),
    oppCount: Number(row.opp_count),
    takeRate: totalRevenue > 0 ? totalTake / totalRevenue : null,
  };
}

/**
 * Get aggregated actuals for a specific district and school year.
 * NOT rep-scoped — shows all opportunities for the district.
 */
export async function getDistrictActuals(
  districtLeaId: string,
  schoolYr: string
): Promise<DistrictActuals> {
  const rows = await safeQueryRaw(
    prisma.$queryRaw<RawDistrictActuals[]>`
      SELECT
        COALESCE(SUM(total_revenue), 0) AS total_revenue,
        COALESCE(SUM(completed_revenue), 0) AS completed_revenue,
        COALESCE(SUM(scheduled_revenue), 0) AS scheduled_revenue,
        COALESCE(SUM(total_take), 0) AS total_take,
        COALESCE(SUM(completed_take), 0) AS completed_take,
        COALESCE(SUM(scheduled_take), 0) AS scheduled_take,
        COALESCE(SUM(weighted_pipeline), 0) AS weighted_pipeline,
        COALESCE(SUM(open_pipeline), 0) AS open_pipeline,
        COALESCE(SUM(bookings), 0) AS bookings,
        COALESCE(SUM(invoiced), 0) AS invoiced,
        COALESCE(SUM(credited), 0) AS credited,
        COALESCE(SUM(opp_count), 0)::int AS opp_count
      FROM district_opportunity_actuals
      WHERE district_lea_id = ${districtLeaId}
        AND school_yr = ${schoolYr}
    `,
    []
  );

  if (rows.length === 0) return { ...EMPTY_ACTUALS };
  return mapRawToActuals(rows[0]);
}

export interface RepActuals {
  totalRevenue: number;
  totalTake: number;
  completedTake: number;
  scheduledTake: number;
  weightedPipeline: number;
  openPipeline: number;
  bookings: number;
  minPurchaseBookings: number;
  invoiced: number;
}

/**
 * Get rep-scoped aggregated actuals across all districts for a school year.
 * Used by the goals dashboard.
 */
export async function getRepActuals(
  salesRepEmail: string,
  schoolYr: string
): Promise<RepActuals> {
  const rows = await safeQueryRaw(
    prisma.$queryRaw<
      {
        total_revenue: number;
        total_take: number;
        completed_take: number;
        scheduled_take: number;
        weighted_pipeline: number;
        open_pipeline: number;
        bookings: number;
        min_purchase_bookings: number;
        invoiced: number;
      }[]
    >`
      SELECT
        COALESCE(SUM(total_revenue), 0) AS total_revenue,
        COALESCE(SUM(total_take), 0) AS total_take,
        COALESCE(SUM(completed_take), 0) AS completed_take,
        COALESCE(SUM(scheduled_take), 0) AS scheduled_take,
        COALESCE(SUM(weighted_pipeline), 0) AS weighted_pipeline,
        COALESCE(SUM(open_pipeline), 0) AS open_pipeline,
        COALESCE(SUM(bookings), 0) AS bookings,
        COALESCE(SUM(min_purchase_bookings), 0) AS min_purchase_bookings,
        COALESCE(SUM(invoiced), 0) AS invoiced
      FROM district_opportunity_actuals
      WHERE sales_rep_email = ${salesRepEmail}
        AND school_yr = ${schoolYr}
    `,
    []
  );

  if (rows.length === 0) {
    return {
      totalRevenue: 0,
      totalTake: 0,
      completedTake: 0,
      scheduledTake: 0,
      weightedPipeline: 0,
      openPipeline: 0,
      bookings: 0,
      minPurchaseBookings: 0,
      invoiced: 0,
    };
  }

  const row = rows[0];
  return {
    totalRevenue: Number(row.total_revenue),
    totalTake: Number(row.total_take),
    completedTake: Number(row.completed_take),
    scheduledTake: Number(row.scheduled_take),
    weightedPipeline: Number(row.weighted_pipeline),
    openPipeline: Number(row.open_pipeline),
    bookings: Number(row.bookings),
    minPurchaseBookings: Number(row.min_purchase_bookings),
    invoiced: Number(row.invoiced),
  };
}

/**
 * Count districts that have current FY opportunities but no prior FY opportunities.
 * Used for "new districts" actual on the goals dashboard.
 */
export async function getNewDistrictsCount(
  salesRepEmail: string,
  currentSchoolYr: string,
  priorSchoolYr: string
): Promise<number> {
  const rows = await safeQueryRaw(
    prisma.$queryRaw<[{ count: number }]>`
      SELECT COUNT(DISTINCT curr.district_lea_id)::int AS count
      FROM district_opportunity_actuals curr
      WHERE curr.sales_rep_email = ${salesRepEmail}
        AND curr.school_yr = ${currentSchoolYr}
        AND curr.district_lea_id NOT IN (
          SELECT DISTINCT prior.district_lea_id
          FROM district_opportunity_actuals prior
          WHERE prior.sales_rep_email = ${salesRepEmail}
            AND prior.school_yr = ${priorSchoolYr}
        )
    `,
    [{ count: 0 }]
  );
  return rows[0]?.count ?? 0;
}

/**
 * Get leaderboard rank for a rep by total take in a school year.
 * Returns { rank, totalReps } — rank 1 = highest take.
 */
export async function getRepLeaderboardRank(
  salesRepEmail: string,
  schoolYr: string
): Promise<{ rank: number; totalReps: number }> {
  const rows = await safeQueryRaw(
    prisma.$queryRaw<{ rank: number; total_reps: number }[]>`
      WITH rep_totals AS (
        SELECT sales_rep_email, SUM(total_take) AS take
        FROM district_opportunity_actuals
        WHERE school_yr = ${schoolYr}
        GROUP BY sales_rep_email
      ),
      ranked AS (
        SELECT sales_rep_email,
               RANK() OVER (ORDER BY take DESC) AS rank,
               COUNT(*) OVER () AS total_reps
        FROM rep_totals
      )
      SELECT rank::int, total_reps::int
      FROM ranked
      WHERE sales_rep_email = ${salesRepEmail}
    `,
    []
  );

  if (rows.length === 0) return { rank: 0, totalReps: 0 };
  return { rank: Number(rows[0].rank), totalReps: Number(rows[0].total_reps) };
}

export interface OpportunityDetail {
  id: string;
  name: string;
  stage: string;
  netBookingAmount: number;
  totalRevenue: number;
  totalTake: number;
  completedRevenue: number;
  scheduledRevenue: number;
}

/**
 * Get individual opportunities for a district in a specific school year.
 * Queries the raw opportunities table (not the materialized view).
 */
export async function getDistrictOpportunities(
  districtLeaId: string,
  schoolYr: string
): Promise<OpportunityDetail[]> {
  const rows = await safeQueryRaw(
    prisma.$queryRaw<
      {
        id: string;
        name: string;
        stage: string;
        net_booking_amount: number;
        total_revenue: number;
        total_take: number;
        completed_revenue: number;
        scheduled_revenue: number;
      }[]
    >`
      SELECT id, name, stage,
             COALESCE(net_booking_amount, 0) AS net_booking_amount,
             COALESCE(total_revenue, 0) AS total_revenue,
             COALESCE(total_take, 0) AS total_take,
             COALESCE(completed_revenue, 0) AS completed_revenue,
             COALESCE(scheduled_revenue, 0) AS scheduled_revenue
      FROM opportunities
      WHERE district_lea_id = ${districtLeaId}
        AND school_yr = ${schoolYr}
      ORDER BY net_booking_amount DESC
    `,
    []
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    stage: r.stage,
    netBookingAmount: Number(r.net_booking_amount),
    totalRevenue: Number(r.total_revenue),
    totalTake: Number(r.total_take),
    completedRevenue: Number(r.completed_revenue),
    scheduledRevenue: Number(r.scheduled_revenue),
  }));
}

/**
 * Get actuals for a set of districts (used for plan-level rollups and goals dashboard).
 * Returns totals aggregated across all provided district IDs.
 * Optional salesRepEmail scopes to a specific rep (used by goals dashboard).
 */
export async function getPlanDistrictActuals(
  districtLeaIds: string[],
  schoolYr: string,
  salesRepEmail?: string
): Promise<{ totalRevenue: number; totalTake: number; bookings: number }> {
  if (districtLeaIds.length === 0) {
    return { totalRevenue: 0, totalTake: 0, bookings: 0 };
  }

  if (salesRepEmail) {
    const rows = await safeQueryRaw(
      prisma.$queryRaw<
        { total_revenue: number; total_take: number; bookings: number }[]
      >`
        SELECT
          COALESCE(SUM(total_revenue), 0) AS total_revenue,
          COALESCE(SUM(total_take), 0) AS total_take,
          COALESCE(SUM(bookings), 0) AS bookings
        FROM district_opportunity_actuals
        WHERE district_lea_id = ANY(${districtLeaIds})
          AND school_yr = ${schoolYr}
          AND sales_rep_email = ${salesRepEmail}
      `,
      []
    );
    if (rows.length === 0) return { totalRevenue: 0, totalTake: 0, bookings: 0 };
    return {
      totalRevenue: Number(rows[0].total_revenue),
      totalTake: Number(rows[0].total_take),
      bookings: Number(rows[0].bookings),
    };
  }

  const rows = await safeQueryRaw(
    prisma.$queryRaw<
      { total_revenue: number; total_take: number; bookings: number }[]
    >`
      SELECT
        COALESCE(SUM(total_revenue), 0) AS total_revenue,
        COALESCE(SUM(total_take), 0) AS total_take,
        COALESCE(SUM(bookings), 0) AS bookings
      FROM district_opportunity_actuals
      WHERE district_lea_id = ANY(${districtLeaIds})
        AND school_yr = ${schoolYr}
    `,
    []
  );

  if (rows.length === 0) return { totalRevenue: 0, totalTake: 0, bookings: 0 };
  return {
    totalRevenue: Number(rows[0].total_revenue),
    totalTake: Number(rows[0].total_take),
    bookings: Number(rows[0].bookings),
  };
}
