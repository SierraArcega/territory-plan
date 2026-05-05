import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock getUser and isAdmin
const mockGetUser = vi.fn();
const mockIsAdmin = vi.fn().mockResolvedValue(false);
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  isAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    activity: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    activityPlan: { findFirst: vi.fn() },
    district: { findMany: vi.fn() },
    territoryPlanDistrict: { findMany: vi.fn() },
    userProfile: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  },
}));

// Mock calendar push functions (they're fire-and-forget, just need to exist)
vi.mock("@/features/calendar/lib/push", () => ({
  pushActivityToCalendar: vi.fn(),
  updateActivityOnCalendar: vi.fn(),
  deleteActivityFromCalendar: vi.fn(),
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { GET as listActivities, POST } from "../route";
import { GET as getActivity, PATCH, DELETE } from "../[id]/route";

const TEST_USER = { id: "user-1", email: "test@example.com" };

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

// Helper to build a raw activity row as Prisma would return from findMany (list view)
function makeListActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: "activity-1",
    type: "conference",
    title: "Test Conference",
    startDate: new Date("2026-03-01T10:00:00Z"),
    endDate: new Date("2026-03-01T12:00:00Z"),
    status: "planned",
    source: "manual",
    outcomeType: null,
    notes: null,
    outcome: null,
    createdByUserId: "user-1",
    plans: [] as { planId: string }[],
    districts: [] as {
      districtLeaid: string;
      warningDismissed: boolean;
      position?: number;
      district?: { name: string };
    }[],
    contacts: [] as { contact: { name: string } }[],
    states: [] as { state: { abbrev: string } }[],
    ...overrides,
  };
}

// Helper to build a full activity row as Prisma would return from findUnique (detail view)
function makeDetailActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: "activity-1",
    type: "conference",
    title: "Test Conference",
    notes: "Some notes",
    startDate: new Date("2026-03-01T10:00:00Z"),
    endDate: new Date("2026-03-01T12:00:00Z"),
    status: "planned",
    googleEventId: null,
    source: "manual",
    outcome: null,
    outcomeType: null,
    metadata: null,
    createdByUserId: "user-1",
    createdAt: new Date("2026-02-20T00:00:00Z"),
    updatedAt: new Date("2026-02-20T00:00:00Z"),
    plans: [
      {
        planId: "plan-1",
        plan: { id: "plan-1", name: "Q1 Plan", color: "#ff0000" },
      },
    ],
    districts: [
      {
        districtLeaid: "1234567",
        warningDismissed: false,
        visitDate: null,
        visitEndDate: null,
        position: 0,
        notes: null,
        district: { leaid: "1234567", name: "Test District", stateAbbrev: "CA" },
      },
    ],
    contacts: [
      {
        contactId: 1,
        contact: { id: 1, name: "John Doe", title: "Superintendent" },
      },
    ],
    states: [
      {
        stateFips: "06",
        isExplicit: false,
        state: { fips: "06", abbrev: "CA", name: "California" },
      },
    ],
    rating: null,
    expenses: [],
    attendees: [],
    relations: [],
    relatedTo: [],
    opportunities: [],
    ...overrides,
  };
}

