import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    lead: { findUnique: vi.fn() },
    leadEvent: { findMany: vi.fn() },
    activity: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
const mockPrisma = vi.mocked(prisma, { deep: true });

import { GET } from "../route";
import { TIMELINE_FETCH_LIMIT } from "@/features/leads/lib/server/timeline-items";

const TEST_USER = { id: "user-1", email: "bdr@fullmindlearning.com" };
const routeParams = { params: Promise.resolve({ id: "lead-1" }) };

function request() {
  return new NextRequest(new URL("/api/leads/lead-1/timeline", "http://localhost:3005"));
}

function activityFixture(overrides: Record<string, unknown>) {
  return {
    id: "act-1",
    type: "email",
    title: "Outreach",
    notes: null,
    outcome: null,
    outcomeType: null,
    source: "manual",
    startDate: new Date("2026-06-01T10:00:00Z"),
    createdAt: new Date("2026-06-01T10:00:00Z"),
    createdByUserId: "user-1",
    contacts: [],
    ...overrides,
  };
}

describe("GET /api/leads/[id]/timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: "lead-1",
      contactId: 11,
      leaid: "0612480",
      schoolNcessch: "061248006448",
    } as never);
    mockPrisma.leadEvent.findMany.mockResolvedValue([] as never);
    mockPrisma.activity.findMany.mockResolvedValue([] as never);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(request(), routeParams);
    expect(res.status).toBe(401);
  });

  it("returns 404 for a missing lead", async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);
    const res = await GET(request(), routeParams);
    expect(res.status).toBe(404);
  });

  it("queries engagement touching the lead's contact, district, AND school", async () => {
    await GET(request(), routeParams);
    const where = mockPrisma.activity.findMany.mock.calls[0][0]?.where;
    expect(where?.source).toEqual({ not: "system" });
    expect(where?.OR).toEqual([
      { contacts: { some: { contactId: 11 } } },
      { districts: { some: { districtLeaid: "0612480" } } },
      { schools: { some: { ncessch: "061248006448" } } },
    ]);
  });

  it("attributes items as own_contact / other_contact (with name) / district_wide", async () => {
    mockPrisma.activity.findMany.mockResolvedValue([
      activityFixture({
        id: "act-own",
        contacts: [{ contactId: 11, contact: { name: "Renee Alvarado" } }],
      }),
      activityFixture({
        id: "act-other",
        contacts: [{ contactId: 99, contact: { name: "Paula Reyes" } }],
      }),
      activityFixture({ id: "act-district", contacts: [] }),
    ] as never);

    const res = await GET(request(), routeParams);
    const body = await res.json();
    const byId = new Map(
      body.items.map((i: { id: string }) => [i.id, i] as const),
    );

    expect(byId.get("act-own")).toMatchObject({
      attribution: "own_contact",
      attributionName: null,
    });
    expect(byId.get("act-other")).toMatchObject({
      attribution: "other_contact",
      attributionName: "Paula Reyes",
    });
    expect(byId.get("act-district")).toMatchObject({
      attribution: "district_wide",
      attributionName: null,
    });
  });

  it("merges lifecycle events with engagement, sorted newest-first", async () => {
    mockPrisma.leadEvent.findMany.mockResolvedValue([
      {
        id: "ev-1",
        leadId: "lead-1",
        kind: "accepted",
        payload: { from: "new", to: "working" },
        actorId: "user-1",
        createdAt: new Date("2026-06-03T10:00:00Z"),
      },
    ] as never);
    mockPrisma.activity.findMany.mockResolvedValue([
      activityFixture({
        id: "act-old",
        startDate: new Date("2026-06-01T10:00:00Z"),
        contacts: [{ contactId: 11, contact: { name: "Renee" } }],
      }),
      activityFixture({
        id: "act-new",
        startDate: new Date("2026-06-05T10:00:00Z"),
        contacts: [{ contactId: 11, contact: { name: "Renee" } }],
      }),
    ] as never);

    const res = await GET(request(), routeParams);
    const body = await res.json();
    expect(body.items.map((i: { id: string }) => i.id)).toEqual([
      "act-new",
      "ev-1",
      "act-old",
    ]);
    expect(body.items[1]).toMatchObject({ itemType: "lifecycle", kind: "accepted" });
  });

  it("caps the activities query at TIMELINE_FETCH_LIMIT, newest first", async () => {
    await GET(request(), routeParams);
    const args = mockPrisma.activity.findMany.mock.calls[0][0];
    expect(args?.take).toBe(TIMELINE_FETCH_LIMIT);
    expect(args?.orderBy).toEqual({ startDate: "desc" });
  });

  it("trims the merged timeline to TIMELINE_FETCH_LIMIT and flags hasMore", async () => {
    // Activities hit the take cap exactly + lifecycle events push the merge over.
    mockPrisma.activity.findMany.mockResolvedValue(
      Array.from({ length: TIMELINE_FETCH_LIMIT }, (_, i) =>
        activityFixture({
          id: `act-${i}`,
          startDate: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
        }),
      ) as never,
    );
    mockPrisma.leadEvent.findMany.mockResolvedValue([
      {
        id: "ev-1",
        leadId: "lead-1",
        kind: "created",
        payload: null,
        actorId: "user-1",
        createdAt: new Date("2026-06-03T10:00:00Z"),
      },
    ] as never);

    const res = await GET(request(), routeParams);
    const body = await res.json();
    expect(body.items).toHaveLength(TIMELINE_FETCH_LIMIT);
    expect(body.hasMore).toBe(true);
  });

  it("reports hasMore: false for a small timeline", async () => {
    mockPrisma.activity.findMany.mockResolvedValue([activityFixture({})] as never);
    const res = await GET(request(), routeParams);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.hasMore).toBe(false);
  });
});
