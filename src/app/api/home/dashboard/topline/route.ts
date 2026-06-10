import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { getRepActualsBatch } from "@/lib/opportunity-actuals";
import { getCurrentFY, schoolYearForFY } from "@/lib/fiscal-year";
import { buildToplineCards, type CategoryActuals, type OpenPipelineDetail } from "@/features/home/lib/topline";
import { stagePrefixSql } from "@/features/home/lib/trajectory-source";
import { resolveScope, emailFilterSql } from "@/features/home/lib/scope";

export const dynamic = "force-dynamic";

// GET /api/home/dashboard/topline?fy=2026
// Returns the calling rep's four financial topline cards (value + rank vs all
// active reps) for the requested fiscal year. One batched all-reps fetch; ranks
// are computed in JS. Targets (card 1) is served separately.
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fyParam = searchParams.get("fy");
  const fy = fyParam == null ? getCurrentFY() : Number(fyParam);
  if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) {
    return NextResponse.json({ error: "fy must be a fiscal-year number like 2026" }, { status: 400 });
  }

  const schoolYr = schoolYearForFY(fy);
  const reps = await getActiveReps();
  const repParam = searchParams.get("rep");
  const scope = resolveScope(repParam, reps, { id: user.id, email: user.email ?? "" });
  if (!scope) return NextResponse.json({ error: "unknown rep" }, { status: 400 });
  const subjectId = scope.mode === "rep" ? scope.rep.id : user.id;

  // Rep mode ranks the subject vs the roster (roster actuals). Team mode is the
  // whole book — fetch every email's actuals (null) so the headline sums all of
  // them; ranking still uses the roster subset.
  const actualsByEmail = await getRepActualsBatch(
    scope.mode === "team" ? null : reps.map((r) => r.email),
    [schoolYr],
  );

  // Subject's per-category breakdown for the segment bars (selected rep, or the
  // whole book in team mode).
  const subjectCategories: CategoryActuals[] = await prisma.$queryRaw<CategoryActuals[]>`
      SELECT category,
        COALESCE(SUM(open_pipeline), 0)::float AS "openPipeline",
        COALESCE(SUM(bookings), 0)::float AS "bookings",
        COALESCE(SUM(completed_take + scheduled_take), 0)::float AS "take",
        COALESCE(SUM(completed_revenue + scheduled_revenue), 0)::float AS "revenue"
      FROM district_opportunity_actuals
      WHERE school_yr = ${schoolYr} ${emailFilterSql(scope, Prisma.sql`sales_rep_email`)}
      GROUP BY category
    `;

  // Subject's commit floor (Σ minimum_purchase_amount), budget ceiling
  // (Σ maximum_budget), and opp/account counts for a stage band. Open stages
  // (prefix 0-5) back the Open Pipeline card; closed-won (prefix ≥6) back the
  // Bookings card. Stage bucketing matches the Pipeline tab + trajectory via the
  // shared helper.
  //
  // Per-CONTRACT min/max, deduped like the DOA matview: add-on opps carry the
  // cumulative min/max of the whole contract, so a flat SUM double-counts EK12
  // chains. chain_key strips the " Add-On N" suffix (falling back to the opp id)
  // so we MAX the cumulative value per contract, then SUM across contracts. When a
  // contract has neither a min nor a max but does have a net booking, net stands in
  // for both. Counts stay row-level (deals / distinct accounts in the band).
  const moneyDetail = (stageCond: Prisma.Sql) =>
    prisma.$queryRaw<{ minCommit: number; maxBudget: number; oppCount: number; accountCount: number }[]>`
      WITH won AS (
        SELECT
          o.id,
          o.district_name,
          COALESCE(regexp_replace(o.name, '[\\s_]+Add[-_ ]?On[s]?(\\s*\\d+)?', '', 'gi'), o.id) AS chain_key,
          CASE WHEN o.minimum_purchase_amount IS NULL AND o.maximum_budget IS NULL
               THEN o.net_booking_amount ELSE o.minimum_purchase_amount END AS eff_min,
          CASE WHEN o.minimum_purchase_amount IS NULL AND o.maximum_budget IS NULL
               THEN o.net_booking_amount ELSE o.maximum_budget END AS eff_max
        FROM opportunities o
        WHERE o.school_yr = ${schoolYr}
          ${emailFilterSql(scope, Prisma.sql`o.sales_rep_email`)}
          AND o.net_booking_amount IS NOT NULL
          AND ${stageCond}
      ),
      chains AS (
        SELECT chain_key,
               MAX(COALESCE(eff_min, 0)) AS chain_min,
               MAX(COALESCE(eff_max, 0)) AS chain_max
        FROM won
        GROUP BY chain_key
      )
      SELECT
        COALESCE(SUM(chain_min), 0)::float AS "minCommit",
        COALESCE(SUM(chain_max), 0)::float AS "maxBudget",
        (SELECT COUNT(*) FROM won)::int AS "oppCount",
        (SELECT COUNT(DISTINCT district_name) FROM won)::int AS "accountCount"
      FROM chains
    `;
  const [openDetailRows, bookingsDetailRows] = await Promise.all([
    moneyDetail(Prisma.sql`${stagePrefixSql(Prisma.sql`o.stage`)} BETWEEN 0 AND 5`),
    moneyDetail(Prisma.sql`${stagePrefixSql(Prisma.sql`o.stage`)} >= 6`),
  ]);
  const openPipelineDetail: OpenPipelineDetail | null = openDetailRows[0] ?? null;
  const bookingsDetail: OpenPipelineDetail | null = bookingsDetailRows[0] ?? null;

  const cards = buildToplineCards(reps, actualsByEmail, schoolYr, subjectId, subjectCategories, openPipelineDetail, scope.mode, bookingsDetail);

  return NextResponse.json({ fy, schoolYr, mode: scope.mode, cards });
}
