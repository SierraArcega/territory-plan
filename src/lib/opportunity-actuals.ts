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
 * Used by the goals dashboard and leaderboard.
 *
 * totalRevenue = session_revenue (bucketed by session_fy(start_time)) +
 *                sub_revenue (subscriptions only, bucketed by opp.school_yr).
 * All other fields come from district_opportunity_actuals (opp.school_yr semantics).
 *
 * See spec: Docs/superpowers/specs/2026-04-30-leaderboard-fy-attribution-fix-design.md
 */
export async function getRepActuals(
  salesRepEmail: string,
  schoolYr: string
): Promise<RepActuals> {
  // Sessions are bucketed by session.start_time → session_fy() → school_yr.
  // Subscriptions, pipeline, take, bookings, min purchases continue to be
  // bucketed by opp.school_yr per the existing semantics. The two streams
  // share the same `school_yr` arg name but are sourced differently.
  const [sessionRows, subAndOtherRows] = await Promise.all([
    safeQueryRaw(
      prisma.$queryRaw<{ session_revenue: number }[]>`
        SELECT COALESCE(SUM(session_revenue), 0) AS session_revenue
        FROM rep_session_actuals
        WHERE sales_rep_email = ${salesRepEmail}
          AND school_yr = ${schoolYr}
      `,
      [{ session_revenue: 0 }]
    ),
    safeQueryRaw(
      prisma.$queryRaw<
        {
          sub_revenue: number;
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
          COALESCE(SUM(sub_revenue), 0) AS sub_revenue,
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
      [
        {
          sub_revenue: 0,
          total_take: 0,
          completed_take: 0,
          scheduled_take: 0,
          weighted_pipeline: 0,
          open_pipeline: 0,
          bookings: 0,
          min_purchase_bookings: 0,
          invoiced: 0,
        },
      ]
    ),
  ]);

  const sessionRevenue = Number(sessionRows[0]?.session_revenue ?? 0);
  const r = subAndOtherRows[0] ?? {
    sub_revenue: 0,
    total_take: 0,
    completed_take: 0,
    scheduled_take: 0,
    weighted_pipeline: 0,
    open_pipeline: 0,
    bookings: 0,
    min_purchase_bookings: 0,
    invoiced: 0,
  };

  return {
    totalRevenue: sessionRevenue + Number(r.sub_revenue),
    totalTake: Number(r.total_take),
    completedTake: Number(r.completed_take),
    scheduledTake: Number(r.scheduled_take),
    weightedPipeline: Number(r.weighted_pipeline),
    openPipeline: Number(r.open_pipeline),
    bookings: Number(r.bookings),
    minPurchaseBookings: Number(r.min_purchase_bookings),
    invoiced: Number(r.invoiced),
  };
}

const EMPTY_REP_ACTUALS: RepActuals = {
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

/**
 * Batched variant of getRepActuals — fetches actuals for many (email, schoolYr)
 * pairs in 2 round-trips (one per matview) instead of 2-per-pair.
 *
 * Why this exists: the leaderboard endpoint previously called getRepActuals
 * inside Promise.all over reps × years = 30 × 3 = 90 concurrent invocations,
 * each making 2 DB queries → 180 simultaneous connections to the pgbouncer
 * pool (default size 15-25). Tail-end queries time out under load, the
 * caller's per-rep silent catch swallowed the error and returned all-zeros,
 * and a different subset of reps showed $0 on every page load — exactly the
 * symptom that made Melodie/Liz/Paul appear at $0 on 2026-05-02 even though
 * the matview had their data.
 *
 * Returns Map<email, Map<schoolYr, RepActuals>>. Missing combinations are
 * absent from the inner map; callers should treat absence as zeros.
 */
export async function getRepActualsBatch(
  emails: string[],
  schoolYrs: string[],
): Promise<Map<string, Map<string, RepActuals>>> {
  const result = new Map<string, Map<string, RepActuals>>();
  if (emails.length === 0 || schoolYrs.length === 0) return result;

  const [sessionRows, doaRows] = await Promise.all([
    safeQueryRaw(
      prisma.$queryRaw<
        { sales_rep_email: string; school_yr: string; session_revenue: number }[]
      >`
        SELECT sales_rep_email, school_yr,
               COALESCE(SUM(session_revenue), 0) AS session_revenue
        FROM rep_session_actuals
        WHERE sales_rep_email = ANY(${emails})
          AND school_yr = ANY(${schoolYrs})
        GROUP BY sales_rep_email, school_yr
      `,
      [],
    ),
    safeQueryRaw(
      prisma.$queryRaw<
        {
          sales_rep_email: string;
          school_yr: string;
          sub_revenue: number;
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
        SELECT sales_rep_email, school_yr,
               COALESCE(SUM(sub_revenue), 0) AS sub_revenue,
               COALESCE(SUM(total_take), 0) AS total_take,
               COALESCE(SUM(completed_take), 0) AS completed_take,
               COALESCE(SUM(scheduled_take), 0) AS scheduled_take,
               COALESCE(SUM(weighted_pipeline), 0) AS weighted_pipeline,
               COALESCE(SUM(open_pipeline), 0) AS open_pipeline,
               COALESCE(SUM(bookings), 0) AS bookings,
               COALESCE(SUM(min_purchase_bookings), 0) AS min_purchase_bookings,
               COALESCE(SUM(invoiced), 0) AS invoiced
        FROM district_opportunity_actuals
        WHERE sales_rep_email = ANY(${emails})
          AND school_yr = ANY(${schoolYrs})
        GROUP BY sales_rep_email, school_yr
      `,
      [],
    ),
  ]);

  const sessionRevByKey = new Map<string, number>();
  for (const row of sessionRows) {
    sessionRevByKey.set(
      `${row.sales_rep_email}::${row.school_yr}`,
      Number(row.session_revenue),
    );
  }

  const ensure = (email: string): Map<string, RepActuals> => {
    let perRep = result.get(email);
    if (!perRep) {
      perRep = new Map<string, RepActuals>();
      result.set(email, perRep);
    }
    return perRep;
  };

  // DOA rows carry every field except session revenue — start there.
  for (const row of doaRows) {
    const key = `${row.sales_rep_email}::${row.school_yr}`;
    const sessionRev = sessionRevByKey.get(key) ?? 0;
    sessionRevByKey.delete(key); // mark consumed so the leftover pass below sees only sessions-only rows
    ensure(row.sales_rep_email).set(row.school_yr, {
      totalRevenue: sessionRev + Number(row.sub_revenue),
      totalTake: Number(row.total_take),
      completedTake: Number(row.completed_take),
      scheduledTake: Number(row.scheduled_take),
      weightedPipeline: Number(row.weighted_pipeline),
      openPipeline: Number(row.open_pipeline),
      bookings: Number(row.bookings),
      minPurchaseBookings: Number(row.min_purchase_bookings),
      invoiced: Number(row.invoiced),
    });
  }

  // Sessions-only (rep, year) pairs with no DOA row — emit a record carrying
  // just session revenue, all other fields zero.
  for (const [key, sessionRev] of sessionRevByKey.entries()) {
    const [email, schoolYr] = key.split("::");
    ensure(email).set(schoolYr, { ...EMPTY_REP_ACTUALS, totalRevenue: sessionRev });
  }

  return result;
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
