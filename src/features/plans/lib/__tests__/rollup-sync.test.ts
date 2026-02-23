import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlanDistrict: {
      aggregate: vi.fn(),
    },
    territoryPlanState: {
      count: vi.fn(),
    },
    territoryPlan: {
      update: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { syncPlanRollups } from "../rollup-sync";

const mockPrisma = vi.mocked(prisma);

describe("syncPlanRollups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes rollups from districts with targets", async () => {
    mockPrisma.territoryPlanDistrict.aggregate.mockResolvedValue({
      _count: { districtLeaid: 5 },
      _sum: {
        renewalTarget: 100000,
        expansionTarget: 50000,
        winbackTarget: 25000,
        newBusinessTarget: 75000,
      },
    } as never);
    mockPrisma.territoryPlanState.count.mockResolvedValue(3 as never);
    mockPrisma.territoryPlan.update.mockResolvedValue({} as never);

    await syncPlanRollups("plan-1");

    expect(mockPrisma.territoryPlan.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: {
        districtCount: 5,
        stateCount: 3,
        renewalRollup: 100000,
        expansionRollup: 50000,
        winbackRollup: 25000,
        newBusinessRollup: 75000,
      },
    });
  });

  it("coalesces null sums to 0 for an empty plan", async () => {
    mockPrisma.territoryPlanDistrict.aggregate.mockResolvedValue({
      _count: { districtLeaid: 0 },
      _sum: {
        renewalTarget: null,
        expansionTarget: null,
        winbackTarget: null,
        newBusinessTarget: null,
      },
    } as never);
    mockPrisma.territoryPlanState.count.mockResolvedValue(0 as never);
    mockPrisma.territoryPlan.update.mockResolvedValue({} as never);

    await syncPlanRollups("empty-plan");

    expect(mockPrisma.territoryPlan.update).toHaveBeenCalledWith({
      where: { id: "empty-plan" },
      data: {
        districtCount: 0,
        stateCount: 0,
        renewalRollup: 0,
        expansionRollup: 0,
        winbackRollup: 0,
        newBusinessRollup: 0,
      },
    });
  });

  it("coalesces only the null targets while preserving non-null values", async () => {
    mockPrisma.territoryPlanDistrict.aggregate.mockResolvedValue({
      _count: { districtLeaid: 2 },
      _sum: {
        renewalTarget: 40000,
        expansionTarget: null,
        winbackTarget: 15000,
        newBusinessTarget: null,
      },
    } as never);
    mockPrisma.territoryPlanState.count.mockResolvedValue(1 as never);
    mockPrisma.territoryPlan.update.mockResolvedValue({} as never);

    await syncPlanRollups("partial-plan");

    expect(mockPrisma.territoryPlan.update).toHaveBeenCalledWith({
      where: { id: "partial-plan" },
      data: {
        districtCount: 2,
        stateCount: 1,
        renewalRollup: 40000,
        expansionRollup: 0,
        winbackRollup: 15000,
        newBusinessRollup: 0,
      },
    });
  });

  it("passes the planId to all three Prisma calls", async () => {
    mockPrisma.territoryPlanDistrict.aggregate.mockResolvedValue({
      _count: { districtLeaid: 0 },
      _sum: {
        renewalTarget: null,
        expansionTarget: null,
        winbackTarget: null,
        newBusinessTarget: null,
      },
    } as never);
    mockPrisma.territoryPlanState.count.mockResolvedValue(0 as never);
    mockPrisma.territoryPlan.update.mockResolvedValue({} as never);

    await syncPlanRollups("test-plan-id");

    expect(mockPrisma.territoryPlanDistrict.aggregate).toHaveBeenCalledWith({
      where: { planId: "test-plan-id" },
      _count: { districtLeaid: true },
      _sum: {
        renewalTarget: true,
        expansionTarget: true,
        winbackTarget: true,
        newBusinessTarget: true,
      },
    });
    expect(mockPrisma.territoryPlanState.count).toHaveBeenCalledWith({
      where: { planId: "test-plan-id" },
    });
    expect(mockPrisma.territoryPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "test-plan-id" },
      })
    );
  });

  it("runs aggregate and count in parallel before calling update", async () => {
    const callOrder: string[] = [];

    mockPrisma.territoryPlanDistrict.aggregate.mockImplementation(async () => {
      callOrder.push("aggregate");
      return {
        _count: { districtLeaid: 1 },
        _sum: {
          renewalTarget: 10,
          expansionTarget: 20,
          winbackTarget: 30,
          newBusinessTarget: 40,
        },
      } as never;
    });
    mockPrisma.territoryPlanState.count.mockImplementation(async () => {
      callOrder.push("count");
      return 1 as never;
    });
    mockPrisma.territoryPlan.update.mockImplementation(async () => {
      callOrder.push("update");
      return {} as never;
    });

    await syncPlanRollups("plan-parallel");

    // Both aggregate and count should be called before update
    expect(callOrder).toContain("aggregate");
    expect(callOrder).toContain("count");
    const updateIdx = callOrder.indexOf("update");
    const aggregateIdx = callOrder.indexOf("aggregate");
    const countIdx = callOrder.indexOf("count");
    expect(updateIdx).toBeGreaterThan(aggregateIdx);
    expect(updateIdx).toBeGreaterThan(countIdx);
  });

  it("is idempotent -- calling twice produces identical updates", async () => {
    mockPrisma.territoryPlanDistrict.aggregate.mockResolvedValue({
      _count: { districtLeaid: 3 },
      _sum: {
        renewalTarget: 60000,
        expansionTarget: 30000,
        winbackTarget: 10000,
        newBusinessTarget: 20000,
      },
    } as never);
    mockPrisma.territoryPlanState.count.mockResolvedValue(2 as never);
    mockPrisma.territoryPlan.update.mockResolvedValue({} as never);

    await syncPlanRollups("idem-plan");
    await syncPlanRollups("idem-plan");

    expect(mockPrisma.territoryPlan.update).toHaveBeenCalledTimes(2);

    const expectedData = {
      where: { id: "idem-plan" },
      data: {
        districtCount: 3,
        stateCount: 2,
        renewalRollup: 60000,
        expansionRollup: 30000,
        winbackRollup: 10000,
        newBusinessRollup: 20000,
      },
    };

    expect(mockPrisma.territoryPlan.update).toHaveBeenNthCalledWith(
      1,
      expectedData
    );
    expect(mockPrisma.territoryPlan.update).toHaveBeenNthCalledWith(
      2,
      expectedData
    );
  });
});
