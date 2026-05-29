import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    activity: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    district: { findMany: vi.fn() },
    territoryPlanDistrict: { findMany: vi.fn() },
    userProfile: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { createActivity, updateActivity } from "../service";
import { ServiceError } from "@/features/shared/lib/service-error";

const never = () => Promise.resolve(false);
const always = () => Promise.resolve(true);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: districts belong to no plan, so auto-link is a no-op.
  mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);
});

describe("createActivity", () => {
  it("rejects missing type or title", async () => {
    await expect(createActivity({ title: "x" }, "user-1")).rejects.toMatchObject({ status: 400 });
    await expect(createActivity({ type: "discovery_call" }, "user-1")).rejects.toMatchObject({ status: 400 });
  });

  it("rejects an invalid type", async () => {
    await expect(
      createActivity({ type: "not_real", title: "x" }, "user-1"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects an invalid status", async () => {
    await expect(
      createActivity({ type: "discovery_call", title: "x", status: "bogus" }, "user-1"),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  it("creates with the correct nested structure scoped to the user", async () => {
    mockPrisma.district.findMany.mockResolvedValue([{ stateFips: "06" }]);
    mockPrisma.activity.create.mockResolvedValue({ id: "a-1" });
    await createActivity(
      { type: "discovery_call", title: "Demo", planIds: ["plan-1"], districtLeaids: ["0601234"] },
      "user-1",
    );
    const arg = mockPrisma.activity.create.mock.calls[0][0];
    expect(arg.data.type).toBe("discovery_call");
    expect(arg.data.title).toBe("Demo");
    expect(arg.data.createdByUserId).toBe("user-1");
    expect(arg.data.plans).toEqual({ create: [{ planId: "plan-1" }] });
    expect(arg.data.districts.create[0]).toMatchObject({ districtLeaid: "0601234", warningDismissed: false });
  });

  it("auto-links plans that contain the activity's districts", async () => {
    mockPrisma.district.findMany.mockResolvedValue([{ stateFips: "06" }]);
    mockPrisma.activity.create.mockResolvedValue({ id: "a-2" });
    // District 0601234 lives in plan-1 (caller-supplied) AND plan-2 (auto).
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([
      { planId: "plan-1" },
      { planId: "plan-2" },
    ]);
    await createActivity(
      { type: "discovery_call", title: "Demo", planIds: ["plan-1"], districtLeaids: ["0601234"] },
      "user-1",
    );
    const arg = mockPrisma.activity.create.mock.calls[0][0];
    const planIds = arg.data.plans.create.map((p: { planId: string }) => p.planId).sort();
    expect(planIds).toEqual(["plan-1", "plan-2"]);
  });
});

describe("updateActivity", () => {
  it("404s when missing", async () => {
    mockPrisma.activity.findUnique.mockResolvedValue(null);
    await expect(
      updateActivity("a-x", { title: "y" }, "user-1", never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("403s when not owner and not admin", async () => {
    mockPrisma.activity.findUnique.mockResolvedValue({ id: "a-1", createdByUserId: "other" });
    await expect(
      updateActivity("a-1", { title: "y" }, "user-1", never),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("allows an admin to edit another user's activity", async () => {
    mockPrisma.activity.findUnique.mockResolvedValue({ id: "a-1", createdByUserId: "other" });
    mockPrisma.activity.update.mockResolvedValue({ id: "a-1", type: "conference", title: "y", updatedAt: new Date() });
    const r = await updateActivity("a-1", { title: "y" }, "user-1", always);
    expect(r.id).toBe("a-1");
    expect(mockPrisma.activity.update).toHaveBeenCalledOnce();
  });

  it("rejects invalid type / status before writing", async () => {
    mockPrisma.activity.findUnique.mockResolvedValue({ id: "a-1", createdByUserId: "user-1" });
    await expect(
      updateActivity("a-1", { type: "not_real" }, "user-1", never),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      updateActivity("a-1", { status: "bogus" }, "user-1", never),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockPrisma.activity.update).not.toHaveBeenCalled();
  });

  it("400s when reassigning to a non-existent owner", async () => {
    mockPrisma.activity.findUnique.mockResolvedValue({ id: "a-1", createdByUserId: "user-1" });
    mockPrisma.userProfile.findUnique.mockResolvedValue(null);
    await expect(
      updateActivity("a-1", { createdByUserId: "ghost" }, "user-1", never),
    ).rejects.toMatchObject({ status: 400, message: "invalid_owner" });
  });

  it("writes scalar fields the rep changed", async () => {
    mockPrisma.activity.findUnique.mockResolvedValue({ id: "a-1", createdByUserId: "user-1" });
    mockPrisma.activity.update.mockResolvedValue({ id: "a-1", type: "discovery_call", title: "New", updatedAt: new Date() });
    await updateActivity("a-1", { title: "New", status: "completed" }, "user-1", never);
    const data = mockPrisma.activity.update.mock.calls[0][0].data;
    expect(data.title).toBe("New");
    expect(data.status).toBe("completed");
  });
});
