import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlan: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    contact: {
      groupBy: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { GET } from "../route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;
const mockGetUser = vi.mocked(getUser);

function buildRequest(id: string) {
  return new NextRequest(
    `http://localhost/api/territory-plans/${id}/contact-sources`,
    { method: "GET" }
  );
}

function call(id: string) {
  return GET(buildRequest(id), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ id: "user-1" } as Awaited<
    ReturnType<typeof getUser>
  >);
});

describe("GET /api/territory-plans/[id]/contact-sources", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValueOnce(null);

    const res = await call("plan-1");
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: "Authentication required" });
  });

  it("returns 404 when the plan is not found", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);

    const res = await call("missing-plan");

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toEqual({ error: "Territory plan not found" });
  });

  it("returns { plans: [] } when the current plan has no districts", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({
      id: "plan-1",
      districts: [],
    });

    const res = await call("plan-1");
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ plans: [] });
    // Should short-circuit before querying candidates or contacts
    expect(mockPrisma.territoryPlan.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.contact.groupBy).not.toHaveBeenCalled();
  });

  it("returns { plans: [] } when no other plan shares any district", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({
      id: "plan-1",
      districts: [{ districtLeaid: "0100001" }],
    });
    mockPrisma.territoryPlan.findMany.mockResolvedValue([]);

    const res = await call("plan-1");
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ plans: [] });
    // groupBy should be skipped when no candidates exist
    expect(mockPrisma.contact.groupBy).not.toHaveBeenCalled();
  });

  it("returns { plans: [] } when overlapping plans exist but no shared district has contacts", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({
      id: "plan-1",
      districts: [{ districtLeaid: "0100001" }],
    });
    mockPrisma.territoryPlan.findMany.mockResolvedValue([
      {
        id: "plan-2",
        name: "Other Plan",
        ownerUser: { id: "user-2", fullName: "Rep Two" },
        districts: [{ districtLeaid: "0100001" }],
      },
    ]);
    mockPrisma.contact.groupBy.mockResolvedValue([]); // no contacts on that leaid

    const res = await call("plan-1");
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ plans: [] });
  });

  it("returns the correctly-shaped row on the single-overlap happy path", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({
      id: "plan-1",
      districts: [
        { districtLeaid: "0100001" },
        { districtLeaid: "0100002" },
      ],
    });
    mockPrisma.territoryPlan.findMany.mockResolvedValue([
      {
        id: "plan-2",
        name: "Alpha Plan",
        ownerUser: { id: "user-2", fullName: "Rep Two" },
        districts: [{ districtLeaid: "0100001" }],
      },
    ]);
    const lastEnriched = new Date("2026-04-01T12:00:00.000Z");
    mockPrisma.contact.groupBy.mockResolvedValue([
      {
        leaid: "0100001",
        _count: { _all: 5 },
        _max: { lastEnrichedAt: lastEnriched },
      },
    ]);

    const res = await call("plan-1");
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      plans: [
        {
          id: "plan-2",
          name: "Alpha Plan",
          ownerName: "Rep Two",
          sharedDistrictCount: 1,
          contactCount: 5,
          lastEnrichedAt: "2026-04-01T12:00:00.000Z",
        },
      ],
    });
    // Excludes self + scopes to current plan's leaids
    expect(mockPrisma.territoryPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "plan-1" },
          districts: {
            some: { districtLeaid: { in: ["0100001", "0100002"] } },
          },
        }),
      })
    );
  });

  it("ranks by contactCount DESC, then lastEnrichedAt DESC NULLS LAST", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({
      id: "plan-1",
      districts: [
        { districtLeaid: "L1" },
        { districtLeaid: "L2" },
        { districtLeaid: "L3" },
      ],
    });
    // Candidate A: 12 contacts (L1)
    // Candidate B: 5 contacts (L2), enriched more recently → should come before C
    // Candidate C: 5 contacts (L3), enriched earlier
    mockPrisma.territoryPlan.findMany.mockResolvedValue([
      {
        id: "plan-c",
        name: "Plan C",
        ownerUser: null,
        districts: [{ districtLeaid: "L3" }],
      },
      {
        id: "plan-a",
        name: "Plan A",
        ownerUser: null,
        districts: [{ districtLeaid: "L1" }],
      },
      {
        id: "plan-b",
        name: "Plan B",
        ownerUser: null,
        districts: [{ districtLeaid: "L2" }],
      },
    ]);
    mockPrisma.contact.groupBy.mockResolvedValue([
      {
        leaid: "L1",
        _count: { _all: 12 },
        _max: { lastEnrichedAt: new Date("2026-01-01T00:00:00.000Z") },
      },
      {
        leaid: "L2",
        _count: { _all: 5 },
        _max: { lastEnrichedAt: new Date("2026-04-10T00:00:00.000Z") },
      },
      {
        leaid: "L3",
        _count: { _all: 5 },
        _max: { lastEnrichedAt: new Date("2026-02-01T00:00:00.000Z") },
      },
    ]);

    const res = await call("plan-1");
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.plans.map((p: { id: string }) => p.id)).toEqual([
      "plan-a",
      "plan-b",
      "plan-c",
    ]);
    expect(data.plans.map((p: { contactCount: number }) => p.contactCount)).toEqual(
      [12, 5, 5]
    );
  });

  it("caps the response at 10 rows even when more candidates qualify", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({
      id: "plan-1",
      districts: [{ districtLeaid: "L1" }],
    });

    const candidates = Array.from({ length: 15 }, (_, i) => ({
      id: `plan-${i + 2}`,
      name: `Plan ${i + 2}`,
      ownerUser: null,
      districts: [{ districtLeaid: "L1" }],
    }));
    mockPrisma.territoryPlan.findMany.mockResolvedValue(candidates);

    mockPrisma.contact.groupBy.mockResolvedValue([
      {
        leaid: "L1",
        _count: { _all: 3 },
        _max: { lastEnrichedAt: new Date("2026-04-01T00:00:00.000Z") },
      },
    ]);

    const res = await call("plan-1");
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.plans).toHaveLength(10);
  });

  it("sets ownerName to null when the plan has no owner", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({
      id: "plan-1",
      districts: [{ districtLeaid: "L1" }],
    });
    mockPrisma.territoryPlan.findMany.mockResolvedValue([
      {
        id: "plan-2",
        name: "Orphan Plan",
        ownerUser: null,
        districts: [{ districtLeaid: "L1" }],
      },
    ]);
    mockPrisma.contact.groupBy.mockResolvedValue([
      {
        leaid: "L1",
        _count: { _all: 2 },
        _max: { lastEnrichedAt: null },
      },
    ]);

    const res = await call("plan-1");
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.plans).toEqual([
      {
        id: "plan-2",
        name: "Orphan Plan",
        ownerName: null,
        sharedDistrictCount: 1,
        contactCount: 2,
        lastEnrichedAt: null,
      },
    ]);
  });
});
