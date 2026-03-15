import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ getUser: (...args: unknown[]) => mockGetUser(...args) }));

vi.mock("@/lib/prisma", () => ({
  default: {
    userGoal: { findFirst: vi.fn() },
    activity: { findMany: vi.fn() },
    territoryPlan: { findMany: vi.fn() },
    suggestionFeedback: { create: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
const mockPrisma = vi.mocked(prisma);

import { GET, buildSuggestions } from "../suggestions/route";
import { POST } from "../suggestions/feedback/route";

const TEST_USER = { id: "user-1" };

function makeGetRequest() {
  return new NextRequest(new URL("http://localhost:3000/api/lineup/suggestions"));
}

function makePostRequest() {
  return new NextRequest(new URL("http://localhost:3000/api/lineup/suggestions/feedback"), {
    method: "POST",
  });
}

// A plan with one district that hasn't been contacted
const activePlan = {
  id: "plan-1",
  name: "Colorado Plan",
  districts: [
    {
      districtLeaid: "0812345",
      district: { name: "Jeffco SD", leaid: "0812345" },
    },
  ],
};

// Renewal goal significantly behind
const renewalGoal = {
  id: "goal-1",
  userId: "user-1",
  fiscalYear: new Date().getFullYear(),
  renewalTarget: 500000,
  renewalActual: 200000, // 40% — well behind
  earningsTarget: 800000,
  takeActual: 300000,
  winbackTarget: 50000,
  expansionTarget: 100000,
  newBusinessTarget: 150000,
  pipelineActual: 200000,
};

describe("GET /api/lineup/suggestions", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.userGoal.findFirst.mockResolvedValue(null);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlan.findMany.mockResolvedValue([]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns suggestions using DEFAULT rule when no goals are set", async () => {
    mockPrisma.userGoal.findFirst.mockResolvedValue(null);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlan.findMany.mockResolvedValue([activePlan]);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.suggestions).toHaveLength(1);
    expect(json.suggestions[0].districtLeaid).toBe("0812345");
    expect(json.suggestions[0].opportunityType).toBeDefined();
  });

  it("prioritises RENEWAL_BEHIND rule when renewal goal is behind", async () => {
    mockPrisma.userGoal.findFirst.mockResolvedValue(renewalGoal);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlan.findMany.mockResolvedValue([activePlan]);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.suggestions[0].opportunityType).toBe("renewal");
    expect(json.suggestions[0].reasoning).toMatch(/renewal/i);
  });

  it("returns empty array when no active plans", async () => {
    mockPrisma.userGoal.findFirst.mockResolvedValue(renewalGoal);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlan.findMany.mockResolvedValue([]);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.suggestions).toEqual([]);
  });
});

describe("POST /api/lineup/suggestions/feedback", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.suggestionFeedback.create.mockResolvedValue({ id: "fb-1", userId: "user-1", createdAt: new Date() });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(makePostRequest());
    expect(res.status).toBe(401);
  });

  it("creates a SuggestionFeedback record", async () => {
    const res = await POST(makePostRequest());
    expect(res.status).toBe(200);
    expect(mockPrisma.suggestionFeedback.create).toHaveBeenCalledWith({
      data: { userId: "user-1" },
    });
  });
});

// ======== Direct unit tests for the buildSuggestions rules engine ========

const TODAY = "2026-03-14";

// Helper to create a plan with one district
function makePlan(leaid: string, name: string, contractValue: number | null = null) {
  return {
    id: `plan-${leaid}`,
    name: "Test Plan",
    districts: [{ districtLeaid: leaid, districtName: name, contractValue }],
  };
}

// Helper to create a contact record
function makeContact(leaid: string, daysAgo: number, isRenewal = false) {
  const date = new Date(TODAY);
  date.setDate(date.getDate() - daysAgo);
  return {
    districtLeaid: leaid,
    lastActivityDate: date.toISOString(),
    lastRenewalDate: isRenewal ? date.toISOString() : null,
  };
}

describe("buildSuggestions", () => {
  it("returns empty array when no plans", () => {
    const result = buildSuggestions({
      userGoal: null,
      recentActivities: [],
      activePlans: [],
      today: TODAY,
    });
    expect(result).toEqual([]);
  });

  it("RENEWAL_BEHIND: suggests renewal call when renewal goal is behind 90%", () => {
    const result = buildSuggestions({
      userGoal: { renewalTarget: 100000, renewalActual: 50000, pipelineActual: 0, winbackTarget: 0, expansionTarget: 0, newBusinessTarget: 0 },
      recentActivities: [],
      activePlans: [makePlan("001", "District A")],
      today: TODAY,
    });
    expect(result).toHaveLength(1);
    expect(result[0].opportunityType).toBe("renewal");
    expect(result[0].goalTags).toContain("Renewal goal");
    expect(result[0].reasoning).toMatch(/renewal/i);
  });

  it("PIPELINE_BEHIND: suggests expansion when pipeline is behind 90%", () => {
    const result = buildSuggestions({
      userGoal: {
        renewalTarget: 100000,
        renewalActual: 100000, // renewal on track
        pipelineActual: 10000,
        winbackTarget: 50000,
        expansionTarget: 50000,
        newBusinessTarget: 0,
      },
      recentActivities: [],
      activePlans: [makePlan("002", "District B")],
      today: TODAY,
    });
    expect(result).toHaveLength(1);
    expect(result[0].opportunityType).toBe("expansion");
    expect(result[0].goalTags).toContain("Pipeline goal");
  });

  it("LONG_DORMANT: flags districts not contacted in 45+ days when no goals", () => {
    const result = buildSuggestions({
      userGoal: null,
      recentActivities: [makeContact("003", 50)], // contacted 50 days ago
      activePlans: [makePlan("003", "District C")],
      today: TODAY,
    });
    expect(result).toHaveLength(1);
    expect(result[0].riskTags).toContain("Dormant");
  });

  it("does NOT flag LONG_DORMANT for district contacted 30 days ago", () => {
    const result = buildSuggestions({
      userGoal: null,
      recentActivities: [makeContact("004", 30)], // 30 days — below 45-day LONG_DORMANT threshold
      activePlans: [makePlan("004", "District D")],
      today: TODAY,
    });
    // 30 days falls into DEFAULT (14+) but not LONG_DORMANT (45+)
    expect(result[0].riskTags).not.toContain("Dormant");
  });

  it("deduplicates: same district appears at most once across rules", () => {
    // Both RENEWAL_BEHIND and PIPELINE_BEHIND would suggest the same district
    const result = buildSuggestions({
      userGoal: {
        renewalTarget: 100000,
        renewalActual: 10000,
        pipelineActual: 10000,
        winbackTarget: 50000,
        expansionTarget: 50000,
        newBusinessTarget: 0,
      },
      recentActivities: [],
      activePlans: [makePlan("005", "District E")],
      today: TODAY,
    });
    const leaids = result.map((s) => s.districtLeaid);
    expect(new Set(leaids).size).toBe(leaids.length); // no duplicates
  });

  it("caps results at maxCount (default 3)", () => {
    const plans = ["001", "002", "003", "004"].map((leaid) =>
      makePlan(leaid, `District ${leaid}`)
    );
    const result = buildSuggestions({
      userGoal: null,
      recentActivities: [],
      activePlans: plans,
      today: TODAY,
      maxCount: 3,
    });
    expect(result.length).toBeLessThanOrEqual(3);
  });
});
