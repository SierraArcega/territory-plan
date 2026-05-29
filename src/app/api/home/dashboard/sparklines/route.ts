import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getCurrentFY, schoolYearForFY } from "@/lib/fiscal-year";
import { fetchTrajectoryRows, fetchWowSnapshots } from "@/features/home/lib/trajectory-source";
import { buildSparklines } from "@/features/home/lib/sparkline";
import { buildWowDeltas, type WowDeltas } from "@/features/home/lib/wow";

export const dynamic = "force-dynamic";

// GET /api/home/dashboard/sparklines?fy=2026
// Returns the calling rep's cumulative monthly series (current + prior FY) and a
// YoY same-point delta for each metric — powering the topline cards' sparklines.
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
  const email = user.email ?? "";

  const [currentRows, priorRows] = await Promise.all([
    fetchTrajectoryRows(schoolYr, fy, email),
    fetchTrajectoryRows(schoolYearForFY(fy - 1), fy - 1, email),
  ]);

  const sparklines = buildSparklines({ currentRows, priorRows, email, fy });

  // "Last 7d" WoW delta is only meaningful for the in-progress FY (snapshots are
  // ~6 weeks deep) and only for the two snapshot-backed metrics.
  let wow: WowDeltas = { openPipeline: null, bookings: null };
  if (fy === getCurrentFY()) {
    wow = buildWowDeltas(await fetchWowSnapshots(user.id, schoolYr));
  }

  return NextResponse.json({ fy, schoolYr, sparklines, wow });
}
