import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getCurrentFY, schoolYearForFY } from "@/lib/fiscal-year";
import { fetchTrajectoryRows, fetchWowSnapshots, fetchWowSnapshotsTeam } from "@/features/home/lib/trajectory-source";
import { buildSparklines } from "@/features/home/lib/sparkline";
import { buildWowDeltas, type WowDeltas } from "@/features/home/lib/wow";
import { getActiveReps } from "@/lib/reps";
import { resolveScope } from "@/features/home/lib/scope";

export const dynamic = "force-dynamic";

// GET /api/home/dashboard/sparklines?fy=2026[&rep=<id>|team]
// Returns the subject's cumulative monthly series (current + prior FY) and a
// YoY same-point delta for each metric — powering the topline cards' sparklines.
// rep=<id> → that rep's data; rep=team → team aggregate; absent → the caller.
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
  if (!scope) return NextResponse.json({ error: "Unknown rep id" }, { status: 400 });

  const schoolYr = schoolYearForFY(fy);
  const subjectEmail = scope.mode === "rep" ? scope.rep.email : undefined;

  const [currentRows, priorRows] = await Promise.all([
    fetchTrajectoryRows(schoolYr, fy, subjectEmail),
    fetchTrajectoryRows(schoolYearForFY(fy - 1), fy - 1, subjectEmail),
  ]);

  const sparklines = buildSparklines({
    currentRows,
    priorRows,
    email: subjectEmail ?? "",
    fy,
    scope: scope.mode,
  });

  // "Last 7d" WoW delta is only meaningful for the in-progress FY (snapshots are
  // ~6 weeks deep) and only for the two snapshot-backed metrics. Team = the whole
  // book (one aggregate query across every rep); rep = the subject's own snapshots.
  let wow: WowDeltas = { openPipeline: null, bookings: null };
  if (fy === getCurrentFY()) {
    const snaps =
      scope.mode === "team"
        ? await fetchWowSnapshotsTeam(schoolYr)
        : await fetchWowSnapshots(scope.rep.id, schoolYr);
    wow = buildWowDeltas(snaps);
  }

  return NextResponse.json({ fy, schoolYr, mode: scope.mode, sparklines, wow });
}
