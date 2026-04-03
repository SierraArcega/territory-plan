import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/leaderboard/me — current user's rank, neighbors, and point breakdown
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const initiative = await prisma.initiative.findFirst({
      where: { isActive: true },
      include: { metrics: true },
    });

    if (!initiative) {
      return NextResponse.json({ error: "No active initiative" }, { status: 404 });
    }

    // Get all scores ranked by points
    const allScores = await prisma.initiativeScore.findMany({
      where: { initiativeId: initiative.id },
      include: {
        user: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
      orderBy: { totalPoints: "desc" },
    });

    const myIndex = allScores.findIndex((s) => s.userId === user.id);

    if (myIndex === -1) {
      return NextResponse.json({
        initiativeName: initiative.showName ? initiative.name : "Leaderboard",
        rank: allScores.length + 1,
        totalReps: allScores.length + 1,
        totalPoints: 0,
        tier: "freshman",
        above: null,
        below: null,
        pointBreakdown: initiative.metrics.map((m) => ({
          label: m.label,
          action: m.action,
          pointValue: m.pointValue,
          count: 0,
          total: 0,
        })),
      });
    }

    const myScore = allScores[myIndex];
    const above = myIndex > 0 ? allScores[myIndex - 1] : null;
    const below = myIndex < allScores.length - 1 ? allScores[myIndex + 1] : null;

    // Calculate point breakdown per metric
    // Attribute plans to their owner, falling back to creator when no owner is set
    const userPlanWhere = {
      OR: [
        { ownerId: user.id },
        { userId: user.id, ownerId: null },
      ],
    };

    const [planCount, activityCount] = await Promise.all([
      prisma.territoryPlan.count({ where: userPlanWhere }),
      prisma.activity.count({ where: { createdByUserId: user.id } }),
    ]);

    const actionCounts: Record<string, number> = {
      plan_created: planCount,
      activity_logged: activityCount,
    };

    const pointBreakdown = initiative.metrics.map((m) => {
      const count = actionCounts[m.action] ?? 0;
      return {
        label: m.label,
        action: m.action,
        pointValue: m.pointValue,
        count,
        total: count * m.pointValue,
      };
    });

    // For revenue_targeted, compute from plan district targets
    const revMetric = initiative.metrics.find((m) => m.action === "revenue_targeted");
    if (revMetric) {
      const plans = await prisma.territoryPlan.findMany({
        where: userPlanWhere,
        include: {
          districts: {
            select: {
              renewalTarget: true,
              winbackTarget: true,
              expansionTarget: true,
              newBusinessTarget: true,
            },
          },
        },
      });

      let totalTargeted = 0;
      for (const plan of plans) {
        for (const d of plan.districts) {
          totalTargeted +=
            Number(d.renewalTarget ?? 0) +
            Number(d.winbackTarget ?? 0) +
            Number(d.expansionTarget ?? 0) +
            Number(d.newBusinessTarget ?? 0);
        }
      }

      const units = Math.floor(totalTargeted / 10000);
      const existing = pointBreakdown.find((b) => b.action === "revenue_targeted");
      if (existing) {
        existing.count = units;
        existing.total = units * revMetric.pointValue;
      }
    }

    const formatNeighbor = (score: typeof myScore | null) =>
      score
        ? {
            userId: score.userId,
            fullName: score.user.fullName ?? "Unknown",
            avatarUrl: score.user.avatarUrl,
            totalPoints: score.totalPoints,
            rank: allScores.indexOf(score) + 1,
          }
        : null;

    return NextResponse.json({
      userId: user.id,
      initiativeName: initiative.name,
      rank: myIndex + 1,
      totalReps: allScores.length,
      totalPoints: myScore.totalPoints,
      tier: myScore.tier,
      above: formatNeighbor(above),
      below: formatNeighbor(below),
      pointBreakdown,
    });
  } catch (error) {
    console.error("Error fetching my leaderboard rank:", error);
    return NextResponse.json({ error: "Failed to fetch rank" }, { status: 500 });
  }
}
