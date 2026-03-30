import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";
import { calculateEffectivePoints, calculateTier } from "@/features/leaderboard/lib/scoring";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const initiative = await prisma.initiative.findFirst({
      where: { isActive: true },
      include: { metrics: true, thresholds: true },
    });

    if (!initiative) {
      return NextResponse.json({ error: "No active initiative" }, { status: 404 });
    }

    const metricMap = new Map(
      initiative.metrics.map((m) => [
        m.action,
        calculateEffectivePoints(m.pointValue, m.weight),
      ])
    );

    const thresholdData = initiative.thresholds.map((t) => ({
      tier: t.tier,
      minPoints: t.minPoints,
    }));

    const allUsers = await prisma.userProfile.findMany({
      select: { id: true },
    });

    const sinceDate = initiative.startDate;
    let updated = 0;

    for (const user of allUsers) {
      let totalPoints = 0;

      const planPts = metricMap.get("plan_created");
      if (planPts) {
        const count = await prisma.territoryPlan.count({
          where: { userId: user.id, createdAt: { gte: sinceDate } },
        });
        totalPoints += count * planPts;
      }

      const activityPts = metricMap.get("activity_logged");
      if (activityPts) {
        const count = await prisma.activity.count({
          where: { createdByUserId: user.id, createdAt: { gte: sinceDate } },
        });
        totalPoints += count * activityPts;
      }

      const revenuePts = metricMap.get("revenue_targeted");
      if (revenuePts) {
        const plans = await prisma.territoryPlan.findMany({
          where: { userId: user.id, createdAt: { gte: sinceDate } },
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
        totalPoints += Math.floor(totalTargeted / 10000) * revenuePts;
      }

      const districtPts = metricMap.get("district_added");
      if (districtPts) {
        const count = await prisma.territoryPlanDistrict.count({
          where: { plan: { userId: user.id, createdAt: { gte: sinceDate } } },
        });
        totalPoints += count * districtPts;
      }

      const tier = calculateTier(totalPoints, thresholdData);

      await prisma.initiativeScore.upsert({
        where: {
          initiativeId_userId: { initiativeId: initiative.id, userId: user.id },
        },
        create: {
          initiativeId: initiative.id,
          userId: user.id,
          totalPoints,
          tier,
          rank: 0,
        },
        update: {
          totalPoints,
          tier,
        },
      });

      updated++;
    }

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error("Error recalculating scores:", error);
    return NextResponse.json({ error: "Failed to recalculate" }, { status: 500 });
  }
}
