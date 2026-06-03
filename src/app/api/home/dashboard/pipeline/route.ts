import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { getCurrentFY, schoolYearForFY } from "@/lib/fiscal-year";
import { fetchPipelineData } from "@/features/home/lib/pipeline-source";
import { buildFunnel, buildTargetsRow, buildWonStage, buildCoverage, buildOppViews, TIER_RANK } from "@/features/home/lib/pipeline";

export const dynamic = "force-dynamic";

// GET /api/home/dashboard/pipeline?fy=2026
// The Pipeline tab payload for the calling rep: coverage (floor/ceiling/most-likely
// + gap-to-target), the stage funnel (per-stage min/max + team share, source shares,
// pre-pipe targets), the top open opps, and the at-risk subset (stalled / slipped).
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
  const inRoster = reps.some((r) => r.id === user.id);
  const callerEmail = reps.find((r) => r.id === user.id)?.email ?? user.email ?? "";

  const { openOpps, wonBookings, fyTarget, thisWeek, targetsByRep, wonByRep, benchmarks } = await fetchPipelineData(schoolYr, fy, callerEmail);

  const funnel = {
    ...buildFunnel(openOpps, reps, user.id, "all"),
    targets: buildTargetsRow(targetsByRep, callerEmail),
    won: buildWonStage(wonByRep, callerEmail),
  };
  const callerOpps = openOpps.filter((o) => o.email === callerEmail);
  const coverage = buildCoverage(callerOpps, wonBookings, fyTarget);
  const views = buildOppViews(callerOpps, benchmarks);
  const opps = views.slice(0, 50); // paginate the displayed table per CLAUDE.md
  // At risk = any non-on-track tier OR an overdue close date, worst tier first, then by weighted $.
  const atRisk = views
    .filter((o) => o.tier !== "on" || o.overdue)
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.weighted - a.weighted);

  return NextResponse.json({
    fy,
    schoolYr,
    inRoster,
    coverage: { ...coverage, wonBookings, fyTarget },
    funnel,
    opps,
    atRisk,
    // "This week" (last 7 days), scoped to the selected FY's school year. Shown in
    // every FY tab; non-current years just tend to be empty.
    thisWeek,
  });
}
