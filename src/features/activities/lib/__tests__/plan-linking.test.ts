import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlanDistrict: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { findPlanIdsForDistricts } from "../plan-linking";

describe("findPlanIdsForDistricts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] for empty input without querying", async () => {
    const result = await findPlanIdsForDistricts([]);
    expect(result).toEqual([]);
    expect(mockPrisma.territoryPlanDistrict.findMany).not.toHaveBeenCalled();
  });

  it("returns distinct planIds for districts that are in plans", async () => {
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([
      { planId: "plan-1" },
      { planId: "plan-2" },
    ]);

    const result = await findPlanIdsForDistricts(["0601234", "0605678"]);

    expect(result).toEqual(["plan-1", "plan-2"]);
    expect(mockPrisma.territoryPlanDistrict.findMany).toHaveBeenCalledWith({
      where: { districtLeaid: { in: ["0601234", "0605678"] } },
      select: { planId: true },
      distinct: ["planId"],
    });
  });

  it("returns [] when no plan contains the districts", async () => {
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);
    const result = await findPlanIdsForDistricts(["9999999"]);
    expect(result).toEqual([]);
  });

  it("uses the provided transaction client when given one", async () => {
    const txFindMany = vi.fn().mockResolvedValue([{ planId: "plan-tx" }]);
    const tx = { territoryPlanDistrict: { findMany: txFindMany } };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findPlanIdsForDistricts(["0601234"], tx as any);

    expect(result).toEqual(["plan-tx"]);
    expect(txFindMany).toHaveBeenCalledOnce();
    expect(mockPrisma.territoryPlanDistrict.findMany).not.toHaveBeenCalled();
  });
});
