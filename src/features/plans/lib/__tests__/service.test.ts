import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlan: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { createPlan, updatePlan } from "../service";
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
