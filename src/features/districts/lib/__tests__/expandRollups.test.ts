import { describe, it, expect, beforeEach, afterEach } from "vitest";
import prisma from "@/lib/prisma";
import { expandPlanRollups } from "../expandRollups";

describe("expandPlanRollups", () => {
  let planId: string;

  beforeEach(async () => {
    // Create a clean plan with just the NYC DOE rollup for testing
    const plan = await prisma.territoryPlan.create({
      data: {
        name: "test-rollup-plan",
        fiscalYear: 2026,
        districts: { create: [{ districtLeaid: "3620580" }] },
      },
    });
    planId = plan.id;
  });

  afterEach(async () => {
    // Clean up test data so repeated runs don't accumulate plans/activities in the dev DB.
    // Territory plan districts cascade via onDelete: Cascade; activities link via ActivityPlan.
    const activityLinks = await prisma.activityPlan.findMany({
      where: { planId },
      select: { activityId: true },
    });
    const activityIds = activityLinks.map((a) => a.activityId);
    if (activityIds.length > 0) {
      await prisma.activityPlan.deleteMany({ where: { planId } });
      await prisma.activity.deleteMany({ where: { id: { in: activityIds } } });
    }
    await prisma.territoryPlan.deleteMany({ where: { id: planId } });
  });

  it("expands a rollup-only plan to 32+ child rows and logs an activity", async () => {
    const result = await expandPlanRollups(planId, null);
    expect(result.expandedCount).toBeGreaterThanOrEqual(32);
    expect(result.rollupsExpanded).toEqual(["3620580"]);

    const districts = await prisma.territoryPlanDistrict.findMany({
      where: { planId },
      select: { districtLeaid: true },
    });
    const leaids = districts.map((d) => d.districtLeaid);
    expect(leaids).not.toContain("3620580");
    expect(leaids).toContain("3600076");

    const activity = await prisma.activity.findFirst({
      where: { type: "system_migration", plans: { some: { planId } } },
    });
    expect(activity).not.toBeNull();
    expect(activity?.metadata).toMatchObject({
      subtype: "rollup-expanded",
      rollupLeaid: "3620580",
      childCount: expect.any(Number),
    });
  });

  it("is idempotent: a second call performs no expansion", async () => {
    await expandPlanRollups(planId, null);
    const result2 = await expandPlanRollups(planId, null);
    expect(result2.expandedCount).toBe(0);
    expect(result2.rollupsExpanded).toEqual([]);
  });

  it("dedups: child already present in plan is not re-inserted", async () => {
    await prisma.territoryPlanDistrict.create({
      data: { planId, districtLeaid: "3600076" },
    });
    await expandPlanRollups(planId, null);
    const count = await prisma.territoryPlanDistrict.count({
      where: { planId, districtLeaid: "3600076" },
    });
    expect(count).toBe(1);
  });
});
