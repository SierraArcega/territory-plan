// Source-row fetching for the Velocity card. Per-rep current-FY aggregates
// (won/lost counts + won booking sum from opportunities, joined to DOA take/rev)
// for every rep, plus the caller's prior-FY aggregate for the deltas. SQL-bound, so
// verified live (temp diagnostic + :3020); the pure builder it feeds is unit-tested.
// Reuses stagePrefixSql so closed-won (6) / closed-lost (-1) bucketing matches the
// rest of the dashboard.

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { stagePrefixSql } from "./trajectory-source";
import type { RepVelocityAgg } from "./velocity";

export interface RepVelocityRow extends RepVelocityAgg {
  email: string;
}

// Merged per-(rep,FY) aggregate. opportunities give won/closed counts + won
// booking sum; DOA gives take/rev. FULL OUTER JOIN so a rep present in only one
// source still appears. `emailFilter` scopes to one rep (prior-FY caller) or all.
function aggSql(sy: string, emailFilter: Prisma.Sql) {
  return Prisma.sql`
    SELECT COALESCE(o.email, d.email) AS email,
           COALESCE(o."wonCount", 0)::int AS "wonCount",
           COALESCE(o."closedCount", 0)::int AS "closedCount",
           COALESCE(o."wonBookingSum", 0)::float AS "wonBookingSum",
           COALESCE(d."takeSum", 0)::float AS "takeSum",
           COALESCE(d."revSum", 0)::float AS "revSum"
    FROM (
      SELECT sales_rep_email AS email,
             COUNT(*) FILTER (WHERE sp = 6) AS "wonCount",
             COUNT(*) FILTER (WHERE sp IN (6, -1)) AS "closedCount",
             COALESCE(SUM(net_booking_amount) FILTER (WHERE sp = 6), 0) AS "wonBookingSum"
      FROM (
        SELECT sales_rep_email, net_booking_amount,
               ${stagePrefixSql(Prisma.sql`stage`)} AS sp
        FROM opportunities
        WHERE school_yr = ${sy} ${emailFilter}
      ) x
      GROUP BY sales_rep_email
    ) o
    FULL OUTER JOIN (
      SELECT sales_rep_email AS email,
             SUM(completed_take + scheduled_take) AS "takeSum",
             SUM(completed_revenue + scheduled_revenue) AS "revSum"
      FROM district_opportunity_actuals
      WHERE school_yr = ${sy} ${emailFilter}
      GROUP BY sales_rep_email
    ) d ON d.email = o.email`;
}

export interface VelocityData {
  current: RepVelocityRow[];
  priorCaller: RepVelocityRow | null;
  priorRows: RepVelocityRow[];
}

export async function fetchVelocity(
  sy: string,
  priorSy: string,
  priorEmails: string[],
): Promise<VelocityData> {
  const current = await prisma.$queryRaw<RepVelocityRow[]>(aggSql(sy, Prisma.empty));
  const priorRows =
    priorEmails.length > 0
      ? await prisma.$queryRaw<RepVelocityRow[]>(aggSql(priorSy, Prisma.sql`AND sales_rep_email = ANY(${priorEmails})`))
      : [];
  return { current, priorCaller: priorRows[0] ?? null, priorRows };
}
