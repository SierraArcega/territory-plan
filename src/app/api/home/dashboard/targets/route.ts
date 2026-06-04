import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { getCurrentFY, schoolYearForFY } from "@/lib/fiscal-year";
import { rankReps, rankForRep } from "@/features/home/lib/ranking";
import {
  buildTargetsRollups,
  workedLeaidsForRep,
  type PlanDistrictTargets,
} from "@/features/home/lib/targets";
import { resolveScope, emailFilterSql } from "@/features/home/lib/scope";

export const dynamic = "force-dynamic";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// GET /api/home/dashboard/targets?fy=2026
// The Targets card: count of districts being worked (plan membership, renewal-only
// excluded), split New/Win-back/Expansion, ranked vs all active reps by total
// target $. Plus the caller's "converted to pipeline" (has open pipeline) and
// "active · 90d" (a logged activity in the last 90 days) sub-counts.
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

  const repParam = searchParams.get("rep");
  const scope = resolveScope(repParam, reps, { id: user.id, email: user.email ?? "" });
  if (!scope) return NextResponse.json({ error: "unknown rep" }, { status: 400 });
  const subjectId = scope.mode === "rep" ? scope.rep.id : user.id;

  // Always include the caller's own plans even if they aren't in the rep roster
  // (e.g. an admin/manager viewing their own dashboard) so their worked count shows.
  const repIds = reps.map((r) => r.id);
  const ownerIds = Array.from(new Set([...repIds, user.id]));

  // Team = the whole book: every plan owner this FY. Rep = the subject's plans
  // (plus the caller's own when an admin views themselves).
  const planWhere =
    scope.mode === "team"
      ? { fiscalYear: fy }
      : {
          OR: [{ ownerId: { in: ownerIds } }, { userId: { in: ownerIds }, ownerId: null }],
          fiscalYear: fy,
        };

  const planDistrictRows = await prisma.territoryPlanDistrict.findMany({
    where: { plan: planWhere },
    select: {
      districtLeaid: true,
      renewalTarget: true,
      winbackTarget: true,
      expansionTarget: true,
      newBusinessTarget: true,
      plan: { select: { ownerId: true, userId: true } },
    },
  });

  const rows: PlanDistrictTargets[] = planDistrictRows
    .map((r) => {
      const repId = r.plan.ownerId ?? r.plan.userId;
      if (!repId) return null;
      return {
        repId,
        leaid: r.districtLeaid,
        newBusinessTarget: Number(r.newBusinessTarget ?? 0),
        winbackTarget: Number(r.winbackTarget ?? 0),
        expansionTarget: Number(r.expansionTarget ?? 0),
        renewalTarget: Number(r.renewalTarget ?? 0),
      };
    })
    .filter((r): r is PlanDistrictTargets => r !== null);

  const rollups = buildTargetsRollups(rows);

  // Rank vs team by total target $ committed.
  const ranking = rankReps(
    reps.map((r) => ({ id: r.id, email: r.email, value: rollups.get(r.id)?.targetDollars ?? 0 })),
  );

  let workedCount: number;
  let untargeted: number;
  let targetTotal: number;
  let segments: { new: number; winback: number; expansion: number };
  let workedLeaids: string[];
  let rank: number | null;
  let inRoster: boolean;

  if (scope.mode === "team") {
    // Team = the whole book: every plan owner's rollup (not just the role='rep'
    // roster). The "N reps" rank basis stays the roster, but the totals cover all.
    const all = Array.from(rollups.values());
    workedCount = all.reduce((s, r) => s + r.workedCount, 0);
    untargeted = all.reduce((s, r) => s + r.untargetedCount, 0);
    targetTotal = all.reduce((s, r) => s + r.targetDollarsAll, 0);
    segments = {
      new: all.reduce((s, r) => s + r.segments.new, 0),
      winback: all.reduce((s, r) => s + r.segments.winback, 0),
      expansion: all.reduce((s, r) => s + r.segments.expansion, 0),
    };
    workedLeaids = rows.map((r) => r.leaid); // every owner's worked districts
    rank = null;
    inRoster = true;
  } else {
    const subjectRollup = rollups.get(subjectId) ?? {
      workedCount: 0,
      untargetedCount: 0,
      targetDollars: 0,
      targetDollarsAll: 0,
      segments: { new: 0, winback: 0, expansion: 0 },
    };
    const standing = rankForRep(ranking, subjectId);
    workedCount = subjectRollup.workedCount;
    untargeted = subjectRollup.untargetedCount;
    targetTotal = subjectRollup.targetDollarsAll;
    segments = subjectRollup.segments;
    workedLeaids = workedLeaidsForRep(rows, subjectId);
    rank = standing.rank;
    inRoster = standing.inRoster;
  }

  // Sub-count rollups over the worked-district set: how many have open pipeline
  // ("converted"), and the total open + closed-won $ on those same accounts (the
  // pipeline side of the targeted-vs-pipeline bar). One pass over the scope's DOA.
  let convertedToPipeline = 0;
  let pipelineOnAccounts = 0;
  let active90 = 0;
  if (workedLeaids.length > 0) {
    const pipeRows = await prisma.$queryRaw<{ convertedCount: number; pipelineOnAccounts: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE open_pipe > 0)::int AS "convertedCount",
        COALESCE(SUM(open_pipe + won), 0)::float AS "pipelineOnAccounts"
      FROM (
        SELECT district_lea_id,
               SUM(open_pipeline) AS open_pipe,
               SUM(bookings) AS won
        FROM district_opportunity_actuals
        WHERE school_yr = ${schoolYr}
          ${emailFilterSql(scope, Prisma.sql`sales_rep_email`)}
          AND district_lea_id = ANY(${workedLeaids})
        GROUP BY district_lea_id
      ) t
    `;
    convertedToPipeline = pipeRows[0]?.convertedCount ?? 0;
    pipelineOnAccounts = pipeRows[0]?.pipelineOnAccounts ?? 0;

    // Team = the whole book: a logged activity by ANY plan owner counts. Rep =
    // the subject only.
    const activityUserIds =
      scope.mode === "team"
        ? Array.from(new Set([...rows.map((r) => r.repId), user.id]))
        : [subjectId];
    const activeRows = await prisma.activityDistrict.findMany({
      where: {
        districtLeaid: { in: workedLeaids },
        activity: {
          createdByUserId: { in: activityUserIds },
          startDate: { gte: new Date(Date.now() - NINETY_DAYS_MS) },
        },
      },
      select: { districtLeaid: true },
      distinct: ["districtLeaid"],
    });
    active90 = activeRows.length;
  }

  return NextResponse.json({
    fy,
    schoolYr,
    mode: scope.mode,
    card: {
      metricKey: "targets",
      label: "Targets",
      value: workedCount,
      rank,
      totalReps: ranking.totalReps,
      inRoster,
      segments,
      untargeted,
      convertedToPipeline,
      active90,
      stale: workedCount - active90,
      // Targeted-vs-pipeline bar: all-four target $ vs open + closed-won $ on the
      // same worked accounts.
      targetTotal,
      pipelineOnAccounts,
    },
  });
}