describe("GET /api/activities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const req = makeRequest("/api/activities");
    const res = await listActivities(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns activities for authenticated user", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);

    const activity = makeListActivity();
    mockPrisma.activity.count.mockResolvedValue(1);
    mockPrisma.activity.findMany.mockResolvedValue([activity] as never);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const req = makeRequest("/api/activities");
    const res = await listActivities(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities).toHaveLength(1);
    expect(body.activities[0].id).toBe("activity-1");
    expect(body.activities[0].type).toBe("conference");
    expect(body.activities[0].category).toBe("events");
    expect(body.activities[0].title).toBe("Test Conference");
    expect(body.total).toBe(1);
    expect(body.totalInDb).toBe(1);

    // Verify scoped to user
    expect(mockPrisma.activity.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdByUserId: "user-1" }),
      })
    );
  });

  it("filters by category", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.count.mockResolvedValue(0);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const req = makeRequest("/api/activities?category=meetings");
    await listActivities(req);

    // The where clause should filter by type IN the meetings category types
    expect(mockPrisma.activity.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: {
            in: ["discovery_call", "program_check_in", "proposal_review", "renewal_conversation"],
          },
        }),
      })
    );
  });

  it("filters by planId", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.count.mockResolvedValue(0);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const req = makeRequest("/api/activities?planId=plan-42");
    await listActivities(req);

    expect(mockPrisma.activity.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          plans: { some: { planId: "plan-42" } },
        }),
      })
    );
  });

  it("filters by status", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.count.mockResolvedValue(0);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const req = makeRequest("/api/activities?status=completed");
    await listActivities(req);

    expect(mockPrisma.activity.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "completed",
        }),
      })
    );
  });

  it("parses multi-value status as IN clause", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.count.mockResolvedValue(0);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const req = makeRequest("/api/activities?status=completed,in_progress");
    await listActivities(req);

    expect(mockPrisma.activity.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["completed", "in_progress"] },
        }),
      })
    );
  });

  it("parses multi-value owner as createdByUserId IN", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.count.mockResolvedValue(0);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const req = makeRequest("/api/activities?owner=user-1,user-2");
    await listActivities(req);

    expect(mockPrisma.activity.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdByUserId: { in: ["user-1", "user-2"] },
        }),
      })
    );
  });

  it("filters by state via the new `state` query param", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.count.mockResolvedValue(0);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const req = makeRequest("/api/activities?state=CA,NY");
    await listActivities(req);

    expect(mockPrisma.activity.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          states: { some: { state: { abbrev: { in: ["CA", "NY"] } } } },
        }),
      })
    );
  });

  it("treats legacy `stateCode` param as `state`", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.count.mockResolvedValue(0);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const req = makeRequest("/api/activities?stateCode=CA");
    await listActivities(req);

    expect(mockPrisma.activity.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          states: { some: { state: { abbrev: { in: ["CA"] } } } },
        }),
      })
    );
  });

  it("returns 500 on error", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.count.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("/api/activities");
    const res = await listActivities(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch activities");
  });

  it("search matches notes (broadened OR clause)", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.count.mockResolvedValue(1);
    mockPrisma.activity.findMany.mockResolvedValue([
      makeListActivity({ notes: "discussed pilot" }),
    ] as never);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const req = makeRequest("/api/activities?search=pilot");
    await listActivities(req);

    const where = mockPrisma.activity.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: expect.objectContaining({ contains: "pilot" }) }),
        expect.objectContaining({ notes: expect.objectContaining({ contains: "pilot" }) }),
        expect.objectContaining({ outcome: expect.objectContaining({ contains: "pilot" }) }),
      ])
    );
  });

  it("?contactIds= filters by contact junction", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.count.mockResolvedValue(0);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const req = makeRequest("/api/activities?contactIds=1,2");
    await listActivities(req);

    const where = mockPrisma.activity.findMany.mock.calls[0][0].where;
    expect(where.contacts).toEqual({ some: { contactId: { in: [1, 2] } } });
  });

  it("?sortBy=title&sortDir=asc orders by title ascending", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.count.mockResolvedValue(0);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const req = makeRequest("/api/activities?sortBy=title&sortDir=asc");
    await listActivities(req);

    const orderBy = mockPrisma.activity.findMany.mock.calls[0][0].orderBy;
    expect(orderBy).toEqual([{ title: "asc" }]);
  });

  it("response includes denormalized Table-view fields", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.count.mockResolvedValue(1);
    mockPrisma.activity.findMany.mockResolvedValue([
      makeListActivity({
        notes: "Some notes",
        outcome: null,
        createdByUserId: "user-1",
        districts: [
          {
            districtLeaid: "1234567",
            warningDismissed: false,
            position: 0,
            district: { name: "Test District" },
          },
        ],
        contacts: [{ contact: { name: "Jane Doe" } }],
      }),
    ] as never);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);
    mockPrisma.userProfile.findMany.mockResolvedValue([
      { id: "user-1", fullName: "Sierra A.", email: "sierra@test.com" },
    ] as never);

    const req = makeRequest("/api/activities");
    const res = await listActivities(req);
    const body = await res.json();

    expect(body.activities[0].districtName).toBe("Test District");
    expect(body.activities[0].contactName).toBe("Jane Doe");
    expect(body.activities[0].ownerFullName).toBe("Sierra A.");
    expect(body.activities[0].createdByUserId).toBe("user-1");
  });

  it("outcomePreview truncates at 80 chars with ellipsis", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    const longText = "a".repeat(120);
    mockPrisma.activity.count.mockResolvedValue(1);
    mockPrisma.activity.findMany.mockResolvedValue([
      makeListActivity({ outcome: longText, notes: null }),
    ] as never);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const req = makeRequest("/api/activities");
    const res = await listActivities(req);
    const body = await res.json();

    expect(body.activities[0].outcomePreview).toBe(`${"a".repeat(80)}…`);
  });

  it("outcomePreview falls back to notes when outcome is empty", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.count.mockResolvedValue(1);
    mockPrisma.activity.findMany.mockResolvedValue([
      makeListActivity({ outcome: null, notes: "Short note" }),
    ] as never);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const req = makeRequest("/api/activities");
    const res = await listActivities(req);
    const body = await res.json();

    expect(body.activities[0].outcomePreview).toBe("Short note");
  });
});

