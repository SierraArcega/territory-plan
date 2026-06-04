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

  // Subject's open-pipeline detail: commit floor (Σ minimum_purchase_amount),
  // budget ceiling (Σ maximum_budget), and opp/account counts. Open stages
  // (prefix 0-5) match the Pipeline tab + trajectory via the shared helper.
  const detailRows = await prisma.$queryRaw<{ minCommit: number; maxBudget: number; oppCount: number; accountCount: number }[]>`
      SELECT
        COALESCE(SUM(COALESCE(o.minimum_purchase_amount, 0)), 0)::float AS "minCommit",
        COALESCE(SUM(COALESCE(o.maximum_budget, 0)), 0)::float AS "maxBudget",
        COUNT(*)::int AS "oppCount",
        COUNT(DISTINCT o.district_name)::int AS "accountCount"
      FROM opportunities o
      WHERE o.school_yr = ${schoolYr}
        ${emailFilterSql(scope, Prisma.sql`o.sales_rep_email`)}
        AND o.net_booking_amount IS NOT NULL
        AND ${stagePrefixSql(Prisma.sql`o.stage`)} BETWEEN 0 AND 5
    `;
  const openPipelineDetail: OpenPipelineDetail | null = detailRows[0] ?? null;

  const cards = buildToplineCards(reps, actualsByEmail, schoolYr, subjectId, subjectCategories, openPipelineDetail, scope.mode);

  return NextResponse.json({ fy, schoolYr, mode: scope.mode, cards });
}
