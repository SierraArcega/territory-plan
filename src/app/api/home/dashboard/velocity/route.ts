import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { getCurrentFY, schoolYearForFY } from "@/lib/fiscal-year";
import { buildVelocity, buildVelocityTeam, type RepVelocityAgg } from "@/features/home/lib/velocity";
import { fetchVelocity } from "@/features/home/lib/velocity-source";
import { resolveScope } from "@/features/home/lib/scope";

export const dynamic = "force-dynamic";

// GET /api/home/dashboard/velocity?fy=2026&rep=<id|team>
// The Velocity card: four ranked metrics (close rate, avg deal size, gross margin,
// deals won) for the calling rep (default) or the full team. Per-rep: ranked vs
// the team with prior-FY deltas + team median. Team: pool raw aggregates and
// recompute rates over the pool — never average per-rep rates.
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
  const priorSchoolYr = schoolYearForFY(fy - 1);
  const reps = await getActiveReps();

  const scope = resolveScope(searchParams.get("rep"), reps, { id: user.id, email: user.email ?? "" });
  if (!scope) return NextResponse.json({ error: "unknown rep" }, { status: 400 });

  const { current, priorCaller, priorRows } = await fetchVelocity(schoolYr, priorSchoolYr, scope.emails);
  const currentByEmail = new Map<string, RepVelocityAgg>(
    current.map((r) => [r.email, { wonCount: r.wonCount, closedCount: r.closedCount, wonBookingSum: r.wonBookingSum, takeSum: r.takeSum, revSum: r.revSum }]),
  );

  let cells;
  if (scope.mode === "team") {
    // `current` is fetched unfiltered (every email in the data, incl. former reps);
    // pool only the active roster so team rates match the topline/roster basis.
    const rosterEmails = new Set(scope.emails);
    const teamRows = current.filter((r) => rosterEmails.has(r.email));
    const sum = (pick: (a: RepVelocityAgg) => number) => teamRows.reduce((s, r) => s + pick(r), 0);
    const pooled: RepVelocityAgg = {
      wonCount: sum((a) => a.wonCount),
      closedCount: sum((a) => a.closedCount),
      wonBookingSum: sum((a) => a.wonBookingSum),
      takeSum: sum((a) => a.takeSum),
      revSum: sum((a) => a.revSum),
    };
    const priorPooled: RepVelocityAgg | null = priorRows.length
      ? {
          wonCount: priorRows.reduce((s, r) => s + r.wonCount, 0),
          closedCount: priorRows.reduce((s, r) => s + r.closedCount, 0),
          wonBookingSum: priorRows.reduce((s, r) => s + r.wonBookingSum, 0),
          takeSum: priorRows.reduce((s, r) => s + r.takeSum, 0),
          revSum: priorRows.reduce((s, r) => s + r.revSum, 0),
        }
      : null;
    cells = buildVelocityTeam(pooled, priorPooled);
  } else {
    const priorAgg: RepVelocityAgg | null = priorCaller
      ? { wonCount: priorCaller.wonCount, closedCount: priorCaller.closedCount, wonBookingSum: priorCaller.wonBookingSum, takeSum: priorCaller.takeSum, revSum: priorCaller.revSum }
      : null;
    cells = buildVelocity(reps, currentByEmail, priorAgg, scope.rep.id);
  }
  return NextResponse.json({ fy, schoolYr, mode: scope.mode, cells });
}
