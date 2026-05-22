import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    rfp: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { GET } from "../route";

function makeRequest() {
  return new NextRequest(
    new URL("/api/rfps/123", "http://localhost:3000"),
    { method: "GET" } as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/rfps/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: "123" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is non-numeric", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when rfp does not exist", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    mockPrisma.rfp.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: "123" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns the rfp with district relation", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    mockPrisma.rfp.findUnique.mockResolvedValue({
      id: 123,
      externalId: "OPP-001",
      versionKey: "v1",
      source: "highergov",
      title: "Math curriculum",
      solicitationNumber: null,
      oppType: null,
      description: null,
      aiSummary: null,
      agencyKey: 1,
      agencyName: "Test Agency",
      agencyPath: null,
      stateAbbrev: "NY",
      stateFips: "36",
      popCity: null,
      popZip: null,
      leaid: "3601001",
      district: { leaid: "3601001", name: "Albany SD", stateAbbrev: "NY" },
      naicsCode: null,
      pscCode: null,
      setAside: null,
      valueLow: "10000",
      valueHigh: "50000",
      primaryContactName: null,
      primaryContactEmail: null,
      primaryContactPhone: null,
      postedDate: null,
      dueDate: new Date("2026-06-01"),
      capturedDate: new Date("2026-05-01"),
      highergovUrl: null,
      sourceUrl: null,
      fullmindRelevance: "high",
      keywords: [],
      fundingSources: [],
      setAsideType: null,
      inStateOnly: false,
      cooperativeEligible: false,
      requiresW9State: null,
      classifiedAt: null,
      districtPipelineState: null,
      isNew: false,
      isUrgent: false,
      signalsRefreshedAt: null,
      status: "open",
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    });
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toBe(123);
    expect(data.valueLow).toBe(10000);
    expect(data.district.name).toBe("Albany SD");
  });
});
