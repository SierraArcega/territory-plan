import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    school: { findUnique: vi.fn() },
    contact: { findMany: vi.fn(), count: vi.fn() },
    activity: { count: vi.fn(), findMany: vi.fn() },
    lead: { aggregate: vi.fn() },
    activityContact: { groupBy: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, { deep: true });

import { GET } from "../route";

const TEST_USER = { id: "user-1", email: "bdr@fullmindlearning.com" };

function call(ncessch = "080294000001") {
  return GET(
    new NextRequest(
      new URL(`/api/leads/records/school/${ncessch}`, "http://localhost:3005"),
    ),
    { params: Promise.resolve({ ncessch }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue(TEST_USER);
});

describe("GET /api/leads/records/school/[ncessch]", () => {
  it("401s without a user", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
  });

  it("404s when the school doesn't exist", async () => {
    mockPrisma.school.findUnique.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
  });

  it("returns the school aggregate with per-contact counts and School-wide attribution", async () => {
    mockPrisma.school.findUnique.mockResolvedValue({
      ncessch: "080294000001",
      schoolName: "Mesa Ridge HS",
      schoolLevel: 3,
      district: {
        leaid: "0802940",
        name: "Mesa Valley USD 51",
        cityLocation: "Grand Junction",
        stateAbbrev: "CO",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPrisma.contact.findMany.mockResolvedValue([
      {
        id: 11,
        name: "Paula Reyes",
        title: "Principal",
        leads: [{ id: "l1", status: "working" }],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    mockPrisma.contact.count.mockResolvedValue(1);
    mockPrisma.activity.count.mockResolvedValue(2);
    mockPrisma.activity.findMany.mockResolvedValue([
      {
        id: "a1",
        type: "webinar",
        title: "Attended webinar",
        notes: null,
        outcome: null,
        outcomeType: null,
        source: "manual",
        startDate: new Date("2026-06-01T10:00:00Z"),
        createdAt: new Date("2026-06-01T10:00:00Z"),
        createdByUserId: null,
        contacts: [{ contactId: 11, contact: { name: "Paula Reyes" } }],
      },
      {
        id: "a2",
        type: "email",
        title: "School-level signal",
        notes: null,
        outcome: null,
        outcomeType: null,
        source: "manual",
        startDate: new Date("2026-05-20T10:00:00Z"),
        createdAt: new Date("2026-05-20T10:00:00Z"),
        createdByUserId: null,
        contacts: [],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.lead.aggregate.mockResolvedValue({ _sum: { score: 95 } } as any);
    mockPrisma.activityContact.groupBy.mockResolvedValue([
      { contactId: 11, _count: { activityId: 1 } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.school).toEqual({
      ncessch: "080294000001",
      name: "Mesa Ridge HS",
      level: "High",
    });
    expect(body.stats).toEqual({ contacts: 1, activities: 2, points: 95 });
    expect(body.contacts[0]).toMatchObject({
      id: 11,
      leadStatus: "working",
      activityCount: 1,
    });
    // Contact-linked items show the contact's name; no-contact items are
    // school-wide signals.
    expect(body.items[0]).toMatchObject({
      attribution: "other_contact",
      attributionName: "Paula Reyes",
    });
    expect(body.items[1]).toMatchObject({
      attribution: "district_wide",
      attributionName: "School-wide",
    });
  });
});
