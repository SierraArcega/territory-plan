import prisma from "@/lib/prisma";
import { getRepActuals } from "@/lib/opportunity-actuals";
import { getUnmatchedCountsByRep } from "@/lib/unmatched-counts";
import type { LeaderboardEntry } from "@/features/leaderboard/lib/types";

export interface LeaderboardTeamTotals {
  revenue: number;
  revenueCurrentFY: number;
  revenuePriorFY: number;
  unassignedRevenue: number;
  unassignedRevenueCurrentFY: number;
  unassignedRevenuePriorFY: number;
  priorYearRevenue: number;
  minPurchasesCurrentFY: number;
  minPurchasesPriorFY: number;
  unassignedPriorYearRevenue: number;
  unassignedMinPurchasesCurrentFY: number;
  unassignedMinPurchasesPriorFY: number;
  pipelineCurrentFY: number;
  pipelineNextFY: number;
  unassignedPipelineCurrentFY: number;
  unassignedPipelineNextFY: number;
  targetedCurrentFY: number;
  targetedNextFY: number;
  unassignedTargetedCurrentFY: number;
  unassignedTargetedNextFY: number;
}

export interface LeaderboardPayload {
  fiscalYears: { currentFY: string; nextFY: string; priorFY: string };
  entries: LeaderboardEntry[];
  teamTotals: LeaderboardTeamTotals;
}