describe("POST /api/activities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const req = makeRequest("/api/activities", {
      method: "POST",
      body: JSON.stringify({ type: "conference", title: "Test" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when type is missing", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);

    const req = makeRequest("/api/activities", {
      method: "POST",
      body: JSON.stringify({ title: "Test" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("type and title are required");
  });

  it("returns 400 when title is missing", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);

    const req = makeRequest("/api/activities", {
      method: "POST",
      body: JSON.stringify({ type: "conference" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("type and title are required");
  });

  it("returns 400 for invalid type", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);

    const req = makeRequest("/api/activities", {
      method: "POST",
      body: JSON.stringify({ type: "invalid_type", title: "Test" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid activity type: invalid_type");
  });

  it("returns 400 for invalid status", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);

    const req = makeRequest("/api/activities", {
      method: "POST",
      body: JSON.stringify({
        type: "conference",
        title: "Test",
        status: "bogus",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("status must be one of:");
  });

  it("creates activity with relations", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);

    // Mock district lookup for state derivation
    mockPrisma.district.findMany.mockResolvedValue([
      { stateFips: "06" },
    ] as never);

    const createdActivity = {
      id: "new-activity-1",
      type: "discovery_call",
      title: "Product Demo",
      notes: null,
      startDate: new Date("2026-04-01T14:00:00Z"),
      endDate: new Date("2026-04-01T15:00:00Z"),
      status: "planned",
      metadata: null,
      createdByUserId: "user-1",
      createdAt: new Date("2026-02-23T00:00:00Z"),
      updatedAt: new Date("2026-02-23T00:00:00Z"),
      plans: [
        {
          planId: "plan-1",
          plan: { id: "plan-1", name: "Q1 Plan", color: "#ff0000" },
        },
      ],
      districts: [
        {
          districtLeaid: "0601234",
          warningDismissed: false,
          visitDate: null,
          visitEndDate: null,
          position: 0,
          notes: null,
          district: { leaid: "0601234", name: "LA Unified", stateAbbrev: "CA" },
        },
      ],
      contacts: [],
      states: [
        {
          stateFips: "06",
          isExplicit: false,
          state: { fips: "06", abbrev: "CA", name: "California" },
        },
      ],
      expenses: [],
      attendees: [],
      relations: [],
      relatedTo: [],
    };
    mockPrisma.activity.create.mockResolvedValue(createdActivity as never);

    const req = makeRequest("/api/activities", {
      method: "POST",
      body: JSON.stringify({
        type: "discovery_call",
        title: "Product Demo",
        startDate: "2026-04-01T14:00:00Z",
        endDate: "2026-04-01T15:00:00Z",
        planIds: ["plan-1"],
        districtLeaids: ["0601234"],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("new-activity-1");
    expect(body.type).toBe("discovery_call");
    expect(body.category).toBe("meetings");
    expect(body.title).toBe("Product Demo");
    expect(body.plans).toHaveLength(1);
    expect(body.plans[0].planId).toBe("plan-1");
    expect(body.districts).toHaveLength(1);
    expect(body.districts[0].leaid).toBe("0601234");
    expect(body.states).toHaveLength(1);
    expect(body.states[0].abbrev).toBe("CA");
    expect(body.needsPlanAssociation).toBe(false);

    // Verify prisma.activity.create was called with correct nested structure
    expect(mockPrisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "discovery_call",
          title: "Product Demo",
          createdByUserId: "user-1",
          plans: { create: [{ planId: "plan-1" }] },
          districts: {
            create: [expect.objectContaining({ districtLeaid: "0601234", warningDismissed: false })],
          },
        }),
      })
    );
  });

  it("returns 500 on error", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.create.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("/api/activities", {
      method: "POST",
      body: JSON.stringify({ type: "conference", title: "Test" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to create activity: DB error");
  });
});

describe("GET /api/activities/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const req = makeRequest("/api/activities/activity-1");
    const res = await getActivity(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when activity not found", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue(null);

    const req = makeRequest("/api/activities/nonexistent");
    const res = await getActivity(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Activity not found");
  });

  it("returns 403 when user does not own activity", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue(
      makeDetailActivity({ createdByUserId: "other-user" }) as never
    );
    mockPrisma.activityPlan.findFirst.mockResolvedValue(null);

    const req = makeRequest("/api/activities/activity-1");
    const res = await getActivity(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Not authorized to view this activity");
  });

  it("allows admin to view another user's activity", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockIsAdmin.mockResolvedValueOnce(true);
    mockPrisma.activity.findUnique.mockResolvedValue(
      makeDetailActivity({ createdByUserId: "other-user" }) as never
    );
    mockPrisma.activityPlan.findFirst.mockResolvedValue(null);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([
      { planId: "plan-1", districtLeaid: "1234567" },
    ] as never);

    const req = makeRequest("/api/activities/activity-1");
    const res = await getActivity(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("activity-1");
  });

  it("returns activity detail with computed flags", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue(
      makeDetailActivity() as never
    );
    // The district "1234567" IS in plan-1's districts
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([
      { planId: "plan-1", districtLeaid: "1234567" },
    ] as never);

    const req = makeRequest("/api/activities/activity-1");
    const res = await getActivity(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("activity-1");
    expect(body.type).toBe("conference");
    expect(body.category).toBe("events");
    expect(body.title).toBe("Test Conference");
    expect(body.needsPlanAssociation).toBe(false);
    expect(body.hasUnlinkedDistricts).toBe(false);
    expect(body.districts[0].isInPlan).toBe(true);
    expect(body.plans).toHaveLength(1);
    expect(body.contacts).toHaveLength(1);
    expect(body.states).toHaveLength(1);
    expect(body.states[0].abbrev).toBe("CA");
  });
});

describe("PATCH /api/activities/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const req = makeRequest("/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when activity not found", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue(null);

    const req = makeRequest("/api/activities/nonexistent", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Activity not found");
  });

  it("returns 403 when user does not own activity", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "other-user",
    } as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Not authorized to edit this activity");
  });

  it("allows admin to edit another user's activity", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockIsAdmin.mockResolvedValueOnce(true);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "other-user",
    } as never);

    const updatedActivity = {
      id: "activity-1",
      type: "conference",
      title: "Admin Updated",
      updatedAt: new Date("2026-02-23T12:00:00Z"),
      rating: null,
    };
    mockPrisma.activity.update.mockResolvedValue(updatedActivity as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Admin Updated" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Admin Updated");
  });

  it("returns 400 for invalid type", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "user-1",
    } as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({ type: "not_a_real_type" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid activity type: not_a_real_type");
  });

  it("returns 400 for invalid status", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "user-1",
    } as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "invalid_status" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("status must be one of:");
  });

  it("updates activity fields", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "user-1",
    } as never);

    const updatedActivity = {
      id: "activity-1",
      type: "discovery_call",
      title: "Updated Demo",
      updatedAt: new Date("2026-02-23T12:00:00Z"),
    };
    mockPrisma.activity.update.mockResolvedValue(updatedActivity as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({
        type: "discovery_call",
        title: "Updated Demo",
        status: "completed",
      }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("activity-1");
    expect(body.type).toBe("discovery_call");
    expect(body.title).toBe("Updated Demo");
    expect(body.updatedAt).toBeDefined();

    // Verify the update call was made with correct data
    expect(mockPrisma.activity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "activity-1" },
        data: expect.objectContaining({
          type: "discovery_call",
          title: "Updated Demo",
          status: "completed",
        }),
      })
    );
  });

  it("returns 400 for invalid sentiment", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "user-1",
    } as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({ sentiment: "ecstatic" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("sentiment must be one of:");
  });

  it("returns 400 for invalid dealImpact", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "user-1",
    } as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({ dealImpact: "exploded" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("dealImpact must be one of:");
  });

  it("returns 400 for invalid outcomeDisposition", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "user-1",
    } as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({ outcomeDisposition: "ghosted" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("outcomeDisposition must be one of:");
  });

  it("persists redesigned outcome fields", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "user-1",
    } as never);

    mockPrisma.activity.update.mockResolvedValue({
      id: "activity-1",
      type: "discovery_call",
      title: "Demo",
      updatedAt: new Date("2026-02-23T12:00:00Z"),
    } as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({
        sentiment: "positive",
        nextStep: "send pricing",
        followUpDate: "2026-05-01T00:00:00Z",
        dealImpact: "progressed",
        outcomeDisposition: "completed",
      }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.activity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sentiment: "positive",
          nextStep: "send pricing",
          dealImpact: "progressed",
          outcomeDisposition: "completed",
        }),
      })
    );

    const callArgs = mockPrisma.activity.update.mock.calls[0][0];
    expect(callArgs.data.followUpDate).toBeInstanceOf(Date);
  });

  it("clears nullable outcome fields when empty string is sent", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "user-1",
    } as never);

    mockPrisma.activity.update.mockResolvedValue({
      id: "activity-1",
      type: "discovery_call",
      title: "Demo",
      updatedAt: new Date("2026-02-23T12:00:00Z"),
    } as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({
        sentiment: "",
        nextStep: "",
        followUpDate: null,
        outcomeDisposition: "",
      }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(200);
    const data = mockPrisma.activity.update.mock.calls[0][0].data;
    expect(data.sentiment).toBeNull();
    expect(data.nextStep).toBeNull();
    expect(data.followUpDate).toBeNull();
    expect(data.outcomeDisposition).toBeNull();
  });

  it("allows owner to reassign their own activity to another user", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "user-1",
    } as never);
    mockPrisma.userProfile.findUnique.mockResolvedValue({ id: "user-2" } as never);
    mockPrisma.activity.update.mockResolvedValue({
      id: "activity-1",
      title: "Reassigned",
      createdByUserId: "user-2",
      updatedAt: new Date("2026-02-23T12:00:00Z"),
    } as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({ createdByUserId: "user-2" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(200);
    const data = mockPrisma.activity.update.mock.calls[0][0].data;
    expect(data.createdByUserId).toBe("user-2");
  });

  it("returns 400 when reassigning to a non-existent user", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "user-1",
    } as never);
    mockPrisma.userProfile.findUnique.mockResolvedValue(null as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({ createdByUserId: "ghost-user" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_owner");
  });

  it("returns 403 when non-owner non-admin attempts to reassign", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockIsAdmin.mockResolvedValueOnce(false);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "other-user",
    } as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({ createdByUserId: "user-2" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/activities/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const req = makeRequest("/api/activities/activity-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when activity not found", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue(null);

    const req = makeRequest("/api/activities/nonexistent", {
      method: "DELETE",
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Activity not found");
  });

  it("returns 403 when user does not own activity", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "other-user",
      googleEventId: null,
    } as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Not authorized to delete this activity");
  });

  it("allows admin to delete another user's activity", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockIsAdmin.mockResolvedValueOnce(true);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "other-user",
      googleEventId: null,
    } as never);
    mockPrisma.activity.delete.mockResolvedValue({} as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("deletes activity successfully", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "activity-1",
      createdByUserId: "user-1",
      googleEventId: null,
    } as never);
    mockPrisma.activity.delete.mockResolvedValue({} as never);

    const req = makeRequest("/api/activities/activity-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockPrisma.activity.delete).toHaveBeenCalledWith({
      where: { id: "activity-1" },
    });
  });
});
