// scripts/seed-season-0.ts
// Seeds Season 0 with retroactive backfill for existing plans, activities, and revenue targets.
// Run with: npx tsx scripts/seed-season-0.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Season 0...\n");

  // 1. Create Season 0
  const season = await prisma.season.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      name: "Season 0",
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-06-30T23:59:59Z"),
      isActive: true,
      softResetTiers: 1,
      seasonWeight: 0.6,
      pipelineWeight: 0.2,
      takeWeight: 0.2,
    },
    update: {
      name: "Season 0",
      isActive: true,
    },
  });
  console.log(`Season created: ${season.name} (id=${season.id})`);

  // 2. Create metrics (clear and recreate for idempotency)
  const metrics = [
    { action: "plan_created", pointValue: 10, label: "Create a Plan" },
    { action: "activity_logged", pointValue: 5, label: "Log an Activity" },
    { action: "revenue_targeted", pointValue: 1, label: "Revenue Targeted ($10K)" },
  ];

  await prisma.seasonMetric.deleteMany({ where: { seasonId: season.id } });
  await prisma.seasonMetric.createMany({
    data: metrics.map((m) => ({
      seasonId: season.id,
      action: m.action,
      pointValue: m.pointValue,
      label: m.label,
    })),
  });
  console.log(`Metrics: ${metrics.map((m) => `${m.action}=${m.pointValue}pts`).join(", ")}`);

  // 3. Create tier thresholds (clear and recreate)
  const thresholds = [
    { tier: "freshman", minPoints: 0 },
    { tier: "honor_roll", minPoints: 100 },
    { tier: "deans_list", minPoints: 300 },
    { tier: "valedictorian", minPoints: 600 },
  ];

  await prisma.seasonTierThreshold.deleteMany({ where: { seasonId: season.id } });
  await prisma.seasonTierThreshold.createMany({
    data: thresholds.map((t) => ({
      seasonId: season.id,
      tier: t.tier,
      minPoints: t.minPoints,
    })),
  });
  console.log(`Thresholds: ${thresholds.map((t) => `${t.tier}>=${t.minPoints}`).join(", ")}\n`);

  // 4. Retroactive backfill
  const users = await prisma.userProfile.findMany({
    select: { id: true, fullName: true },
  });

  console.log(`Backfilling ${users.length} users...\n`);

  const planMetric = metrics.find((m) => m.action === "plan_created")!;
  const activityMetric = metrics.find((m) => m.action === "activity_logged")!;
  const revenueMetric = metrics.find((m) => m.action === "revenue_targeted")!;

  for (const user of users) {
    const planCount = await prisma.territoryPlan.count({
      where: { userId: user.id },
    });

    const activityCount = await prisma.activity.count({
      where: { createdByUserId: user.id },
    });

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
    const revenueUnits = Math.floor(totalTargeted / 10000);

    const totalPoints =
      planCount * planMetric.pointValue +
      activityCount * activityMetric.pointValue +
      revenueUnits * revenueMetric.pointValue;

    await prisma.seasonScore.upsert({
      where: {
        seasonId_userId: { seasonId: season.id, userId: user.id },
      },
      create: {
        seasonId: season.id,
        userId: user.id,
        totalPoints,
        tier: "freshman",
      },
      update: {
        totalPoints,
      },
    });

    console.log(
      `  ${(user.fullName ?? user.id).padEnd(25)} ` +
        `${planCount} plans (${(planCount * planMetric.pointValue).toString().padStart(4)}pts) + ` +
        `${activityCount} activities (${(activityCount * activityMetric.pointValue).toString().padStart(4)}pts) + ` +
        `$${(revenueUnits * 10000).toLocaleString().padStart(10)} targeted (${(revenueUnits * revenueMetric.pointValue).toString().padStart(4)}pts) = ` +
        `${totalPoints} total`
    );
  }

  console.log("\nSeason 0 seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
