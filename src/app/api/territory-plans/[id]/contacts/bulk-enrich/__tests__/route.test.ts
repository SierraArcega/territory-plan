import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlan: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    contact: {
      groupBy: vi.fn(),
    },
    district: {
      findMany: vi.fn(),
    },
    school: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    schoolContact: {
      findMany: vi.fn(),
    },
    activity: {
      create: vi.fn(),
    },
  },
}));

// Stub global fetch so we can assert Clay webhook calls without network I/O
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal("fetch", mockFetch);

import prisma from "@/lib/prisma";
import { POST } from "../route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/territory-plans/plan-1/contacts/bulk-enrich", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CLAY_WEBHOOK_URL = "https://clay.test/hook";
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.test";
  mockPrisma.territoryPlan.findUnique.mockResolvedValue({
    id: "plan-1",
    enrichmentStartedAt: null,
    enrichmentQueued: null,
    districts: [
      { districtLeaid: "0100001" },
      { districtLeaid: "0100002" },
    ],
  });
  mockPrisma.territoryPlan.update.mockResolvedValue({});
  mockPrisma.activity.create.mockResolvedValue({ id: "activity-1" });
  // Default district.findMany — rollup pre-check returns [], no enrich-path rows.
  // Tests override via setDistrictFindMany(rows) for the enrich-path lookup.
  setDistrictFindMany([]);
});

// Helper: install a district.findMany mock that returns `districtRows` for the
// enrich-path lookup (selects leaid/name/etc.) and `[]` for the rollup pre-check
// (which uses `distinct: ["parentLeaid"]`). Tests should call this instead of
// mockPrisma.district.findMany.mockResolvedValue(...) directly.
function setDistrictFindMany(districtRows: unknown[]) {
  mockPrisma.district.findMany.mockImplementation((args: { distinct?: string[] }) => {
    if (args?.distinct?.includes("parentLeaid")) return Promise.resolve([]);
    return Promise.resolve(districtRows);
  });
}

