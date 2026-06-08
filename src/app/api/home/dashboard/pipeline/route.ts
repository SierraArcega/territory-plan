import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { getCurrentFY, schoolYearForFY } from "@/lib/fiscal-year";
import { fetchPipelineData } from "@/features/home/lib/pipeline-source";
import {
  buildFunnel,
  buildFunnelTeam,
  buildTargetsRow,
  buildTargetsRowTeam,
  buildWonStage,
  buildWonStageTeam,
  buildCoverage,
  buildOppViews,
  TIER_RANK,
} from "@/features/home/lib/pipeline";
import { resolveScope, emailInScope } from "@/features/home/lib/scope";

export const dynamic = "force-dynamic";

// GET /api/home/dashboard/pipeline?fy=2026&rep=<id|team>
// The Pipeline tab payload for the requested rep or team aggregate: coverage
// (floor/ceiling/most-likely + gap-to-target), the stage funnel (per-stage
// min/max + team share, source shares, pre-pipe targets), the top open opps,
// and the at-risk subset (stalled / slipped).
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
  const scope = resolveScope(searchParams.get("rep"), reps, { id: user.id, email: user.email ?? "" });
  if (!scope) return NextResponse.json({ error: "unknown rep" }, { status: 400 });

  const { openOpps, wonBookings, fyTarget, thisWeek, targetsByRep, wonByRep, benchmarks } = await fetchPipelineData(
    schoolYr,
    fy,
    scope,
  );

  // Team = the whole book (every open opp); rep = the subject's open opps.
  const subjectOpps = openOpps.filter((o) => emailInScope(scope, o.email));
  const funnel =
    scope.mode === "team"
      ? {
          ...buildFunnelTeam(openOpps, "all"),
          targets: buildTargetsRowTeam(targetsByRep),
          won: buildWonStageTeam(wonByRep),
        }
      : {
          ...buildFunnel(openOpps, reps, scope.rep.id, "all"),
          targets: buildTargetsRow(targetsByRep, scope.rep.email),
          won: buildWonStage(wonByRep, scope.rep.email),
        };

  const coverage = buildCoverage(subjectOpps, wonBookings, fyTarget);
  // The full scoped book (weighted-sorted). The funnel drill-in needs every deal so
  // its modal count matches the funnel headline; the Top-opps table caps its own
  // render at 50 (CLAUDE.md: never RENDER >50). atRisk keeps its own cap below.
  const views = buildOppViews(subjectOpps, benchmarks);
  const opps = views;
  // At risk = any non-on-track tier OR an overdue close date, worst tier first, then by weighted $.
  // Capped at 50 (most-urgent first) — the team-mode book can be large (CLAUDE.md: never render >50).
  const atRisk = views
    .filter((o) => o.tier !== "on" || o.overdue)
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.weighted - a.weighted)
    .slice(0, 50);
  const inRoster = scope.mode === "team" ? true : reps.some((r) => r.id === scope.rep.id);

  return NextResponse.json({
    fy,
    schoolYr,
    mode: scope.mode,
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
