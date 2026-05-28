import { describe, it, expect, vi } from "vitest";
import { buildCopilotNudges } from "../nudges-service";

const now = new Date("2026-05-27T00:00:00Z");

function makeDb(over: Record<string, unknown> = {}) {
  return {
    opportunity: { findMany: vi.fn().mockResolvedValue([]) },
    activity: { count: vi.fn().mockResolvedValue(0) },
    task: { count: vi.fn().mockResolvedValue(0) },
    territoryPlan: { findMany: vi.fn().mockResolvedValue([]) },
    territoryPlanDistrict: { findMany: vi.fn().mockResolvedValue([]) },
    ...over,
  } as never;
}

describe("buildCopilotNudges", () => {
  it("omits zero-count nudges", async () => {
    const nudges = await buildCopilotNudges("u1", makeDb(), now);
    expect(nudges).toEqual([]);
  });

  it("includes deals-slipping with a count and seed prompt", async () => {
    const db = makeDb({
      opportunity: {
        findMany: vi.fn().mockResolvedValue([
          { id: "o1", stage: "Negotiation", closeDate: new Date("2026-05-01"), netBookingAmount: null,
            name: null, districtLeaId: null, districtName: null, salesRepId: "u1", detailsLink: null,
            stageHistory: [], createdAt: new Date("2026-01-01") },
        ]),
      },
    });
    const nudges = await buildCopilotNudges("u1", db, now);
    const slipping = nudges.find((n) => n.kind === "deals_slipping");
    expect(slipping?.count).toBe(1);
    expect(slipping?.severity).toBe("risk");
    expect(slipping?.seedPrompt.length).toBeGreaterThan(0);
  });
});
