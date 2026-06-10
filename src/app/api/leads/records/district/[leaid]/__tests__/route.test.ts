import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    district: { findUnique: vi.fn() },
    school: { findMany: vi.fn() },
    contact: { findMany: vi.fn(), count: vi.fn() },
    lead: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
    activity: { findMany: vi.fn() },
    activityContact: { groupBy: vi.fn() },
    activitySchool: { groupBy: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, { deep: true });

import { GET } from "../route";

const TEST_USER = { id: "user-1", email: "bdr@fullmindlearning.com" };

function call(leaid = "0802940") {
  return GET(
    new NextRequest(
      new URL(`/api/leads/records/district/${leaid}`, "http://localhost:3005"),
    ),
    { params: Promise.resolve({ leaid }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue(TEST_USER);
});

describe("GET /api/leads/records/district/[leaid]", () => {
  it("401s without a user", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
  });

  it("404s when the district doesn't exist", async () => {
    mockPrisma.district.findUnique.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
  });

  it("returns the account aggregate: engaged schools, contacts, leads, attributed items", async () => {
    mockPrisma.district.findUnique.mockResolvedValue({
      leaid: "0802940",
      name: "Mesa Valley USD 51",
      cityLocation: "Grand Junction",
      stateAbbrev: "CO",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPrisma.school.findMany.mockResolvedValue([
      {
        ncessch: "080294000001",
        schoolName: "Mesa Ridge HS",
        schoolLevel: 3,
        _count: { workplaceContacts: 1 },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    mockPrisma.contact.findMany.mockResolvedValue([
      {
        id: 11,
        name: "Karen Whitfield",
        title: "Director of Special Education",
        school: null,
        leads: [{ id: "l1", status: "new" }],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    mockPrisma.contact.count.mockResolvedValue(1);
    mockPrisma.lead.findMany.mockResolvedValue([
      {
        id: "l1",
        status: "new",
        score: 120,
        leadType: "mql",
        contact: { name: "Karen Whitfield" },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    mockPrisma.lead.count.mockResolvedValue(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.lead.aggregate.mockResolvedValue({ _sum: { score: 120 } } as any);
    mockPrisma.activity.findMany.mockResolvedValue([
      {
        id: "a1",
        type: "email",
        title: "District posted an RFP",
        notes: null,
        outcome: null,
        outcomeType: null,
        source: "manual",
        startDate: new Date("2026-06-01T10:00:00Z"),
        createdAt: new Date("2026-06-01T10:00:00Z"),
        createdByUserId: null,
        contacts: [],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    mockPrisma.activityContact.groupBy.mockResolvedValue([
      { contactId: 11, _count: { activityId: 3 } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    mockPrisma.activitySchool.groupBy.mockResolvedValue([
      { ncessch: "080294000001", _count: { activityId: 2 } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.district.name).toBe("Mesa Valley USD 51");
    expect(body.stats).toEqual({ schools: 1, contacts: 1, leads: 1, points: 120 });
    expect(body.schools[0]).toMatchObject({
      ncessch: "080294000001",
      name: "Mesa Ridge HS",
      level: "High",
      contactCount: 1,
      activityCount: 2,
    });
    expect(body.contacts[0]).toMatchObject({
      id: 11,
      schoolName: null,
      leadStatus: "new",
      activityCount: 3,
    });
    expect(body.leads[0]).toMatchObject({
      id: "l1",
      contactName: "Karen Whitfield",
      score: 120,
    });
    // District-wide (no contact) → District-wide chip (default label).
    expect(body.items[0]).toMatchObject({
      attribution: "district_wide",
      attributionName: null,
    });
  });
});
