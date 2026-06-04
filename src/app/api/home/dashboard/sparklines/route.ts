import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getCurrentFY, schoolYearForFY } from "@/lib/fiscal-year";
import { fetchTrajectoryRows, fetchWowSnapshots } from "@/features/home/lib/trajectory-source";
import { buildSparklines } from "@/features/home/lib/sparkline";
import { buildWowDeltas, type WowDeltas, type WowSnapshotRow } from "@/features/home/lib/wow";
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
  // ~6 weeks deep) and only for the two snapshot-backed metrics.
  //
  // buildWowDeltas picks the two most-recent rows by date and diffs them. It does
  // NOT sum multiple reps. For team mode we pre-aggregate: group all reps' snapshot
  // rows by date, sum openPipeline + bookings per date, then call buildWowDeltas on
  // the aggregated rows (2 rows → latest and ~7-days-prior, each summed across the team).
  let wow: WowDeltas = { openPipeline: null, bookings: null };
  if (fy === getCurrentFY()) {
    if (scope.mode === "team") {
      const allSnaps = (await Promise.all(reps.map((r) => fetchWowSnapshots(r.id, schoolYr)))).flat();
      // Sum per date across all reps.
      const byDate = new Map<string, WowSnapshotRow>();
      for (const snap of allSnaps) {
        const existing = byDate.get(snap.date);
        if (existing) {
          existing.openPipeline += snap.openPipeline;
          existing.bookings += snap.bookings;
        } else {
          byDate.set(snap.date, { date: snap.date, openPipeline: snap.openPipeline, bookings: snap.bookings });
        }
      }
      wow = buildWowDeltas([...byDate.values()]);
    } else {
      wow = buildWowDeltas(await fetchWowSnapshots(scope.rep.id, schoolYr));
    }
  }

  return NextResponse.json({ fy, schoolYr, mode: scope.mode, sparklines, wow });
}
