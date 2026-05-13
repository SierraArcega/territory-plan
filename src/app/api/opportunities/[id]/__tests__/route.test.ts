import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    opportunity: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { GET } from "../route";

const mockUser = { id: "user-1" };

function makeRequest() {
  return new NextRequest(
    new URL("/api/opportunities/opp-1", "http://localhost:3000"),
    { method: "GET" } as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/opportunities/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: "opp-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when opp does not exist", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.opportunity.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: "opp-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns opp with district relation", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.opportunity.findUnique.mockResolvedValue({
      id: "opp-1",
      name: "Test Opp",
      stage: "Proposal",
      netBookingAmount: "50000.00",
      closeDate: new Date("2026-06-15"),
      createdAt: new Date("2026-01-01"),
      district: {
        leaid: "0600001",
        name: "Test ISD",
        stateAbbrev: "CA",
        enrollment: 2000,
      },
      serviceTypes: [],
      stageHistory: [],
    });
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: "opp-1" }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toBe("opp-1");
    expect(data.netBookingAmount).toBe(50000);
    expect(data.district.name).toBe("Test ISD");
  });
});
