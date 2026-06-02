// Source-row fetching for the Pipeline tab. Returns the team's open opportunities
// (with days-in-stage + is_stale derived from the stage_history JSON), the caller's
// won bookings, and the caller's FY target. SQL-heavy / DB-bound, so verified live
// (temp diagnostics + :3020), not unit-tested — the pure aggregation it feeds is
// covered in pipeline.test.ts. Reuses stagePrefixSql so open/closed bucketing
// matches the trajectory + DOA.

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { stagePrefixSql } from "./trajectory-source";
import type { OpenOppRow } from "./pipeline";

export interface PipelineOpp extends OpenOppRow {
  account: string | null;
  state: string | null;
  closeDate: Date | null;
}

export interface PipelineData {
  openOpps: PipelineOpp[]; // all reps (for stage-health ranking); caller-filtered downstream
  wonBookings: number; // caller's closed-won bookings this FY (for gap-to-target)
  fyTarget: number; // caller's Σ plan-district targets this FY
}

export async function fetchPipelineData(sy: string, fy: number, callerEmail: string): Promise<PipelineData> {
  const [openOpps, won, target] = await Promise.all([
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
               GREATEST(0, EXTRACT(EPOCH FROM (now() - (last.elem ->> 'changed_at')::timestamptz)) / 86400)::float AS "daysInStage",
               (o.close_date IS NOT NULL AND o.close_date < now()) AS "overdueClose",
               c.category
        FROM opportunities o
        LEFT JOIN LATERAL (
          SELECT o.stage_history -> (jsonb_array_length(o.stage_history) - 1) AS elem
          WHERE jsonb_typeof(o.stage_history) = 'array' AND jsonb_array_length(o.stage_history) > 0
        ) last ON true
        LEFT JOIN (
          SELECT DISTINCT district_lea_id, category
          FROM district_opportunity_actuals WHERE school_yr = ${sy}
        ) c ON c.district_lea_id = o.district_lea_id
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
  ]);

  return {
    openOpps,
    wonBookings: won[0]?.won ?? 0,
    fyTarget: target[0]?.target ?? 0,
  };
}
