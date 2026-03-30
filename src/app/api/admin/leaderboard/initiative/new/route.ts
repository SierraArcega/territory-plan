import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";
import { calculateEffectivePoints } from "@/features/leaderboard/lib/scoring";

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

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const backfill = (body as { backfill?: boolean }).backfill ?? false;

    const uid = `s_${Math.floor(Date.now() / 1000)}`;

    // Check for existing active initiative to copy config from
    const current = await prisma.initiative.findFirst({
      where: { isActive: true },
      include: { metrics: true, thresholds: true },
    });

    // Deactivate current initiative if exists
    if (current) {
      await prisma.initiative.update({
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

    const newInitiative = await prisma.initiative.create({
      data: {
        name: current ? current.name : "New Initiative",
        initiativeUid: uid,
        startDate: new Date(),
        isActive: true,
        showName: current?.showName ?? true,
        showDates: current?.showDates ?? true,
        softResetTiers: current?.softResetTiers ?? 1,
        initiativeWeight: current ? Number(current.initiativeWeight) : 0.4,
        pipelineWeight: current ? Number(current.pipelineWeight) : 0.2,
        pipelineFiscalYear: current?.pipelineFiscalYear ?? null,
        takeWeight: current ? Number(current.takeWeight) : 0.2,
        takeFiscalYear: current?.takeFiscalYear ?? null,
        revenueWeight: current ? Number(current.revenueWeight) : 0.2,
        revenueFiscalYear: current?.revenueFiscalYear ?? null,
        revenueTargetedWeight: current ? Number(current.revenueTargetedWeight) : 0,
        revenueTargetedFiscalYear: current?.revenueTargetedFiscalYear ?? null,
        metrics: {
          create: metricsToUse,
        },
        thresholds: {
          create: thresholdsToUse,
        },
      },
      include: { metrics: true, thresholds: true },
    });

    // Seed scores for all users
    const allUsers = await prisma.userProfile.findMany({
      select: { id: true },
    });

    if (backfill) {
      // Build a lookup of metric point values by action
      const metricMap = new Map(
        newInitiative.metrics.map((m) => [
          m.action,
          calculateEffectivePoints(m.pointValue, m.weight),
        ])
      );

      for (const user of allUsers) {
        let totalPoints = 0;

        // Plans created
        const planPts = metricMap.get("plan_created");
        if (planPts) {
          const planCount = await prisma.territoryPlan.count({
            where: { userId: user.id },
          });
          totalPoints += planCount * planPts;
        }

        // Activities logged
        const activityPts = metricMap.get("activity_logged");
        if (activityPts) {
          const activityCount = await prisma.activity.count({
            where: { createdByUserId: user.id },
          });
          totalPoints += activityCount * activityPts;
        }

        // Revenue targeted (per $10K)
        const revenuePts = metricMap.get("revenue_targeted");
        if (revenuePts) {
          const plans = await prisma.territoryPlan.findMany({
            where: { userId: user.id },
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

        // Districts added
        const districtPts = metricMap.get("district_added");
        if (districtPts) {
          const districtCount = await prisma.territoryPlanDistrict.count({
            where: { plan: { userId: user.id } },
          });
          totalPoints += districtCount * districtPts;
        }

        await prisma.initiativeScore.create({
          data: {
            initiativeId: newInitiative.id,
            userId: user.id,
            totalPoints,
            tier: "freshman",
            rank: 0,
          },
        });
      }
    } else {
      // Fresh start — everyone at 0
      await prisma.initiativeScore.createMany({
        data: allUsers.map((u) => ({
          initiativeId: newInitiative.id,
          userId: u.id,
          totalPoints: 0,
          tier: "freshman",
          rank: 0,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ success: true, initiative: newInitiative });
  } catch (error) {
    console.error("Error creating new initiative:", error);
    return NextResponse.json({ error: "Failed to create new initiative" }, { status: 500 });
  }
}
