import { describe, it, expect, vi } from "vitest";

// Mock auth so POST gets a user without hitting Supabase.
vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

// Keep auto-tag + rollup-sync side effects out of the test DB state.
vi.mock("@/features/shared/lib/auto-tags", () => ({
  syncClassificationTagsForDistrict: vi.fn().mockResolvedValue(undefined),
  syncMissingRenewalOppTagForDistrict: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/plans/lib/rollup-sync", () => ({
  syncPlanRollups: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/leaderboard/lib/scoring", () => ({
  awardPoints: vi.fn().mockResolvedValue(undefined),
}));

import prisma from "@/lib/prisma";
import { POST } from "../route";

describe("POST /api/territory-plans/[id]/districts rollup expansion", () => {
  it("expands rollup leaids to children on POST", async () => {
    const plan = await prisma.territoryPlan.create({
      data: { name: "write-guard-rollup-test", fiscalYear: 2026 },
    });

    try {
      const req = new Request(
        `http://localhost/api/territory-plans/${plan.id}/districts`,
        { method: "POST", body: JSON.stringify({ leaids: ["3620580"] }) }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await POST(req as any, {
        params: Promise.resolve({ id: plan.id }),
      } as any);
      expect(res.status).toBe(201);

      const rows = await prisma.territoryPlanDistrict.findMany({
        where: { planId: plan.id },
        select: { districtLeaid: true },
      });
      const leaids = rows.map((r) => r.districtLeaid);
      expect(leaids).not.toContain("3620580");
      expect(leaids).toContain("3600076");
      expect(leaids.length).toBeGreaterThanOrEqual(32);
    } finally {
      await prisma.territoryPlanDistrict.deleteMany({
        where: { planId: plan.id },
      });
      await prisma.territoryPlan.delete({ where: { id: plan.id } });
    }
  });
});
