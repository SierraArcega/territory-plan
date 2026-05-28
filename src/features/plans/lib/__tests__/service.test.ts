import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlan: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    territoryPlanDistrict: { createMany: vi.fn(), deleteMany: vi.fn() },
    district: { findMany: vi.fn() },
    activity: { findMany: vi.fn() },
    activityPlan: { createMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import {
  createPlan,
  updatePlan,
  addDistrictsToPlan,
  removeDistrictsFromPlan,
  addActivitiesToPlan,
  removeActivitiesFromPlan,
} from "../service";
import { ServiceError } from "@/features/shared/lib/service-error";

beforeEach(() => vi.clearAllMocks());

describe("createPlan", () => {
  it("requires a name", async () => {
    await expect(createPlan({ fiscalYear: 2026 }, "user-1")).rejects.toMatchObject({ status: 400 });
  });

  it("requires a fiscalYear in range", async () => {
    await expect(createPlan({ name: "Q1" }, "user-1")).rejects.toMatchObject({ status: 400 });
    await expect(createPlan({ name: "Q1", fiscalYear: 1999 }, "user-1")).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a bad color and a bad status", async () => {
    await expect(createPlan({ name: "Q1", fiscalYear: 2026, color: "red" }, "user-1")).rejects.toBeInstanceOf(ServiceError);
    await expect(createPlan({ name: "Q1", fiscalYear: 2026, status: "nope" }, "user-1")).rejects.toMatchObject({ status: 400 });
  });

  it("defaults owner to the current user and applies defaults", async () => {
    mockPrisma.territoryPlan.create.mockResolvedValue({ id: "plan-1", states: [], collaborators: [] });
    await createPlan({ name: "Q1 Texas", fiscalYear: 2026 }, "user-1");
    const arg = mockPrisma.territoryPlan.create.mock.calls[0][0];
    expect(arg.data.ownerId).toBe("user-1");
    expect(arg.data.userId).toBe("user-1");
    expect(arg.data.status).toBe("planning");
    expect(arg.data.color).toBe("#403770");
    expect(arg.data.fiscalYear).toBe(2026);
  });
});

describe("updatePlan", () => {
  it("404s when the plan is missing", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);
    await expect(updatePlan("plan-x", { name: "New" })).rejects.toMatchObject({ status: 404 });
  });

  it("rejects an invalid status before writing", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    await expect(updatePlan("plan-1", { status: "nope" })).rejects.toMatchObject({ status: 400 });
    expect(mockPrisma.territoryPlan.update).not.toHaveBeenCalled();
  });

  it("updates only the provided scalar fields", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.territoryPlan.update.mockResolvedValue({ id: "plan-1", status: "working" });
    await updatePlan("plan-1", { status: "working" });
    const arg = mockPrisma.territoryPlan.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "plan-1" });
    expect(arg.data.status).toBe("working");
    expect(arg.data.name).toBeUndefined();
  });
});

describe("addDistrictsToPlan", () => {
  it("rejects an empty district list", async () => {
    await expect(addDistrictsToPlan("plan-1", [])).rejects.toMatchObject({ status: 400 });
  });

  it("404s when the plan is missing", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);
    await expect(addDistrictsToPlan("plan-x", ["0601234"])).rejects.toMatchObject({ status: 404 });
  });

  it("400s when a district does not exist", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.district.findMany.mockResolvedValue([{ leaid: "0601234" }]);
    await expect(
      addDistrictsToPlan("plan-1", ["0601234", "ghost"]),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockPrisma.territoryPlanDistrict.createMany).not.toHaveBeenCalled();
  });

  it("inserts junction rows (skipDuplicates) and returns the added count", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.district.findMany.mockResolvedValue([{ leaid: "0601234" }, { leaid: "4800001" }]);
    mockPrisma.territoryPlanDistrict.createMany.mockResolvedValue({ count: 2 });
    const result = await addDistrictsToPlan("plan-1", ["0601234", "4800001"]);
    expect(result.added).toBe(2);
    const arg = mockPrisma.territoryPlanDistrict.createMany.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data).toEqual([
      { planId: "plan-1", districtLeaid: "0601234" },
      { planId: "plan-1", districtLeaid: "4800001" },
    ]);
  });
});

