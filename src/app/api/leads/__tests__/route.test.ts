import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    lead: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const mockCreateLead = vi.fn();
vi.mock("@/features/leads/lib/server/lead-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/leads/lib/server/lead-service")>();
  return {
    ...actual,
    createLead: (...args: unknown[]) => mockCreateLead(...args),
  };
});

import prisma from "@/lib/prisma";
import { ServiceError } from "@/features/shared/lib/service-error";

const mockPrisma = vi.mocked(prisma, { deep: true });

import { GET, POST } from "../route";

const TEST_USER = { id: "user-1", email: "bdr@fullmindlearning.com" };

function leadFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    contactId: 11,
    schoolNcessch: null,
    leaid: "0612480",
    status: "new",
    score: 120,
    leadType: "mql",
    sequence: null,
    marketingOwner: null,
    assignedBdrId: "user-1",
    unqualifiedReason: null,
    opportunityId: null,
    assignedAt: new Date("2026-06-01T10:00:00Z"),
    acceptedAt: null,
    createdAt: new Date("2026-06-01T10:00:00Z"),
    updatedAt: new Date("2026-06-01T10:00:00Z"),
    contact: { id: 11, name: "Renee Alvarado", title: "Principal", email: "r@x.org", phone: null, schoolNcessch: null },
    school: null,
    district: { leaid: "0612480", name: "East Side Union HSD", cityLocation: "San Jose", stateAbbrev: "CA" },
    assignedBdr: { id: "user-1", fullName: "Alex Rivera", avatarUrl: null },
    opportunity: null,
    ...overrides,
  };
}

function getRequest(query = "") {
  return new NextRequest(new URL(`/api/leads${query}`, "http://localhost:3005"));
}

function postRequest(body: unknown) {
  return new NextRequest(new URL("/api/leads", "http://localhost:3005"), {
    method: "POST",
    body: JSON.stringify(body),
  } as never);
}

describe("GET /api/leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.lead.count.mockResolvedValue(1);
    mockPrisma.lead.findMany.mockResolvedValue([leadFixture()] as never);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("defaults owner scoping to the current user", async () => {
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const where = mockPrisma.lead.findMany.mock.calls[0][0]?.where;
    expect(where?.assignedBdrId).toBe("user-1");
  });

  it("ownerId=all widens to the whole team", async () => {
    await GET(getRequest("?ownerId=all"));
    const where = mockPrisma.lead.findMany.mock.calls[0][0]?.where;
    expect(where?.assignedBdrId).toBeUndefined();
  });

  it("ownerId=<uuid> scopes to that user; owner multi wins over ownerId", async () => {
    await GET(getRequest("?ownerId=user-2"));
    expect(mockPrisma.lead.findMany.mock.calls[0][0]?.where?.assignedBdrId).toBe("user-2");

    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.lead.count.mockResolvedValue(0);
    mockPrisma.lead.findMany.mockResolvedValue([] as never);
    await GET(getRequest("?owner=user-2,user-3&ownerId=user-9"));
    expect(mockPrisma.lead.findMany.mock.calls[0][0]?.where?.assignedBdrId).toEqual({
      in: ["user-2", "user-3"],
    });
  });

  it("filters by status and district, paginates at 50 by default, caps limit", async () => {
    await GET(getRequest("?status=new,working&districtLeaids=0612480&limit=999"));
    const args = mockPrisma.lead.findMany.mock.calls[0][0];
    expect(args?.where?.status).toEqual({ in: ["new", "working"] });
    expect(args?.where?.leaid).toEqual({ in: ["0612480"] });
    expect(args?.take).toBe(200); // capped

    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.lead.count.mockResolvedValue(0);
    mockPrisma.lead.findMany.mockResolvedValue([] as never);
    await GET(getRequest());
    expect(mockPrisma.lead.findMany.mock.calls[0][0]?.take).toBe(50);
  });

  it("serializes leads with contact/district/bdr shapes", async () => {
    const res = await GET(getRequest());
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.leads[0]).toMatchObject({
      id: "lead-1",
      status: "new",
      score: 120,
      contact: { name: "Renee Alvarado" },
      district: { leaid: "0612480", name: "East Side Union HSD" },
      assignedBdr: { id: "user-1" },
    });
  });
});

describe("POST /api/leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(TEST_USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(postRequest({ leaid: "0612480" }));
    expect(res.status).toBe(401);
  });

  it("delegates to the lead service with the caller's id", async () => {
    mockCreateLead.mockResolvedValue(leadFixture());
    const input = { leaid: "0612480", contactName: "Renee", email: "r@x.org" };
    const res = await POST(postRequest(input));
    expect(res.status).toBe(200);
    expect(mockCreateLead).toHaveBeenCalledWith(input, "user-1");
  });

  it("maps ServiceError status through (409 duplicate active lead)", async () => {
    mockCreateLead.mockRejectedValue(new ServiceError("Contact already has an active lead", 409));
    const res = await POST(postRequest({ leaid: "0612480" }));
    expect(res.status).toBe(409);
  });
});
