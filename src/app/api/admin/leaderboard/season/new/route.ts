import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";
import { TIERS } from "@/features/leaderboard/lib/types";

export const dynamic = "force-dynamic";

const DEFAULT_METRICS = [
  { action: "plan_created", label: "Plan Created", pointValue: 10, weight: 1.0 },
  { action: "activity_logged", label: "Activity Logged", pointValue: 5, weight: 1.0 },
  { action: "revenue_targeted", label: "Revenue Targeted", pointValue: 3, weight: 1.0 },
];

const DEFAULT_THRESHOLDS = [
  { tier: "freshman", minPoints: 0 },
  { tier: "honor_roll", minPoints: 100 },
  { tier: "deans_list", minPoints: 300 },
  { tier: "valedictorian", minPoints: 900 },
];

export async function POST() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const uid = `s_${Math.floor(Date.now() / 1000)}`;

    // Check for existing active season to copy config from
    const current = await prisma.season.findFirst({
      where: { isActive: true },
      include: { metrics: true, thresholds: true },
    });

    // Deactivate current season if exists
    if (current) {
      await prisma.season.update({
        where: { id: current.id },
        data: { isActive: false, endDate: new Date() },
      });
    }

    const metricsToUse = current
      ? current.metrics.map((m) => ({
          action: m.action,
          label: m.label,
          pointValue: m.pointValue,
          weight: Number(m.weight),
        }))
      : DEFAULT_METRICS;

    const thresholdsToUse = current
      ? current.thresholds.map((t) => ({ tier: t.tier, minPoints: t.minPoints }))
      : DEFAULT_THRESHOLDS;

    const newSeason = await prisma.season.create({
      data: {
        name: current ? current.name : "New Season",
        seasonUid: uid,
        startDate: new Date(),
        isActive: true,
        showName: current?.showName ?? true,
        showDates: current?.showDates ?? true,
        softResetTiers: current?.softResetTiers ?? 1,
        seasonWeight: current ? Number(current.seasonWeight) : 0.6,
        pipelineWeight: current ? Number(current.pipelineWeight) : 0.2,
        takeWeight: current ? Number(current.takeWeight) : 0.2,
        metrics: {
          create: metricsToUse,
        },
        thresholds: {
          create: thresholdsToUse,
        },
      },
      include: { metrics: true, thresholds: true },
    });

    // Apply soft reset: move reps down by softResetTiers
    if (current && current.softResetTiers > 0) {
      const oldScores = await prisma.seasonScore.findMany({
        where: { seasonId: current.id },
      });

      const tierOrder = TIERS;

      for (const score of oldScores) {
        const currentIdx = tierOrder.indexOf(score.tier as (typeof tierOrder)[number]);
        const newIdx = Math.max(0, currentIdx - current.softResetTiers);
        const newTier = tierOrder[newIdx];

        await prisma.seasonScore.create({
          data: {
            seasonId: newSeason.id,
            userId: score.userId,
            totalPoints: 0,
            tier: newTier,
            rank: 0,
          },
        });
      }
    }

    return NextResponse.json({ success: true, season: newSeason });
  } catch (error) {
    console.error("Error creating new season:", error);
    return NextResponse.json({ error: "Failed to create new season" }, { status: 500 });
  }
}