describe("removeDistrictsFromPlan", () => {
  it("rejects an empty district list", async () => {
    await expect(removeDistrictsFromPlan("plan-1", [])).rejects.toMatchObject({ status: 400 });
  });

  it("404s when the plan is missing", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);
    await expect(removeDistrictsFromPlan("plan-x", ["0601234"])).rejects.toMatchObject({ status: 404 });
    expect(mockPrisma.territoryPlanDistrict.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes the matching junction rows and returns the removed count", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.territoryPlanDistrict.deleteMany.mockResolvedValue({ count: 2 });
    const result = await removeDistrictsFromPlan("plan-1", ["0601234", "4800001"]);
    expect(result).toEqual({ removed: 2, planId: "plan-1" });
    const arg = mockPrisma.territoryPlanDistrict.deleteMany.mock.calls[0][0];
    expect(arg.where).toEqual({ planId: "plan-1", districtLeaid: { in: ["0601234", "4800001"] } });
  });

  it("no-ops (removed: 0) when no leaid is a member", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.territoryPlanDistrict.deleteMany.mockResolvedValue({ count: 0 });
    const result = await removeDistrictsFromPlan("plan-1", ["ghost"]);
    expect(result.removed).toBe(0);
  });
});

describe("addActivitiesToPlan", () => {
  it("rejects an empty activity list", async () => {
    await expect(addActivitiesToPlan("plan-1", [])).rejects.toMatchObject({ status: 400 });
  });

  it("404s when the plan is missing", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);
    await expect(addActivitiesToPlan("plan-x", ["act-1"])).rejects.toMatchObject({ status: 404 });
  });

  it("400s when an activity does not exist", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.activity.findMany.mockResolvedValue([{ id: "act-1" }]);
    await expect(
      addActivitiesToPlan("plan-1", ["act-1", "ghost"]),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockPrisma.activityPlan.createMany).not.toHaveBeenCalled();
  });

  it("inserts junction rows (skipDuplicates) and returns the added count", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.activity.findMany.mockResolvedValue([{ id: "act-1" }, { id: "act-2" }]);
    mockPrisma.activityPlan.createMany.mockResolvedValue({ count: 2 });
    const result = await addActivitiesToPlan("plan-1", ["act-1", "act-2"]);
    expect(result.added).toBe(2);
    const arg = mockPrisma.activityPlan.createMany.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data).toEqual([
      { planId: "plan-1", activityId: "act-1" },
      { planId: "plan-1", activityId: "act-2" },
    ]);
  });
});

describe("removeActivitiesFromPlan", () => {
  it("rejects an empty activity list", async () => {
    await expect(removeActivitiesFromPlan("plan-1", [])).rejects.toMatchObject({ status: 400 });
  });

  it("404s when the plan is missing", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);
    await expect(removeActivitiesFromPlan("plan-x", ["act-1"])).rejects.toMatchObject({ status: 404 });
    expect(mockPrisma.activityPlan.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes the matching junction rows and returns the removed count", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.activityPlan.deleteMany.mockResolvedValue({ count: 2 });
    const result = await removeActivitiesFromPlan("plan-1", ["act-1", "act-2"]);
    expect(result).toEqual({ removed: 2, planId: "plan-1" });
    const arg = mockPrisma.activityPlan.deleteMany.mock.calls[0][0];
    expect(arg.where).toEqual({ planId: "plan-1", activityId: { in: ["act-1", "act-2"] } });
  });

  it("no-ops (removed: 0) when no activity is a member", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.activityPlan.deleteMany.mockResolvedValue({ count: 0 });
    const result = await removeActivitiesFromPlan("plan-1", ["ghost"]);
    expect(result.removed).toBe(0);
  });
});