export async function fetchLeaderboardData(): Promise<LeaderboardPayload> {
  const profiles = await prisma.userProfile.findMany({
    where: { role: { in: ["rep", "manager", "admin"] } },
    select: { id: true, fullName: true, avatarUrl: true, email: true, role: true },
  });

  const now = new Date();
  const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  const defaultSchoolYr = `${currentFY - 1}-${String(currentFY).slice(-2)}`;
  const priorFY = currentFY - 1;
  const priorSchoolYr = `${priorFY - 1}-${String(priorFY).slice(-2)}`;
  const nextFYSchoolYr = `${currentFY}-${String(currentFY + 1).slice(-2)}`;

  const uniqueYears = [...new Set([priorSchoolYr, defaultSchoolYr, nextFYSchoolYr])];

  const repActuals = await Promise.all(
    profiles.map(async (profile) => {
      const email = profile.email;
      try {
        const yearActuals = new Map<string, Awaited<ReturnType<typeof getRepActuals>>>();
        await Promise.all(
          uniqueYears.map(async (yr) => {
            const actuals = await getRepActuals(email, yr);
            yearActuals.set(yr, actuals);
          }),
        );
        return {
          userId: profile.id,
          pipeline: yearActuals.get(defaultSchoolYr)?.openPipeline ?? 0,
          pipelineCurrentFY: yearActuals.get(defaultSchoolYr)?.openPipeline ?? 0,
          pipelineNextFY: yearActuals.get(nextFYSchoolYr)?.openPipeline ?? 0,
          take: yearActuals.get(defaultSchoolYr)?.totalTake ?? 0,
          revenue: yearActuals.get(defaultSchoolYr)?.totalRevenue ?? 0,
          revenueCurrentFY: yearActuals.get(defaultSchoolYr)?.totalRevenue ?? 0,
          revenuePriorFY: yearActuals.get(priorSchoolYr)?.totalRevenue ?? 0,
          priorYearRevenue: yearActuals.get(priorSchoolYr)?.minPurchaseBookings ?? 0,
          minPurchasesCurrentFY: yearActuals.get(defaultSchoolYr)?.minPurchaseBookings ?? 0,
          minPurchasesPriorFY: yearActuals.get(priorSchoolYr)?.minPurchaseBookings ?? 0,
        };
      } catch {
        return {
          userId: profile.id,
          take: 0, pipeline: 0, pipelineCurrentFY: 0, pipelineNextFY: 0,
          revenue: 0, revenueCurrentFY: 0, revenuePriorFY: 0,
          priorYearRevenue: 0, minPurchasesCurrentFY: 0, minPurchasesPriorFY: 0,
        };
      }
    }),
  );

  const adminUserIds = new Set(profiles.filter((p) => p.role === "admin").map((p) => p.id));
  const rosterProfiles = profiles.filter((p) => !adminUserIds.has(p.id));
  const userIds = profiles.map((p) => p.id);
  const actualsMap = new Map(repActuals.map((a) => [a.userId, a]));

  const currentFYInt = currentFY;
  const nextFYInt = currentFY + 1;
  const ownerFilter = {
    OR: [{ ownerId: { in: userIds } }, { userId: { in: userIds }, ownerId: null }],
  };

  const emailByUserId = new Map<string, string>();
  for (const p of profiles) emailByUserId.set(p.id, p.email);
  const rosterEmails = [...emailByUserId.values()];

  const [targetedCurrentFYDistricts, targetedNextFYDistricts, pipelineRows, unmatchedByRep] = await Promise.all([
    prisma.territoryPlanDistrict.findMany({
      where: { plan: { ...ownerFilter, fiscalYear: currentFYInt } },
      select: {
        districtLeaid: true,
        renewalTarget: true, winbackTarget: true, expansionTarget: true, newBusinessTarget: true,
        plan: { select: { ownerId: true, userId: true } },
      },
    }),
    prisma.territoryPlanDistrict.findMany({
      where: { plan: { ...ownerFilter, fiscalYear: nextFYInt } },
      select: {
        districtLeaid: true,
        renewalTarget: true, winbackTarget: true, expansionTarget: true, newBusinessTarget: true,
        plan: { select: { ownerId: true, userId: true } },
      },
    }),
    rosterEmails.length === 0
      ? Promise.resolve([])
      : prisma.$queryRaw<{ sales_rep_email: string; district_lea_id: string; school_yr: string; pipeline: number }[]>`
          SELECT sales_rep_email, district_lea_id, school_yr,
                 SUM(open_pipeline)::float AS pipeline
          FROM district_opportunity_actuals
          WHERE sales_rep_email = ANY(${rosterEmails})
            AND school_yr IN (${defaultSchoolYr}, ${nextFYSchoolYr})
            AND district_lea_id != '_NOMAP'
          GROUP BY sales_rep_email, district_lea_id, school_yr
          HAVING SUM(open_pipeline) > 0
        `,
    getUnmatchedCountsByRep(rosterEmails),
  ]);

  const repPipelineMap = new Map<string, number>();
  for (const row of pipelineRows) {
    repPipelineMap.set(`${row.sales_rep_email}::${row.district_lea_id}::${row.school_yr}`, Number(row.pipeline));
  }

  function sumTargetsWithPipelineDeduction(
    districts: typeof targetedCurrentFYDistricts,
    schoolYr: string,
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const d of districts) {
      const uid = d.plan.ownerId ?? d.plan.userId;
      if (!uid) continue;
      const target = Number(d.renewalTarget ?? 0) + Number(d.winbackTarget ?? 0) +
                     Number(d.expansionTarget ?? 0) + Number(d.newBusinessTarget ?? 0);
      if (target <= 0) continue;
      const email = emailByUserId.get(uid);
      const pipeline = email ? repPipelineMap.get(`${email}::${d.districtLeaid}::${schoolYr}`) ?? 0 : 0;
      map.set(uid, (map.get(uid) ?? 0) + Math.max(0, target - pipeline));
    }
    return map;
  }

  const targetedCurrentFYByUser = sumTargetsWithPipelineDeduction(targetedCurrentFYDistricts, defaultSchoolYr);
  const targetedNextFYByUser = sumTargetsWithPipelineDeduction(targetedNextFYDistricts, nextFYSchoolYr);

  const entries: LeaderboardEntry[] = rosterProfiles.map((profile) => {
    const a = actualsMap.get(profile.id) ?? {
      userId: profile.id, take: 0, pipeline: 0, pipelineCurrentFY: 0, pipelineNextFY: 0,
      revenue: 0, revenueCurrentFY: 0, revenuePriorFY: 0,
      priorYearRevenue: 0, minPurchasesCurrentFY: 0, minPurchasesPriorFY: 0,
    };
    const targetedCurrentFY = targetedCurrentFYByUser.get(profile.id) ?? 0;
    const targetedNextFY = targetedNextFYByUser.get(profile.id) ?? 0;
    const unmatched = unmatchedByRep.get(profile.email) ?? { count: 0, revenue: 0 };
    return {
      userId: profile.id,
      fullName: profile.fullName ?? "Unknown",
      avatarUrl: profile.avatarUrl,
      rank: 0,
      take: a.take,
      pipeline: a.pipeline,
      pipelineCurrentFY: a.pipelineCurrentFY,
      pipelineNextFY: a.pipelineNextFY,
      revenue: a.revenue,
      revenueCurrentFY: a.revenueCurrentFY,
      revenuePriorFY: a.revenuePriorFY,
      priorYearRevenue: a.priorYearRevenue,
      minPurchasesCurrentFY: a.minPurchasesCurrentFY,
      minPurchasesPriorFY: a.minPurchasesPriorFY,
      revenueTargeted: targetedCurrentFY + targetedNextFY,
      targetedCurrentFY,
      targetedNextFY,
      unmatchedOppCount: unmatched.count,
      unmatchedRevenue: unmatched.revenue,
    };
  });

  entries.sort((a, b) => b.revenueCurrentFY - a.revenueCurrentFY);
  entries.forEach((e, i) => { e.rank = i + 1; });

  const sumActuals = (
    pool: typeof repActuals,
    key:
      | "revenue" | "revenueCurrentFY" | "revenuePriorFY"
      | "priorYearRevenue" | "minPurchasesCurrentFY" | "minPurchasesPriorFY"
      | "pipelineCurrentFY" | "pipelineNextFY",
  ): number => pool.reduce((acc, x) => acc + (x[key] ?? 0), 0);

  const sumTargetedMap = (pool: Map<string, number>, ids: Iterable<string>): number => {
    let total = 0;
    for (const id of ids) total += pool.get(id) ?? 0;
    return total;
  };

  const adminActuals = repActuals.filter((a) => adminUserIds.has(a.userId));

  const teamTotals: LeaderboardTeamTotals = {
    revenue: sumActuals(repActuals, "revenue"),
    revenueCurrentFY: sumActuals(repActuals, "revenueCurrentFY"),
    revenuePriorFY: sumActuals(repActuals, "revenuePriorFY"),
    unassignedRevenue: sumActuals(adminActuals, "revenue"),
    unassignedRevenueCurrentFY: sumActuals(adminActuals, "revenueCurrentFY"),
    unassignedRevenuePriorFY: sumActuals(adminActuals, "revenuePriorFY"),
    priorYearRevenue: sumActuals(repActuals, "priorYearRevenue"),
    minPurchasesCurrentFY: sumActuals(repActuals, "minPurchasesCurrentFY"),
    minPurchasesPriorFY: sumActuals(repActuals, "minPurchasesPriorFY"),
    unassignedPriorYearRevenue: sumActuals(adminActuals, "priorYearRevenue"),
    unassignedMinPurchasesCurrentFY: sumActuals(adminActuals, "minPurchasesCurrentFY"),
    unassignedMinPurchasesPriorFY: sumActuals(adminActuals, "minPurchasesPriorFY"),
    pipelineCurrentFY: sumActuals(repActuals, "pipelineCurrentFY"),
    pipelineNextFY: sumActuals(repActuals, "pipelineNextFY"),
    unassignedPipelineCurrentFY: sumActuals(adminActuals, "pipelineCurrentFY"),
    unassignedPipelineNextFY: sumActuals(adminActuals, "pipelineNextFY"),
    targetedCurrentFY: sumTargetedMap(targetedCurrentFYByUser, userIds),
    targetedNextFY: sumTargetedMap(targetedNextFYByUser, userIds),
    unassignedTargetedCurrentFY: sumTargetedMap(targetedCurrentFYByUser, adminUserIds),
    unassignedTargetedNextFY: sumTargetedMap(targetedNextFYByUser, adminUserIds),
  };

  return {
    fiscalYears: { currentFY: defaultSchoolYr, nextFY: nextFYSchoolYr, priorFY: priorSchoolYr },
    entries,
    teamTotals,
  };
}
