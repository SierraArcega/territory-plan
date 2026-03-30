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
          },
        },
      },
      orderBy: { totalPoints: "desc" },
    });

    // Determine per-metric school years, falling back to current FY
    const now = new Date();
    const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    const defaultSchoolYr = `${currentFY - 1}-${String(currentFY).slice(-2)}`;

    const pipelineSchoolYr = initiative.pipelineFiscalYear ?? defaultSchoolYr;
    const takeSchoolYr = initiative.takeFiscalYear ?? defaultSchoolYr;
    const revenueSchoolYr = initiative.revenueFiscalYear ?? defaultSchoolYr;

    const uniqueYears = [...new Set([pipelineSchoolYr, takeSchoolYr, revenueSchoolYr])];

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
            take: yearActuals.get(takeSchoolYr)?.totalTake ?? 0,
            revenue: yearActuals.get(revenueSchoolYr)?.totalRevenue ?? 0,
          };
        } catch {
          return { userId: score.userId, take: 0, pipeline: 0, revenue: 0 };
        }
      })
    );

    const actualsMap = new Map(repActuals.map((a) => [a.userId, a]));

    // Calculate max values for normalization
    const maxInitiativePoints = Math.max(...scores.map((s) => s.totalPoints), 0);
    const maxTake = Math.max(...repActuals.map((a) => a.take), 0);
    const maxPipeline = Math.max(...repActuals.map((a) => a.pipeline), 0);
    const maxRevenue = Math.max(...repActuals.map((a) => a.revenue), 0);

    const thresholdData = initiative.thresholds.map((t) => ({ tier: t.tier, minPoints: t.minPoints }));

    // Fetch per-user action counts for point breakdowns
    const userIds = scores.map((s) => s.userId);
    const [planCounts, activityCounts, planDistricts] = await Promise.all([
      prisma.territoryPlan.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: true,
      }),
      prisma.activity.groupBy({
        by: ["createdByUserId"],
        where: { createdByUserId: { in: userIds } },
        _count: true,
      }),
      prisma.territoryPlanDistrict.findMany({
        where: { plan: { userId: { in: userIds } } },
        select: {
          renewalTarget: true,
          winbackTarget: true,
          expansionTarget: true,
          newBusinessTarget: true,
          plan: { select: { userId: true } },
        },
      }),
    ]);

    const planCountMap = new Map(planCounts.map((p) => [p.userId, p._count]));
    const activityCountMap = new Map(activityCounts.map((a) => [a.createdByUserId, a._count]));

    // Calculate revenue units per user
    const revenueByUser = new Map<string, number>();
    for (const d of planDistricts) {
      const uid = d.plan.userId;
      if (!uid) continue;
      const total =
        Number(d.renewalTarget ?? 0) +
        Number(d.winbackTarget ?? 0) +
        Number(d.expansionTarget ?? 0) +
        Number(d.newBusinessTarget ?? 0);
      revenueByUser.set(uid, (revenueByUser.get(uid) ?? 0) + total);
    }

    // Calculate revenue targeted per user (filterable by plan fiscal year)
    const revenueTargetedFYStr = initiative.revenueTargetedFiscalYear ?? null;
    // Parse school-year string "2025-26" → ending calendar year 2026 (matches TerritoryPlan.fiscalYear Int)
    const revenueTargetedFY = revenueTargetedFYStr
      ? parseInt(revenueTargetedFYStr.split("-")[0], 10) + 1
      : null;
    const revenueTargetedByUser = new Map<string, number>();
    const planDistrictData = await prisma.territoryPlanDistrict.findMany({
      where: {
        plan: {
          userId: { in: userIds },
          ...(revenueTargetedFY ? { fiscalYear: revenueTargetedFY } : {}),
        },
      },
      select: {
        renewalTarget: true,
        winbackTarget: true,
        expansionTarget: true,
        newBusinessTarget: true,
        plan: { select: { userId: true } },
      },
    });
    for (const d of planDistrictData) {
      const uid = d.plan.userId;
      if (!uid) continue;
      const total = Number(d.renewalTarget ?? 0) + Number(d.winbackTarget ?? 0) + Number(d.expansionTarget ?? 0) + Number(d.newBusinessTarget ?? 0);
      revenueTargetedByUser.set(uid, (revenueTargetedByUser.get(uid) ?? 0) + total);
    }
    const maxRevenueTargeted = Math.max(...[...revenueTargetedByUser.values()], 0);

    const getActionCount = (userId: string, action: string): number => {
      if (action === "plan_created") return planCountMap.get(userId) ?? 0;
      if (action === "activity_logged") return activityCountMap.get(userId) ?? 0;
      if (action === "revenue_targeted") return Math.floor((revenueByUser.get(userId) ?? 0) / 10000);
      return 0;
    };

    // Build leaderboard entries
    const entries = scores.map((score, index) => {
      const actuals = actualsMap.get(score.userId) ?? { take: 0, pipeline: 0, revenue: 0 };

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
        revenue: actuals.revenue,
        revenueTargeted: revenueTargetedByUser.get(score.userId) ?? 0,
        combinedScore: Math.round(combinedScore * 10) / 10,
        initiativeScore: Math.round(initiativeScore * 10) / 10,
        pointBreakdown,
      };
    });

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
      entries,
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
