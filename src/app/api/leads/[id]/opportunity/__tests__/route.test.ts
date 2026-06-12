import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockIsAdmin = vi.fn().mockResolvedValue(false);
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  isAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    lead: { findUnique: vi.fn() },
  },
}));

const mockLinkOpportunity = vi.fn();
vi.mock("@/features/leads/lib/server/lead-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/leads/lib/server/lead-service")>();
  return {
    ...actual,
    linkOpportunity: (...args: unknown[]) => mockLinkOpportunity(...args),
  };
});

import prisma from "@/lib/prisma";
import { ServiceError } from "@/features/shared/lib/service-error";

const mockPrisma = vi.mocked(prisma, { deep: true });

import { POST } from "../route";

const TEST_USER = { id: "user-1", email: "bdr@fullmindlearning.com" };

function leadFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    contactId: 11,
    schoolNcessch: null,
    leaid: "0612480",
    status: "working",
    score: 100,
    leadType: "mql",
    sequence: null,
    marketingOwner: null,
    assignedBdrId: "user-1",
    unqualifiedReason: null,
    opportunityId: "opp-1",
    meetingAt: null,
    assignedAt: new Date("2026-06-01T10:00:00Z"),
    acceptedAt: null,
    createdAt: new Date("2026-06-01T10:00:00Z"),
    updatedAt: new Date("2026-06-01T10:00:00Z"),
    contact: null,
    school: null,
    district: null,
    assignedBdr: null,
    opportunity: {
      id: "opp-1",
      name: "Mesa Valley USD 51 — Virtual Instruction",
      stage: "0 - Meeting Booked",
      netBookingAmount: 75000,
      closeDate: new Date("2026-08-14T00:00:00Z"),
    },
    ...overrides,
  };
}

const routeParams = { params: Promise.resolve({ id: "lead-1" }) };

function postRequest(body: unknown) {
  return new NextRequest(new URL("/api/leads/lead-1/opportunity", "http://localhost:3005"), {
    method: "POST",
    body: JSON.stringify(body),
  } as never);
}

describe("POST /api/leads/[id]/opportunity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(TEST_USER);
    mockIsAdmin.mockResolvedValue(false);
    mockPrisma.lead.findUnique.mockResolvedValue(leadFixture() as never);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(postRequest({ name: "X", amount: 1000 }), routeParams);
    expect(res.status).toBe(401);
  });

  it("returns 403 when the lead belongs to another BDR and the user is not admin", async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(
      leadFixture({ assignedBdrId: "someone-else" }) as never,
    );
    const res = await POST(postRequest({ name: "X" }), routeParams);
    expect(res.status).toBe(403);
    expect(mockLinkOpportunity).not.toHaveBeenCalled();
  });

  it("creates a Stage 0 opp from name/amount/closeDate and returns the lead", async () => {
    mockLinkOpportunity.mockResolvedValue(leadFixture());
    const body = {
      name: "Mesa Valley USD 51 — Virtual Instruction",
      amount: 75000,
      closeDate: "2026-08-14",
    };
    const res = await POST(postRequest(body), routeParams);
    expect(res.status).toBe(200);
    expect(mockLinkOpportunity).toHaveBeenCalledWith("lead-1", body, "user-1");
    const json = await res.json();
    expect(json.opportunity.stage).toBe("0 - Meeting Booked");
    expect(json.opportunity.amount).toBe(75000);
  });

  it("links an existing opportunity by id", async () => {
    mockLinkOpportunity.mockResolvedValue(leadFixture());
    const res = await POST(postRequest({ opportunityId: "opp-1" }), routeParams);
    expect(res.status).toBe(200);
    expect(mockLinkOpportunity).toHaveBeenCalledWith(
      "lead-1",
      { opportunityId: "opp-1" },
      "user-1",
    );
  });

  it("propagates ServiceError status codes (400 closed opp)", async () => {
    mockLinkOpportunity.mockRejectedValue(
      new ServiceError("Cannot link a closed opportunity", 400),
    );
    const res = await POST(postRequest({ opportunityId: "closed-opp" }), routeParams);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/closed opportunity/);
  });
});