describe("POST /bulk-enrich — Principal", () => {
  it("queues one webhook per eligible school at the requested levels", async () => {
    mockPrisma.school.findMany.mockResolvedValue([
      { ncessch: "010000100001", schoolName: "Alpha HS", schoolLevel: 3, schoolType: 1, leaid: "0100001", streetAddress: "1 A St", city: "A", stateAbbrev: "AL", zip: "10000", phone: null },
      { ncessch: "010000100002", schoolName: "Beta HS",  schoolLevel: 3, schoolType: 4, leaid: "0100001", streetAddress: "2 B St", city: "B", stateAbbrev: "AL", zip: "10001", phone: null },
      { ncessch: "010000200001", schoolName: "Gamma HS", schoolLevel: 3, schoolType: 1, leaid: "0100002", streetAddress: "3 C St", city: "C", stateAbbrev: "AL", zip: "10002", phone: null },
    ]);
    mockPrisma.schoolContact.findMany.mockResolvedValue([]); // none already enriched
    setDistrictFindMany([
      { leaid: "0100001", name: "Alpha SD", stateAbbrev: "AL", websiteUrl: "alpha.edu" },
      { leaid: "0100002", name: "Beta SD",  stateAbbrev: "AL", websiteUrl: "beta.edu"  },
    ]);

    const res = await POST(buildRequest({ targetRole: "Principal", schoolLevels: [3] }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.queued).toBe(3);

    expect(mockPrisma.school.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          leaid: { in: ["0100001", "0100002"] },
          schoolLevel: { in: [3] },
          schoolStatus: 1,
        }),
      })
    );

    // Allow fire-and-forget to tick
    await new Promise((r) => setTimeout(r, 20));
    const webhookCalls = mockFetch.mock.calls.filter((call) => call[0] === "https://clay.test/hook");
    expect(webhookCalls).toHaveLength(3);
    const firstPayload = JSON.parse(webhookCalls[0][1].body as string);
    expect(firstPayload.ncessch).toBe("010000100001");
    expect(firstPayload.target_role).toBe("Principal");
    expect(firstPayload.school_level).toBe(3);
  });

  it("skips schools that already have a principal SchoolContact", async () => {
    mockPrisma.school.findMany.mockResolvedValue([
      { ncessch: "S1", schoolName: "One", schoolLevel: 3, schoolType: 1, leaid: "0100001", streetAddress: "", city: "", stateAbbrev: "AL", zip: "", phone: null },
      { ncessch: "S2", schoolName: "Two", schoolLevel: 3, schoolType: 1, leaid: "0100001", streetAddress: "", city: "", stateAbbrev: "AL", zip: "", phone: null },
    ]);
    // S1 already has a principal contact
    mockPrisma.schoolContact.findMany.mockResolvedValue([{ schoolId: "S1" }]);
    setDistrictFindMany([
      { leaid: "0100001", name: "Alpha SD", stateAbbrev: "AL", websiteUrl: null },
    ]);

    const res = await POST(buildRequest({ targetRole: "Principal", schoolLevels: [3] }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    const data = await res.json();

    expect(data.queued).toBe(1);
    expect(data.skipped).toBe(1);
  });

  it("records targetRole, schoolLevels, schoolsQueued in Activity metadata", async () => {
    mockPrisma.school.findMany.mockResolvedValue([
      { ncessch: "S1", schoolName: "One", schoolLevel: 1, schoolType: 1, leaid: "0100001", streetAddress: "", city: "", stateAbbrev: "AL", zip: "", phone: null },
    ]);
    mockPrisma.schoolContact.findMany.mockResolvedValue([]);
    setDistrictFindMany([
      { leaid: "0100001", name: "Alpha SD", stateAbbrev: "AL", websiteUrl: null },
    ]);

    await POST(buildRequest({ targetRole: "Principal", schoolLevels: [1, 2] }), {
      params: Promise.resolve({ id: "plan-1" }),
    });

    expect(mockPrisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            targetRole: "Principal",
            schoolLevels: [1, 2],
            schoolsQueued: 1,
          }),
        }),
      })
    );
  });

  it("returns 400 when Principal is selected with empty schoolLevels", async () => {
    const res = await POST(buildRequest({ targetRole: "Principal", schoolLevels: [] }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns reason=no-schools-in-district when Principal finds zero schools and none exist on record", async () => {
    mockPrisma.school.findMany.mockResolvedValue([]);
    mockPrisma.school.count.mockResolvedValue(0);

    const res = await POST(buildRequest({ targetRole: "Principal", schoolLevels: [1, 2, 3] }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    const data = await res.json();

    expect(data).toEqual({ total: 0, skipped: 0, queued: 0, reason: "no-schools-in-district" });
  });

  it("returns reason=no-schools-at-levels when Principal finds zero at selected levels but schools exist on record", async () => {
    mockPrisma.school.findMany.mockResolvedValue([]);
    mockPrisma.school.count.mockResolvedValue(12);

    const res = await POST(buildRequest({ targetRole: "Principal", schoolLevels: [3] }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    const data = await res.json();

    expect(data).toEqual({ total: 0, skipped: 0, queued: 0, reason: "no-schools-at-levels" });
  });
});

describe("POST /bulk-enrich — empty-plan edge case", () => {
  it("returns reason=no-districts when the plan has zero districts", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValueOnce({
      id: "plan-1",
      enrichmentStartedAt: null,
      enrichmentQueued: null,
      districts: [],
    });

    const res = await POST(buildRequest({ targetRole: "Superintendent" }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    const data = await res.json();

    expect(data).toEqual({ total: 0, skipped: 0, queued: 0, reason: "no-districts" });
  });
});

describe("POST /bulk-enrich — non-Principal (regression)", () => {
  it("Superintendent path still fires per-district webhooks", async () => {
    mockPrisma.contact.groupBy.mockResolvedValue([]); // no districts already enriched
    setDistrictFindMany([
      { leaid: "0100001", name: "Alpha SD", stateAbbrev: "AL", cityLocation: "A", streetLocation: "1 A", zipLocation: "10000", websiteUrl: "alpha.edu" },
      { leaid: "0100002", name: "Beta SD",  stateAbbrev: "AL", cityLocation: "B", streetLocation: "2 B", zipLocation: "10001", websiteUrl: "beta.edu" },
    ]);

    const res = await POST(buildRequest({ targetRole: "Superintendent" }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    const data = await res.json();

    expect(data.queued).toBe(2);
    // School path should not have been consulted
    expect(mockPrisma.school.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.schoolContact.findMany).not.toHaveBeenCalled();
  });
});
