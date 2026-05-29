import { describe, it, expect, vi, beforeEach } from "vitest";

// Build a tx stub whose methods we can assert on.
const tx = {
  activity: { create: vi.fn() },
  activityPlan: { createMany: vi.fn() },
  activityDistrict: { createMany: vi.fn() },
  district: { findMany: vi.fn() },
  activityState: { createMany: vi.fn() },
  activityContact: { createMany: vi.fn() },
  territoryPlanDistrict: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  default: {
    calendarEvent: { findUnique: vi.fn(), update: vi.fn() },
    // $transaction immediately invokes the callback with our tx stub
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    territoryPlanDistrict: { findMany: vi.fn() },
  },
}));

vi.mock("@/features/integrations/lib/encryption", () => ({
  decrypt: vi.fn((v: string) => `decrypted_${v}`),
  encrypt: vi.fn((v: string) => `encrypted_${v}`),
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { confirmCalendarEvent } from "../sync";

const USER_ID = "user-123";

describe("confirmCalendarEvent auto-links plans by district", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.calendarEvent.findUnique.mockResolvedValue({
      id: "cal-1",
      userId: USER_ID,
      status: "pending",
      title: "Check-in",
      description: null,
      startTime: new Date("2026-05-01T10:00:00Z"),
      endTime: new Date("2026-05-01T11:00:00Z"),
      googleEventId: "g-1",
      suggestedActivityType: "program_check_in",
      suggestedPlanId: "plan-1",
      suggestedDistrictId: "0601234",
      suggestedContactIds: [],
    });
    mockPrisma.calendarEvent.update.mockResolvedValue({});
    tx.activity.create.mockResolvedValue({ id: "act-1" });
    tx.activityPlan.createMany.mockResolvedValue({ count: 2 });
    tx.activityDistrict.createMany.mockResolvedValue({ count: 1 });
    tx.district.findMany.mockResolvedValue([{ stateFips: "06" }]);
    tx.activityState.createMany.mockResolvedValue({ count: 1 });
    tx.activityContact.createMany.mockResolvedValue({ count: 0 });
    // District 0601234 is in plan-1 (suggested) AND plan-2 (auto)
    tx.territoryPlanDistrict.findMany.mockResolvedValue([
      { planId: "plan-1" },
      { planId: "plan-2" },
    ]);
  });

  it("attaches the suggested plan plus every other plan containing the district", async () => {
    const result = await confirmCalendarEvent(USER_ID, "cal-1");

    expect(result.activityId).toBe("act-1");

    const planArg = tx.activityPlan.createMany.mock.calls[0][0];
    const linkedPlanIds = planArg.data.map(
      (p: { planId: string }) => p.planId,
    );
    expect(linkedPlanIds.sort()).toEqual(["plan-1", "plan-2"]);

    expect(tx.territoryPlanDistrict.findMany).toHaveBeenCalled();
    expect(mockPrisma.territoryPlanDistrict.findMany).not.toHaveBeenCalled();
  });

  it("does not double-link when the district's only plan is the suggested plan", async () => {
    tx.territoryPlanDistrict.findMany.mockResolvedValue([{ planId: "plan-1" }]);

    await confirmCalendarEvent(USER_ID, "cal-1");

    const planArg = tx.activityPlan.createMany.mock.calls[0][0];
    const linkedPlanIds = planArg.data.map((p: { planId: string }) => p.planId);
    expect(linkedPlanIds).toEqual(["plan-1"]);
  });
});
