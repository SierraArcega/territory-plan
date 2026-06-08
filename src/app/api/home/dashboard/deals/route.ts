import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { getCurrentFY, schoolYearForFY } from "@/lib/fiscal-year";
import { resolveScope } from "@/features/home/lib/scope";
import { fetchPipelineDeals, fetchBookingDeals, fetchUtilizationSource, fetchTargetDetail } from "@/features/home/lib/deals-source";
import { buildUtilizationRows, buildTargetDetailRows, buildDealTotals, type DealMetric } from "@/features/home/lib/deals";

export const dynamic = "force-dynamic";

const METRICS: DealMetric[] = ["pipeline", "bookings", "rev", "take", "targets"];

// GET /api/home/dashboard/deals?fy=2026&metric=pipeline|bookings|rev|take|targets&rep=<id|team>
// Backs the topline cards' drill-in modals: the scope's deal/utilization rows for
// one metric, plus a totals footer. Scope mirrors the card it opened from — rep =
// the subject's email; team = the whole book (every non-null sales_rep_email).
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fyParam = searchParams.get("fy");
  const fy = fyParam == null ? getCurrentFY() : Number(fyParam);
  if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) {
    return NextResponse.json({ error: "fy must be a fiscal-year number like 2026" }, { status: 400 });
  }

  const metric = searchParams.get("metric") as DealMetric | null;
  if (!metric || !METRICS.includes(metric)) {
    return NextResponse.json({ error: "metric must be one of pipeline, bookings, rev, take, targets" }, { status: 400 });
  }

  const schoolYr = schoolYearForFY(fy);
  const reps = await getActiveReps();
  const scope = resolveScope(searchParams.get("rep"), reps, { id: user.id, email: user.email ?? "" });
  if (!scope) return NextResponse.json({ error: "unknown rep" }, { status: 400 });

  if (metric === "pipeline") {
    const rows = await fetchPipelineDeals(schoolYr, scope);
    return NextResponse.json({ fy, schoolYr, mode: scope.mode, metric, rows, totals: buildDealTotals(metric, rows) });
  }
  if (metric === "bookings") {
    const rows = await fetchBookingDeals(schoolYr, scope);
    return NextResponse.json({ fy, schoolYr, mode: scope.mode, metric, rows, totals: buildDealTotals(metric, rows) });
  }
  if (metric === "targets") {
    // Worked districts come from plan ownership, not sales_rep_email, so this path
    // also needs the caller (team activity attribution / admin-self plans).
    const rows = buildTargetDetailRows(await fetchTargetDetail(fy, scope, user.id));
    return NextResponse.json({ fy, schoolYr, mode: scope.mode, metric, rows, totals: buildDealTotals(metric, rows) });
  }

  // rev | take — same per-account utilization rows; the modal emphasizes the
  // relevant money column.
  const { won, doa } = await fetchUtilizationSource(schoolYr, scope);
  const rows = buildUtilizationRows(won, doa);
  return NextResponse.json({ fy, schoolYr, mode: scope.mode, metric, rows, totals: buildDealTotals(metric, rows) });
}
