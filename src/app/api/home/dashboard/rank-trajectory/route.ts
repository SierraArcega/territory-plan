import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { getCurrentFY, schoolYearForFY } from "@/lib/fiscal-year";
import { fetchTrajectoryRows } from "@/features/home/lib/trajectory-source";
import { buildRankTrajectoryPayload } from "@/features/home/lib/rank-trajectory";
import { resolveScope } from "@/features/home/lib/scope";

export const dynamic = "force-dynamic";

// GET /api/home/dashboard/rank-trajectory?fy=2026&rep=<id|team>
// Returns the subject rep's monthly rank trajectory (13 FY columns) for each of
// the five metrics, plus all reps' series for the modal team breakdown and
// per-segment sub-series. Monthly values are derived from dated source rows; see
// trajectory-source.ts for the per-metric date basis.
// Team mode short-circuits with mode:"team" + empty series — the client hides
// this card when scope is team.
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fyParam = searchParams.get("fy");
  const fy = fyParam == null ? getCurrentFY() : Number(fyParam);
  if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) {
    return NextResponse.json({ error: "fy must be a fiscal-year number like 2026" }, { status: 400 });
  }

  const reps = await getActiveReps();

  const scope = resolveScope(searchParams.get("rep"), reps, { id: user.id, email: user.email ?? "" });
  if (!scope) return NextResponse.json({ error: "unknown rep" }, { status: 400 });
  if (scope.mode === "team") {
    return NextResponse.json({ mode: "team", series: [] });
  }

  const schoolYr = schoolYearForFY(fy);
  const rowsByMetric = await fetchTrajectoryRows(schoolYr, fy);

  const payload = buildRankTrajectoryPayload({ rowsByMetric, fy, reps, callerId: scope.rep.id });
  return NextResponse.json({ ...payload, mode: "rep" });
}
