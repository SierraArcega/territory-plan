// Source-row fetching for the rank-trajectory route. Returns one dated-value list
// per metric, which the pure assembler (rank-trajectory.ts) turns into the chart
// payload. SQL-heavy and DB-bound, so verified live (temp diagnostics + :3020),
// not unit-tested — the orchestration around it is covered in the route test and
// the bucketing/ranking math is covered in monthly.test.ts.
//
// Date basis per metric (locked with the user 2026-05-29):
//   openPipeline → open opps (stage prefix 0–5) by created_at, net_booking_amount
//   bookings     → closed-won opps (prefix ≥6) by close_date, net_booking_amount
//   revenue      → session_price by session.start_time  +  subscription net_total
//                  by the parent opp's close_date (so subscription-only EK12 reps
//                  rank fairly)
//   take         → session_price × DOA avg_take_rate by start_time (excludes subs)
//   targets      → territory_plan_districts by added_at, split into the 4 target
//                  columns (renewal/new_business/winback/expansion)
// Segment category comes from DOA (constant per district+school_yr); take's rate
// is the per-(district,rep) DOA avg_take_rate. Both are approximations documented
// in the Phase 3 spec.

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { DatedValueRow } from "./monthly";
import type { TrajectoryMetricKey } from "./rank-trajectory";

// `category` constant per district+school_yr, read straight off the matview.
const categoryJoin = (sy: string) => Prisma.sql`
  LEFT JOIN (
    SELECT DISTINCT district_lea_id, category
    FROM district_opportunity_actuals
    WHERE school_yr = ${sy}
  ) c ON c.district_lea_id = o.district_lea_id`;

interface OppRow {
  email: string;
  createdAt: Date | null;
  closeDate: Date | null;
  value: number;
  category: string | null;
  stagePrefix: number | null;
}

interface SessionRow {
  email: string;
  startTime: Date | null;
  revenue: number;
  take: number;
  category: string | null;
}

interface SubRow {
  email: string;
  closeDate: Date | null;
  value: number;
  category: string | null;
}

interface TargetRow {
  email: string;
  addedAt: Date;
  renewal: number;
  new_business: number;
  winback: number;
  expansion: number;
}

export async function fetchTrajectoryRows(
  sy: string,
  fy: number,
): Promise<Record<TrajectoryMetricKey, DatedValueRow[]>> {
  const [opps, sessions, subs, targets] = await Promise.all([
    // Opps once; split into open-pipeline / bookings in JS by the same stage
    // bucketing the DOA matview uses (numeric prefix 0–5 open, ≥6 closed-won).
    prisma.$queryRaw<OppRow[]>`
      SELECT o.sales_rep_email AS email,
             o.created_at AS "createdAt",
             o.close_date AS "closeDate",
             o.net_booking_amount::float AS value,
             c.category,
             CASE
               WHEN o.stage ~ '^[0-9]' THEN (regexp_match(o.stage, '^([0-9]+)'))[1]::int
               WHEN LOWER(o.stage) IN ('closed won','active','position purchased',
                 'requisition received','return position pending') THEN 6
               WHEN LOWER(o.stage) = 'closed lost' THEN -1
               ELSE NULL
             END AS "stagePrefix"
      FROM opportunities o
      ${categoryJoin(sy)}
      WHERE o.school_yr = ${sy} AND o.net_booking_amount IS NOT NULL`,

    prisma.$queryRaw<SessionRow[]>`
      SELECT o.sales_rep_email AS email,
             s.start_time AS "startTime",
             s.session_price::float AS revenue,
             (s.session_price * COALESCE(d.avg_take_rate, 0))::float AS take,
             c.category
      FROM sessions s
      JOIN opportunities o ON o.id = s.opportunity_id
      ${categoryJoin(sy)}
      LEFT JOIN (
        SELECT district_lea_id, sales_rep_email, MAX(avg_take_rate) AS avg_take_rate
        FROM district_opportunity_actuals WHERE school_yr = ${sy}
        GROUP BY district_lea_id, sales_rep_email
      ) d ON d.district_lea_id = o.district_lea_id AND d.sales_rep_email = o.sales_rep_email
      WHERE session_fy(s.start_time) = ${sy}
        AND s.status NOT IN ('cancelled','canceled')
        AND s.session_price IS NOT NULL`,

    prisma.$queryRaw<SubRow[]>`
      SELECT o.sales_rep_email AS email,
             o.close_date AS "closeDate",
             sub.net_total::float AS value,
             c.category
      FROM subscriptions sub
      JOIN opportunities o ON o.id = sub.opportunity_id
      ${categoryJoin(sy)}
      WHERE o.school_yr = ${sy} AND sub.net_total IS NOT NULL AND o.close_date IS NOT NULL`,

    prisma.$queryRaw<TargetRow[]>`
      SELECT u.email AS email,
             tpd.added_at AS "addedAt",
             COALESCE(tpd.renewal_target, 0)::float AS renewal,
             COALESCE(tpd.new_business_target, 0)::float AS new_business,
             COALESCE(tpd.winback_target, 0)::float AS winback,
             COALESCE(tpd.expansion_target, 0)::float AS expansion
      FROM territory_plan_districts tpd
      JOIN territory_plans p ON p.id = tpd.plan_id
      JOIN user_profiles u ON u.id = COALESCE(p.owner_id, p.user_id)
      WHERE p.fiscal_year = ${fy}`,
  ]);

  const openPipeline: DatedValueRow[] = [];
  const bookings: DatedValueRow[] = [];
  for (const o of opps) {
    if (o.stagePrefix == null || o.stagePrefix < 0) continue; // closed-lost / unknown
    if (o.stagePrefix >= 6) {
      if (o.closeDate) bookings.push({ email: o.email, date: o.closeDate, value: o.value, category: o.category ?? undefined });
    } else if (o.createdAt) {
      openPipeline.push({ email: o.email, date: o.createdAt, value: o.value, category: o.category ?? undefined });
    }
  }

  const revenue: DatedValueRow[] = [];
  const take: DatedValueRow[] = [];
  for (const s of sessions) {
    if (!s.startTime) continue;
    revenue.push({ email: s.email, date: s.startTime, value: s.revenue, category: s.category ?? undefined });
    take.push({ email: s.email, date: s.startTime, value: s.take, category: s.category ?? undefined });
  }
  for (const sub of subs) {
    if (sub.closeDate) revenue.push({ email: sub.email, date: sub.closeDate, value: sub.value, category: sub.category ?? undefined });
  }

  // Each plan-district contributes one row per non-zero target column, tagged with
  // the DOA category so the trajectory's segment filter lines up with the others.
  const TARGET_CATEGORIES: [keyof Omit<TargetRow, "email" | "addedAt">, string][] = [
    ["renewal", "renewal"],
    ["new_business", "new_business"],
    ["winback", "winback"],
    ["expansion", "expansion"],
  ];
  const targetRows: DatedValueRow[] = [];
  for (const t of targets) {
    for (const [col, category] of TARGET_CATEGORIES) {
      if (t[col] > 0) targetRows.push({ email: t.email, date: t.addedAt, value: t[col], category });
    }
  }

  return { targets: targetRows, openPipeline, bookings, revenue, take };
}
