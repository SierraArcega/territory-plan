import { NextResponse } from "next/server";
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
  const repIds = reps.map((r) => r.id);
  const callerEmail = reps.find((r) => r.id === user.id)?.email ?? null;

  // Always include the caller's own plans even if they aren't in the rep roster
  // (e.g. an admin/manager viewing their own dashboard) so their worked count shows.
  const ownerIds = Array.from(new Set([...repIds, user.id]));

  const planDistrictRows = await prisma.territoryPlanDistrict.findMany({
    where: {
      plan: {
        OR: [{ ownerId: { in: ownerIds } }, { userId: { in: ownerIds }, ownerId: null }],
        fiscalYear: fy,
      },
    },
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
  const standing = rankForRep(ranking, user.id);

  const callerRollup = rollups.get(user.id) ?? {
    workedCount: 0,
    untargetedCount: 0,
    targetDollars: 0,
    segments: { new: 0, winback: 0, expansion: 0 },
  };
  const workedLeaids = workedLeaidsForRep(rows, user.id);

  // Caller-only sub-counts over the worked-district set.
  let convertedToPipeline = 0;
  let active90 = 0;
  if (workedLeaids.length > 0) {
    if (callerEmail) {
      const convertedRows = await prisma.$queryRaw<{ district_lea_id: string }[]>`
        SELECT district_lea_id
        FROM district_opportunity_actuals
        WHERE sales_rep_email = ${callerEmail}
          AND school_yr = ${schoolYr}
          AND district_lea_id = ANY(${workedLeaids})
        GROUP BY district_lea_id
        HAVING SUM(open_pipeline) > 0
      `;
      convertedToPipeline = convertedRows.length;
    }

    const activeRows = await prisma.activityDistrict.findMany({
      where: {
        districtLeaid: { in: workedLeaids },
        activity: { createdByUserId: user.id, startDate: { gte: new Date(Date.now() - NINETY_DAYS_MS) } },
      },
      select: { districtLeaid: true },
      distinct: ["districtLeaid"],
    });
    active90 = activeRows.length;
  }

  return NextResponse.json({
    fy,
    schoolYr,
    card: {
      metricKey: "targets",
      label: "Targets",
      value: callerRollup.workedCount,
      rank: standing.rank,
      totalReps: ranking.totalReps,
      inRoster: standing.inRoster,
      segments: callerRollup.segments,
      untargeted: callerRollup.untargetedCount,
      convertedToPipeline,
      active90,
      stale: callerRollup.workedCount - active90,
    },
  });
}
