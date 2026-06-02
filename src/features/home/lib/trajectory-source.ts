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

// Stage→bucket prefix (mirrors the DOA matview): numeric prefix 0–5 = open
// pipeline, ≥6 = closed-won, closed-lost = -1, else NULL. Shared by the opp
// trajectory query and the snapshot WoW query so the bucketing never drifts.
export function stagePrefixSql(stage: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`CASE
    WHEN ${stage} ~ '^[0-9]' THEN (regexp_match(${stage}, '^([0-9]+)'))[1]::int
    WHEN LOWER(${stage}) IN ('closed won','active','position purchased',
      'requisition received','return position pending') THEN 6
    WHEN LOWER(${stage}) = 'closed lost' THEN -1
    ELSE NULL
  END`;
}

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
  email?: string,
): Promise<Record<TrajectoryMetricKey, DatedValueRow[]>> {
  // Optional rep scoping — the trajectory needs every rep (for ranking), but the
  // caller-only sparklines pass an email to avoid fetching the whole team's rows.
  const oppEmail = email ? Prisma.sql`AND o.sales_rep_email = ${email}` : Prisma.empty;
  const tgtEmail = email ? Prisma.sql`AND u.email = ${email}` : Prisma.empty;

  const [opps, sessions, subs, targets] = await Promise.all([
    // Opps once; split into open-pipeline / bookings in JS by the same stage
    // bucketing the DOA matview uses (numeric prefix 0–5 open, ≥6 closed-won).
    prisma.$queryRaw<OppRow[]>`
      SELECT o.sales_rep_email AS email,
             o.created_at AS "createdAt",
             o.close_date AS "closeDate",
             o.net_booking_amount::float AS value,
             c.category,
             ${stagePrefixSql(Prisma.sql`o.stage`)} AS "stagePrefix"
      FROM opportunities o
      ${categoryJoin(sy)}
      WHERE o.school_yr = ${sy} AND o.net_booking_amount IS NOT NULL ${oppEmail}`,

    // Scan DOA once (MATERIALIZED) and derive both the category (district-grain)
    // and avg_take_rate (district+rep) joins from it, instead of two DOA reads.
    prisma.$queryRaw<SessionRow[]>`
      WITH doa_sy AS MATERIALIZED (
        SELECT district_lea_id, sales_rep_email, category, avg_take_rate
        FROM district_opportunity_actuals WHERE school_yr = ${sy}
      )
      SELECT o.sales_rep_email AS email,
             s.start_time AS "startTime",
             s.session_price::float AS revenue,
             (s.session_price * COALESCE(d.avg_take_rate, 0))::float AS take,
             c.category
      FROM sessions s
      JOIN opportunities o ON o.id = s.opportunity_id
      LEFT JOIN (SELECT DISTINCT district_lea_id, category FROM doa_sy) c
        ON c.district_lea_id = o.district_lea_id
      LEFT JOIN (
        SELECT district_lea_id, sales_rep_email, MAX(avg_take_rate) AS avg_take_rate
        FROM doa_sy GROUP BY district_lea_id, sales_rep_email
      ) d ON d.district_lea_id = o.district_lea_id AND d.sales_rep_email = o.sales_rep_email
      WHERE session_fy(s.start_time) = ${sy}
        AND s.status NOT IN ('cancelled','canceled')
        AND s.session_price IS NOT NULL ${oppEmail}`,

    prisma.$queryRaw<SubRow[]>`
      SELECT o.sales_rep_email AS email,
             o.close_date AS "closeDate",
             sub.net_total::float AS value,
             c.category
      FROM subscriptions sub
      JOIN opportunities o ON o.id = sub.opportunity_id
      ${categoryJoin(sy)}
      WHERE o.school_yr = ${sy} AND sub.net_total IS NOT NULL AND o.close_date IS NOT NULL ${oppEmail}`,

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
      WHERE p.fiscal_year = ${fy} ${tgtEmail}`,
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

import type { WowSnapshotRow } from "./wow";

// The caller's Open-Pipeline and Bookings totals on the two snapshot dates that
// power the "last 7d" WoW delta: the rep's OWN latest snapshot and their latest
// one at least 7 days earlier. Anchoring on the rep's own dates (not a global
// MAX) keeps WoW robust when a rep has no row on the team-wide latest snapshot
// day. Snapshots key by sales_rep_id = user_profiles.id (== user.id).
export async function fetchWowSnapshots(salesRepId: string, sy: string): Promise<WowSnapshotRow[]> {
  return prisma.$queryRaw<WowSnapshotRow[]>`
    WITH rep_snaps AS (
      SELECT snapshot_date, net_booking_amount, ${stagePrefixSql(Prisma.sql`stage`)} AS sp
      FROM opportunity_snapshots
      WHERE sales_rep_id = ${salesRepId}::uuid AND school_yr = ${sy}
    ),
    anchors AS (
      SELECT MAX(snapshot_date) AS latest FROM rep_snaps
    )
    SELECT snapshot_date::text AS date,
           COALESCE(SUM(CASE WHEN sp BETWEEN 0 AND 5 THEN net_booking_amount END), 0)::float AS "openPipeline",
           COALESCE(SUM(CASE WHEN sp >= 6 THEN net_booking_amount END), 0)::float AS "bookings"
    FROM rep_snaps, anchors
    WHERE snapshot_date IN (
      anchors.latest,
      (SELECT MAX(snapshot_date) FROM rep_snaps WHERE snapshot_date <= anchors.latest - 7)
    )
    GROUP BY snapshot_date`;
}
