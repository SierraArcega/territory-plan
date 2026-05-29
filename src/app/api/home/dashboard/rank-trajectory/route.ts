import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { getCurrentFY, schoolYearForFY } from "@/lib/fiscal-year";
import { fetchTrajectoryRows } from "@/features/home/lib/trajectory-source";
import { buildRankTrajectoryPayload } from "@/features/home/lib/rank-trajectory";

export const dynamic = "force-dynamic";

// GET /api/home/dashboard/rank-trajectory?fy=2026
// Returns the calling rep's monthly rank trajectory (13 FY columns) for each of
// the five metrics, plus all reps' series for the modal team breakdown and
// per-segment sub-series. Monthly values are derived from dated source rows; see
// trajectory-source.ts for the per-metric date basis.
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
  const rowsByMetric = await fetchTrajectoryRows(schoolYr, fy);

  const payload = buildRankTrajectoryPayload({ rowsByMetric, fy, reps, callerId: user.id });
  return NextResponse.json(payload);
}
