// Source-row fetching for the Pipeline tab. Returns the team's open opportunities
// (with days-in-stage + is_stale derived from the stage_history JSON), the caller's
// won bookings, and the caller's FY target. SQL-heavy / DB-bound, so verified live
// (temp diagnostics + :3020), not unit-tested — the pure aggregation it feeds is
// covered in pipeline.test.ts. Reuses stagePrefixSql so open/closed bucketing
// matches the trajectory + DOA.

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { stagePrefixSql, categoryJoin } from "./trajectory-source";
import type { PipelineOpp, TargetRepAgg } from "./pipeline";

export interface ThisWeek {
  won: number; // caller's deals closed-won in the last 7 days
  lost: number; // closed-lost
  created: number; // opps created
}

export interface PipelineData {
  openOpps: PipelineOpp[]; // all reps (for stage-health ranking); caller-filtered downstream
  wonBookings: number; // caller's closed-won bookings this FY (for gap-to-target)
  fyTarget: number; // caller's Σ plan-district targets this FY
  thisWeek: ThisWeek;
  targetsByRep: TargetRepAgg[]; // per-rep pre-pipe targets (no open opp) for the funnel Targets row
}

export async function fetchPipelineData(sy: string, fy: number, callerEmail: string): Promise<PipelineData> {
  const [openOpps, won, target, week, targetsByRep] = await Promise.all([
    // Open opps (stage prefix 0-5) for every rep. days_in_stage = time since the
    // opp entered its current stage (the most recent stage_history entry's
    // changed_at; verified to match the live stage). overdue = a close date
    // already in the past while still open. (stage_history's is_stale flag is
    // unusable — it's true for every open opp.)
    prisma.$queryRaw<PipelineOpp[]>`
      SELECT * FROM (
        SELECT o.sales_rep_email AS email,
               o.district_name AS account,
               o.state,
               o.net_booking_amount::float AS "netBooking",
               COALESCE(o.minimum_purchase_amount, 0)::float AS "minPurchase",
               COALESCE(o.maximum_budget, 0)::float AS "maxBudget",
               o.close_date AS "closeDate",
               ${stagePrefixSql(Prisma.sql`o.stage`)} AS "stagePrefix",
               GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE((last.elem ->> 'changed_at')::timestamptz, o.created_at))) / 86400)::float AS "daysInStage",
               (o.close_date IS NOT NULL AND o.close_date < now()) AS "overdueClose",
               c.category
        FROM opportunities o
        -- Most recent stage entry by changed_at (not positional order), so a
        -- backfilled/out-of-order stage_history still gives the right age; falls
        -- back to created_at when there's no history.
        LEFT JOIN LATERAL (
          SELECT elem
          FROM jsonb_array_elements(o.stage_history) elem
          WHERE jsonb_typeof(o.stage_history) = 'array'
          ORDER BY (elem ->> 'changed_at')::timestamptz DESC NULLS LAST
          LIMIT 1
        ) last ON true
        ${categoryJoin(sy)}
        WHERE o.school_yr = ${sy} AND o.net_booking_amount IS NOT NULL
      ) t
      WHERE t."stagePrefix" BETWEEN 0 AND 5`,

    prisma.$queryRaw<{ won: number }[]>`
      SELECT COALESCE(SUM(o.net_booking_amount), 0)::float AS won
      FROM opportunities o
      WHERE o.school_yr = ${sy} AND o.sales_rep_email = ${callerEmail}
        AND ${stagePrefixSql(Prisma.sql`o.stage`)} >= 6`,

    prisma.$queryRaw<{ target: number }[]>`
      SELECT COALESCE(SUM(
        COALESCE(tpd.renewal_target, 0) + COALESCE(tpd.new_business_target, 0) +
        COALESCE(tpd.winback_target, 0) + COALESCE(tpd.expansion_target, 0)
      ), 0)::float AS target
      FROM territory_plan_districts tpd
      JOIN territory_plans p ON p.id = tpd.plan_id
      JOIN user_profiles u ON u.id = COALESCE(p.owner_id, p.user_id)
      WHERE p.fiscal_year = ${fy} AND u.email = ${callerEmail}`,

    // Caller's last-7-days movement: won / lost (by close_date) and newly created.
    prisma.$queryRaw<{ won: number; lost: number; created: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE ${stagePrefixSql(Prisma.sql`o.stage`)} >= 6 AND o.close_date >= now() - interval '7 days')::int AS won,
        COUNT(*) FILTER (WHERE LOWER(o.stage) = 'closed lost' AND o.close_date >= now() - interval '7 days')::int AS lost,
        COUNT(*) FILTER (WHERE o.created_at >= now() - interval '7 days')::int AS created
      FROM opportunities o
      WHERE o.school_yr = ${sy} AND o.sales_rep_email = ${callerEmail}`,

    // Per-rep pre-pipe targets: plan districts (this FY) that HAVE a target set and
    // have NO open opp for that rep. value = Σ all four target columns (estimated
    // target revenue). Aggregated per rep so buildTargetsRow can pick caller + sum team.
    prisma.$queryRaw<TargetRepAgg[]>`
      SELECT u.email AS email,
             COUNT(*)::int AS count,
             COALESCE(SUM(
               COALESCE(tpd.renewal_target, 0) + COALESCE(tpd.new_business_target, 0) +
               COALESCE(tpd.winback_target, 0) + COALESCE(tpd.expansion_target, 0)
             ), 0)::float AS value
      FROM territory_plan_districts tpd
      JOIN territory_plans p ON p.id = tpd.plan_id
      JOIN user_profiles u ON u.id = COALESCE(p.owner_id, p.user_id)
      WHERE p.fiscal_year = ${fy}
        AND (
          COALESCE(tpd.renewal_target, 0) + COALESCE(tpd.new_business_target, 0) +
          COALESCE(tpd.winback_target, 0) + COALESCE(tpd.expansion_target, 0)
        ) > 0
        AND NOT EXISTS (
          SELECT 1 FROM opportunities o
          WHERE o.district_lea_id = tpd.district_leaid
            AND o.sales_rep_email = u.email
            AND o.school_yr = ${sy}
            AND ${stagePrefixSql(Prisma.sql`o.stage`)} BETWEEN 0 AND 5
        )
      GROUP BY u.email`,
  ]);

  return {
    openOpps,
    wonBookings: won[0]?.won ?? 0,
    fyTarget: target[0]?.target ?? 0,
    thisWeek: { won: week[0]?.won ?? 0, lost: week[0]?.lost ?? 0, created: week[0]?.created ?? 0 },
    targetsByRep,
  };
}
