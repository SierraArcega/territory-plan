import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { calculateTier, calculateCombinedScore } from "@/features/leaderboard/lib/scoring";
import { getRepActuals } from "@/lib/opportunity-actuals";

export const dynamic = "force-dynamic";

// GET /api/leaderboard — full leaderboard for active initiative
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    const initiative = await prisma.initiative.findFirst({
      where: { isActive: true },
      include: {
        thresholds: true,
        metrics: true,
      },
    });

    if (!initiative) {
      return NextResponse.json({ error: "No active initiative" }, { status: 404 });
    }

    // Get all scores for this initiative with user profiles
    const scores = await prisma.initiativeScore.findMany({
      where: { initiativeId: initiative.id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { totalPoints: "desc" },
    });

    // Determine per-metric school years, falling back to current FY
    const now = new Date();
    const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    const defaultSchoolYr = `${currentFY - 1}-${String(currentFY).slice(-2)}`;
    const priorFY = currentFY - 1;
    const priorSchoolYr = `${priorFY - 1}-${String(priorFY).slice(-2)}`;

    const nextFYSchoolYr = `${currentFY}-${String(currentFY + 1).slice(-2)}`;

    const pipelineSchoolYr = initiative.pipelineFiscalYear ?? defaultSchoolYr;
    const takeSchoolYr = initiative.takeFiscalYear ?? defaultSchoolYr;
    const revenueSchoolYr = initiative.revenueFiscalYear ?? defaultSchoolYr;

    // Always fetch current + next FY for pipeline (Revenue Overview needs both)
    const uniqueYears = [...new Set([pipelineSchoolYr, takeSchoolYr, revenueSchoolYr, priorSchoolYr, defaultSchoolYr, nextFYSchoolYr])];

    const repActuals = await Promise.all(
      scores.map(async (score) => {
        const email = score.user.email;
        try {
          // Fetch actuals for each unique school year needed
          const yearActuals = new Map<string, Awaited<ReturnType<typeof getRepActuals>>>();
          await Promise.all(
            uniqueYears.map(async (yr) => {
              const actuals = await getRepActuals(email, yr);
              yearActuals.set(yr, actuals);
            })
          );

          return {
            userId: score.userId,
            pipeline: yearActuals.get(pipelineSchoolYr)?.openPipeline ?? 0,
            pipelineCurrentFY: yearActuals.get(defaultSchoolYr)?.openPipeline ?? 0,
            pipelineNextFY: yearActuals.get(nextFYSchoolYr)?.openPipeline ?? 0,
            take: yearActuals.get(takeSchoolYr)?.totalTake ?? 0,
            // Revenue: current is used for scoring; per-FY values let the client toggle.
            revenue: yearActuals.get(revenueSchoolYr)?.totalRevenue ?? 0,
            revenueCurrentFY: yearActuals.get(defaultSchoolYr)?.totalRevenue ?? 0,
            revenuePriorFY: yearActuals.get(priorSchoolYr)?.totalRevenue ?? 0,
            // Min purchases: prior is the historical "bookings floor"; per-FY lets the
            // client toggle between current/prior/both. `priorYearRevenue` is kept as
            // a backward-compat alias for `minPurchasesPriorFY` (same value).
            priorYearRevenue: yearActuals.get(priorSchoolYr)?.minPurchaseBookings ?? 0,
            minPurchasesCurrentFY: yearActuals.get(defaultSchoolYr)?.minPurchaseBookings ?? 0,
            minPurchasesPriorFY: yearActuals.get(priorSchoolYr)?.minPurchaseBookings ?? 0,
          };
        } catch {
          return {
            userId: score.userId,
            take: 0,
            pipeline: 0,
            pipelineCurrentFY: 0,
            pipelineNextFY: 0,
            revenue: 0,
            revenueCurrentFY: 0,
            revenuePriorFY: 0,
            priorYearRevenue: 0,
            minPurchasesCurrentFY: 0,
            minPurchasesPriorFY: 0,
          };
        }
      })
    );

    const actualsMap = new Map(repActuals.map((a) => [a.userId, a]));

    // Partition by role: admins are excluded from the visible roster
    // and from max-value normalization, but their actuals still feed
    // the team-wide totals.
    const adminUserIds = new Set(
      scores.filter((s) => s.user.role === "admin").map((s) => s.userId)
    );
    const rosterScores = scores.filter((s) => !adminUserIds.has(s.userId));
    const rosterActuals = repActuals.filter((a) => !adminUserIds.has(a.userId));

    // Calculate max values for normalization
    const maxInitiativePoints = Math.max(...rosterScores.map((s) => s.totalPoints), 0);
    const maxTake = Math.max(...rosterActuals.map((a) => a.take), 0);
    const maxPipeline = Math.max(...rosterActuals.map((a) => a.pipeline), 0);
    const maxRevenue = Math.max(...rosterActuals.map((a) => a.revenue), 0);

    const thresholdData = initiative.thresholds.map((t) => ({ tier: t.tier, minPoints: t.minPoints }));

    // Fetch per-user action counts for point breakdowns (only since initiative start)
    // Attribute plans to their owner (ownerId), falling back to creator (userId) when no owner is set
    const userIds = scores.map((s) => s.userId);
    const sinceDate = initiative.startDate;

    // Fetch all plans since initiative start that belong to any scored user (as owner or creator)
    const allPlans = await prisma.territoryPlan.findMany({
      where: {
        createdAt: { gte: sinceDate },
        OR: [
          { ownerId: { in: userIds } },
          { userId: { in: userIds }, ownerId: null },
        ],
      },
      select: { id: true, ownerId: true, userId: true },
    });

    // Build plan count per effective owner
    const planCountMap = new Map<string, number>();
    for (const plan of allPlans) {
      const uid = plan.ownerId ?? plan.userId;
      if (!uid) continue;
      planCountMap.set(uid, (planCountMap.get(uid) ?? 0) + 1);
    }

    const planIds = allPlans.map((p) => p.id);

    const [activityCounts, planDistricts] = await Promise.all([
      prisma.activity.groupBy({
        by: ["createdByUserId"],
        where: { createdByUserId: { in: userIds }, createdAt: { gte: sinceDate } },
        _count: true,
      }),
      prisma.territoryPlanDistrict.findMany({
        where: { planId: { in: planIds } },
        select: {
          renewalTarget: true,
          winbackTarget: true,
          expansionTarget: true,
          newBusinessTarget: true,
          plan: { select: { ownerId: true, userId: true } },
        },
      }),
    ]);

    const activityCountMap = new Map(activityCounts.map((a) => [a.createdByUserId, a._count]));

    // Calculate revenue units per user (attributed to plan owner)
    const revenueByUser = new Map<string, number>();
    for (const d of planDistricts) {
      const uid = d.plan.ownerId ?? d.plan.userId;
      if (!uid) continue;
      const total =
        Number(d.renewalTarget ?? 0) +
        Number(d.winbackTarget ?? 0) +
        Number(d.expansionTarget ?? 0) +
        Number(d.newBusinessTarget ?? 0);
      revenueByUser.set(uid, (revenueByUser.get(uid) ?? 0) + total);
    }

    // Calculate revenue targeted per user — queries ALL plans by ownership and fiscal year,
    // independent of initiative start date (targets are FY goals, not initiative-period activities)
    // Always fetch both current and next FY separately for client-side toggling
    const currentFYInt = currentFY;
    const nextFYInt = currentFY + 1;

    const ownerFilter = {
      OR: [
        { ownerId: { in: userIds } },
        { userId: { in: userIds }, ownerId: null },
      ],
    };

    // Build userId → email map for matching plan ownership to matview rows
    // (the matview keys pipeline by sales_rep_email, not user id).
    const emailByUserId = new Map<string, string>();
    for (const s of scores) {
      if (s.user.email) emailByUserId.set(s.userId, s.user.email);
    }
    const rosterEmails = [...emailByUserId.values()];

    // Fetch plan districts for each FY AND per-rep-per-district open pipeline
    // from the matview in parallel. `districtLeaid` is now selected so we can
    // join plan targets to pipeline at the district level.
    const [targetedCurrentFYDistricts, targetedNextFYDistricts, pipelineRows] = await Promise.all([
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
      // Per-rep-per-district open pipeline for the two relevant FYs.
      // Only rows with positive pipeline are returned — nothing else matters
      // for the "districts with both target AND pipeline" filter below.
      rosterEmails.length === 0
        ? Promise.resolve([])
        : prisma.$queryRaw<
            { sales_rep_email: string; district_lea_id: string; school_yr: string; pipeline: number }[]
          >`
            SELECT sales_rep_email, district_lea_id, school_yr,
                   SUM(open_pipeline)::float AS pipeline
            FROM district_opportunity_actuals
            WHERE sales_rep_email = ANY(${rosterEmails})
              AND school_yr IN (${defaultSchoolYr}, ${nextFYSchoolYr})
            GROUP BY sales_rep_email, district_lea_id, school_yr
            HAVING SUM(open_pipeline) > 0
          `,
    ]);

    // Map keyed by "email::districtLeaid::schoolYr" → pipeline dollars.
    const repPipelineMap = new Map<string, number>();
    for (const row of pipelineRows) {
      const key = `${row.sales_rep_email}::${row.district_lea_id}::${row.school_yr}`;
      repPipelineMap.set(key, Number(row.pipeline));
    }

    // Targeted formula: sum the value of targeted business that is NOT yet
    // in the pipeline. For each plan district with a positive target,
    // contribute max(0, target - pipeline). Pipeline defaults to 0 for
    // districts without any open opportunities, so those districts contribute
    // their full target amount (all of it is "untapped"). Districts with no
    // target are skipped.
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
        const pipeline = email
          ? repPipelineMap.get(`${email}::${d.districtLeaid}::${schoolYr}`) ?? 0
          : 0;

        map.set(uid, (map.get(uid) ?? 0) + Math.max(0, target - pipeline));
      }
      return map;
    }

    const targetedCurrentFYByUser = sumTargetsWithPipelineDeduction(
      targetedCurrentFYDistricts,
      defaultSchoolYr,
    );
    const targetedNextFYByUser = sumTargetsWithPipelineDeduction(
      targetedNextFYDistricts,
      nextFYSchoolYr,
    );
    // Combined for initiative scoring (uses initiative FY setting or both)
    const revenueTargetedByUser = new Map<string, number>();
    for (const uid of userIds) {
      revenueTargetedByUser.set(uid, (targetedCurrentFYByUser.get(uid) ?? 0) + (targetedNextFYByUser.get(uid) ?? 0));
    }
    const maxRevenueTargeted = Math.max(
      ...rosterScores.map((s) => revenueTargetedByUser.get(s.userId) ?? 0),
      0
    );

    const getActionCount = (userId: string, action: string): number => {
      if (action === "plan_created") return planCountMap.get(userId) ?? 0;
      if (action === "activity_logged") return activityCountMap.get(userId) ?? 0;
      if (action === "revenue_targeted") return Math.floor((revenueByUser.get(userId) ?? 0) / 10000);
      return 0;
    };

    // Build leaderboard entries
    const entries = rosterScores.map((score, index) => {
      const actuals = actualsMap.get(score.userId) ?? {
        userId: score.userId,
        take: 0,
        pipeline: 0,
        pipelineCurrentFY: 0,
        pipelineNextFY: 0,
        revenue: 0,
        revenueCurrentFY: 0,
        revenuePriorFY: 0,
        priorYearRevenue: 0,
        minPurchasesCurrentFY: 0,
        minPurchasesPriorFY: 0,
      };

      const tier = calculateTier(score.totalPoints, thresholdData);

      const combinedScore = calculateCombinedScore({
        initiativePoints: score.totalPoints,
        maxInitiativePoints,
        pipeline: actuals.pipeline,
        maxPipeline,
        take: actuals.take,
        maxTake,
        revenue: actuals.revenue,
        maxRevenue,
        revenueTargeted: revenueTargetedByUser.get(score.userId) ?? 0,
        maxRevenueTargeted,
        initiativeWeight: Number(initiative.initiativeWeight),
        pipelineWeight: Number(initiative.pipelineWeight),
        takeWeight: Number(initiative.takeWeight),
        revenueWeight: Number(initiative.revenueWeight),
        revenueTargetedWeight: Number(initiative.revenueTargetedWeight),
      });

      const initiativeScore = maxInitiativePoints > 0
        ? (score.totalPoints / maxInitiativePoints) * 100
        : 0;

      const pointBreakdown = initiative.metrics.map((m) => {
        const count = getActionCount(score.userId, m.action);
        return {
          action: m.action,
          label: m.label,
          pointValue: m.pointValue,
          count,
          total: count * m.pointValue,
        };
      });

      return {
        userId: score.userId,
        fullName: score.user.fullName ?? "Unknown",
        avatarUrl: score.user.avatarUrl,
        totalPoints: score.totalPoints,
        tier,
        rank: index + 1,
        take: actuals.take,
        pipeline: actuals.pipeline,
        pipelineCurrentFY: actuals.pipelineCurrentFY,
        pipelineNextFY: actuals.pipelineNextFY,
        revenue: actuals.revenue,
        revenueCurrentFY: actuals.revenueCurrentFY,
        revenuePriorFY: actuals.revenuePriorFY,
        priorYearRevenue: actuals.priorYearRevenue,
        minPurchasesCurrentFY: actuals.minPurchasesCurrentFY,
        minPurchasesPriorFY: actuals.minPurchasesPriorFY,
        revenueTargeted: revenueTargetedByUser.get(score.userId) ?? 0,
        targetedCurrentFY: targetedCurrentFYByUser.get(score.userId) ?? 0,
        targetedNextFY: targetedNextFYByUser.get(score.userId) ?? 0,
        combinedScore: Math.round(combinedScore * 10) / 10,
        initiativeScore: Math.round(initiativeScore * 10) / 10,
        pointBreakdown,
      };
    });

    // Sum across the FULL repActuals + targeted maps (admin-inclusive).
    // The `unassigned*` fields capture the admin-only subtotal so the UI
    // can show an inline "incl. $X unassigned" annotation.
    const sumActuals = (
      pool: typeof repActuals,
      key:
        | "revenue"
        | "revenueCurrentFY"
        | "revenuePriorFY"
        | "priorYearRevenue"
        | "minPurchasesCurrentFY"
        | "minPurchasesPriorFY"
        | "pipelineCurrentFY"
        | "pipelineNextFY",
    ): number => pool.reduce((acc, a) => acc + (a[key] ?? 0), 0);

    const sumTargetedMap = (pool: Map<string, number>, ids: Iterable<string>): number => {
      let total = 0;
      for (const id of ids) total += pool.get(id) ?? 0;
      return total;
    };

    const adminActuals = repActuals.filter((a) => adminUserIds.has(a.userId));

    const teamTotals = {
      // Revenue: legacy scalar (scoring/compat) + per-FY pair (client toggle)
      revenue: sumActuals(repActuals, "revenue"),
      revenueCurrentFY: sumActuals(repActuals, "revenueCurrentFY"),
      revenuePriorFY: sumActuals(repActuals, "revenuePriorFY"),
      unassignedRevenue: sumActuals(adminActuals, "revenue"),
      unassignedRevenueCurrentFY: sumActuals(adminActuals, "revenueCurrentFY"),
      unassignedRevenuePriorFY: sumActuals(adminActuals, "revenuePriorFY"),

      // Min Purchases: legacy alias (priorYearRevenue) + per-FY pair
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

      // userIds (declared earlier, full score list) → all-users sum.
      // adminUserIds → admin-only sum.
      targetedCurrentFY: sumTargetedMap(targetedCurrentFYByUser, userIds),
      targetedNextFY: sumTargetedMap(targetedNextFYByUser, userIds),
      unassignedTargetedCurrentFY: sumTargetedMap(targetedCurrentFYByUser, adminUserIds),
      unassignedTargetedNextFY: sumTargetedMap(targetedNextFYByUser, adminUserIds),
    };

    return NextResponse.json({
      initiative: {
        id: initiative.id,
        name: initiative.name,
        startDate: initiative.startDate.toISOString(),
        endDate: initiative.endDate?.toISOString() ?? null,
        showName: initiative.showName,
        showDates: initiative.showDates,
        initiativeWeight: Number(initiative.initiativeWeight),
        pipelineWeight: Number(initiative.pipelineWeight),
        takeWeight: Number(initiative.takeWeight),
        revenueWeight: Number(initiative.revenueWeight),
        revenueTargetedWeight: Number(initiative.revenueTargetedWeight),
        pipelineFiscalYear: initiative.pipelineFiscalYear,
        takeFiscalYear: initiative.takeFiscalYear,
        revenueFiscalYear: initiative.revenueFiscalYear,
        revenueTargetedFiscalYear: initiative.revenueTargetedFiscalYear,
      },
      fiscalYears: {
        currentFY: defaultSchoolYr,
        nextFY: nextFYSchoolYr,
        priorFY: priorSchoolYr,
      },
      entries,
      teamTotals,
      metrics: initiative.metrics.map((m) => ({
        action: m.action,
        label: m.label,
        pointValue: m.pointValue,
      })),
      thresholds: initiative.thresholds.map((t) => ({
        tier: t.tier,
        minPoints: t.minPoints,
      })),
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
