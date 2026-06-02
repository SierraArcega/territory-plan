import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { getRepActualsBatch } from "@/lib/opportunity-actuals";
import { getCurrentFY, schoolYearForFY } from "@/lib/fiscal-year";
import { buildToplineCards, type CategoryActuals, type OpenPipelineDetail } from "@/features/home/lib/topline";
import { stagePrefixSql } from "@/features/home/lib/trajectory-source";

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
  const callerEmail = reps.find((r) => r.id === user.id)?.email ?? null;

  const actualsByEmail = await getRepActualsBatch(reps.map((r) => r.email), [schoolYr]);

  // Caller-only per-category breakdown for the segment bars.
  const callerCategories: CategoryActuals[] = callerEmail
    ? await prisma.$queryRaw<CategoryActuals[]>`
        SELECT category,
          COALESCE(SUM(open_pipeline), 0)::float AS "openPipeline",
          COALESCE(SUM(bookings), 0)::float AS "bookings",
          COALESCE(SUM(completed_take + scheduled_take), 0)::float AS "take",
          COALESCE(SUM(completed_revenue + scheduled_revenue), 0)::float AS "revenue"
        FROM district_opportunity_actuals
        WHERE sales_rep_email = ${callerEmail} AND school_yr = ${schoolYr}
        GROUP BY category
      `
    : [];

  // Caller's open-pipeline detail: commit floor (Σ minimum_purchase_amount),
  // budget ceiling (Σ maximum_budget), and opp/account counts. Open stages
  // (prefix 0-5) match the Pipeline tab + trajectory via the shared helper.
  const detailRows = callerEmail
    ? await prisma.$queryRaw<{ minCommit: number; maxBudget: number; oppCount: number; accountCount: number }[]>`
        SELECT
          COALESCE(SUM(COALESCE(o.minimum_purchase_amount, 0)), 0)::float AS "minCommit",
          COALESCE(SUM(COALESCE(o.maximum_budget, 0)), 0)::float AS "maxBudget",
          COUNT(*)::int AS "oppCount",
          COUNT(DISTINCT o.district_name)::int AS "accountCount"
        FROM opportunities o
        WHERE o.sales_rep_email = ${callerEmail}
          AND o.school_yr = ${schoolYr}
          AND o.net_booking_amount IS NOT NULL
          AND ${stagePrefixSql(Prisma.sql`o.stage`)} BETWEEN 0 AND 5
      `
    : [];
  const openPipelineDetail: OpenPipelineDetail | null = detailRows[0] ?? null;

  const cards = buildToplineCards(reps, actualsByEmail, schoolYr, user.id, callerCategories, openPipelineDetail);

  return NextResponse.json({ fy, schoolYr, cards });
}
