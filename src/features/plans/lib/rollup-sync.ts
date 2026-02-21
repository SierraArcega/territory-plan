import prisma from "@/lib/prisma";

/**
 * Recompute and update the denormalized rollup columns on a territory plan.
 * Call this after any change to the plan's districts or their targets.
 */
export async function syncPlanRollups(planId: string): Promise<void> {
  const [districtAgg, stateCount] = await Promise.all([
    prisma.territoryPlanDistrict.aggregate({
      where: { planId },
      _count: { districtLeaid: true },
      _sum: {
        renewalTarget: true,
        expansionTarget: true,
        winbackTarget: true,
        newBusinessTarget: true,
      },
    }),
    prisma.territoryPlanState.count({ where: { planId } }),
  ]);

  await prisma.territoryPlan.update({
    where: { id: planId },
    data: {
      districtCount: districtAgg._count.districtLeaid,
      stateCount,
      renewalRollup: districtAgg._sum.renewalTarget ?? 0,
      expansionRollup: districtAgg._sum.expansionTarget ?? 0,
      winbackRollup: districtAgg._sum.winbackTarget ?? 0,
      newBusinessRollup: districtAgg._sum.newBusinessTarget ?? 0,
    },
  });
}
