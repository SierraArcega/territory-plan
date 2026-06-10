import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    contact: { findUnique: vi.fn() },
    lead: { findMany: vi.fn() },
    activity: { count: vi.fn(), findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, { deep: true });

import { GET } from "../route";

const TEST_USER = { id: "user-1", email: "bdr@fullmindlearning.com" };

function request() {
  return new NextRequest(
    new URL("/api/leads/records/contact/11", "http://localhost:3005"),
  );
}

function call(id = "11") {
  return GET(request(), { params: Promise.resolve({ id }) });
}

function activityFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    type: "email",
    title: "Replied to Q2 outreach",
    notes: null,
    outcome: null,
    outcomeType: null,
    source: "manual",
    startDate: new Date("2026-06-01T10:00:00Z"),
    createdAt: new Date("2026-06-01T10:00:00Z"),
    createdByUserId: "user-1",
    contacts: [{ contactId: 11, contact: { name: "Karen Whitfield" } }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue(TEST_USER);
});

describe("GET /api/leads/records/contact/[id]", () => {
  it("401s without a user", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
  });

  it("400s on a non-numeric id", async () => {
    const res = await call("abc");
    expect(res.status).toBe(400);
  });

  it("404s when the contact doesn't exist", async () => {
    mockPrisma.contact.findUnique.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
  });

  it("returns the contact aggregate: details, active lead, points = lead-score sum, own-contact items", async () => {
    mockPrisma.contact.findUnique.mockResolvedValue({
      id: 11,
      name: "Karen Whitfield",
      title: "Director of Special Education",
      email: "k@mesa.org",
      phone: null,
      school: { ncessch: "080294000001", schoolName: "Mesa Ridge HS", schoolLevel: 3 },
      district: {
        leaid: "0802940",
        name: "Mesa Valley USD 51",
        cityLocation: "Grand Junction",
        stateAbbrev: "CO",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPrisma.lead.findMany.mockResolvedValue([
      // Most recent first — but the ACTIVE lead must win the "lead" slot.
      { id: "l2", status: "unqualified", score: 30, leadType: "mql", unqualifiedReason: "No Response" },
      { id: "l1", status: "working", score: 120, leadType: "mql", unqualifiedReason: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    mockPrisma.activity.count.mockResolvedValue(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.activity.findMany.mockResolvedValue([activityFixture()] as any);

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contact.name).toBe("Karen Whitfield");
    expect(body.school).toEqual({ ncessch: "080294000001", name: "Mesa Ridge HS" });
    expect(body.district.leaid).toBe("0802940");
    expect(body.lead.id).toBe("l1"); // active beats most-recent unqualified
    expect(body.stats).toEqual({ activities: 2, points: 150 }); // 120 + 30
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      itemType: "engagement",
      attribution: "own_contact",
      attributionName: null,
    });
  });
});
