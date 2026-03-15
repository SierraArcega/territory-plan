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

import { GET } from "../suggestions/route";
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
