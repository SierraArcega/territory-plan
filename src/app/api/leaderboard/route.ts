import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { calculateTier, calculateCombinedScore } from "@/features/leaderboard/lib/scoring";
import { getRepActuals } from "@/lib/opportunity-actuals";

export const dynamic = "force-dynamic";

// GET /api/leaderboard — full leaderboard for active season
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const season = await prisma.season.findFirst({
      where: { isActive: true },
      include: {
        thresholds: true,
        metrics: true,
      },
    });

    if (!season) {
      return NextResponse.json({ error: "No active season" }, { status: 404 });
    }

    // Get all scores for this season with user profiles
    const scores = await prisma.seasonScore.findMany({
      where: { seasonId: season.id },
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

    // Get take and pipeline data for all reps
    const now = new Date();
    const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    const schoolYr = `${currentFY - 1}-${String(currentFY).slice(-2)}`;

    const repActuals = await Promise.all(
      scores.map(async (score) => {
        const email = score.user.email;
        try {
          const actuals = await getRepActuals(email, schoolYr);
          return {
            userId: score.userId,
            take: actuals.totalTake,
            pipeline: actuals.weightedPipeline,
          };
        } catch {
          return { userId: score.userId, take: 0, pipeline: 0 };
        }
      })
    );

    const actualsMap = new Map(repActuals.map((a) => [a.userId, a]));

    // Calculate max values for normalization
    const maxSeasonPoints = Math.max(...scores.map((s) => s.totalPoints), 0);
    const maxTake = Math.max(...repActuals.map((a) => a.take), 0);
    const maxPipeline = Math.max(...repActuals.map((a) => a.pipeline), 0);

    const thresholdData = season.thresholds.map((t) => ({ tier: t.tier, minPoints: t.minPoints }));

    // Build leaderboard entries
    const entries = scores.map((score, index) => {
      const actuals = actualsMap.get(score.userId) ?? { take: 0, pipeline: 0 };

      const tier = calculateTier(score.totalPoints, thresholdData);

      const combinedScore = calculateCombinedScore({
        seasonPoints: score.totalPoints,
        maxSeasonPoints,
        pipeline: actuals.pipeline,
        maxPipeline,
        take: actuals.take,
        maxTake,
        seasonWeight: Number(season.seasonWeight),
        pipelineWeight: Number(season.pipelineWeight),
        takeWeight: Number(season.takeWeight),
      });

      const seasonScore = maxSeasonPoints > 0
        ? (score.totalPoints / maxSeasonPoints) * 100
        : 0;

      return {
        userId: score.userId,
        fullName: score.user.fullName ?? "Unknown",
        avatarUrl: score.user.avatarUrl,
        totalPoints: score.totalPoints,
        tier,
        rank: index + 1,
        take: actuals.take,
        pipeline: actuals.pipeline,
        combinedScore: Math.round(combinedScore * 10) / 10,
        seasonScore: Math.round(seasonScore * 10) / 10,
      };
    });

    return NextResponse.json({
      season: {
        id: season.id,
        name: season.name,
        startDate: season.startDate.toISOString(),
        endDate: season.endDate.toISOString(),
        seasonWeight: Number(season.seasonWeight),
        pipelineWeight: Number(season.pipelineWeight),
        takeWeight: Number(season.takeWeight),
      },
      entries,
      metrics: season.metrics.map((m) => ({
        action: m.action,
        label: m.label,
        pointValue: m.pointValue,
      })),
      thresholds: season.thresholds.map((t) => ({
        tier: t.tier,
        minPoints: t.minPoints,
      })),
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
