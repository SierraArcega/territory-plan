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

const mockLogEngagement = vi.fn();
vi.mock("@/features/leads/lib/server/lead-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/leads/lib/server/lead-service")>();
  return {
    ...actual,
    logEngagement: (...args: unknown[]) => mockLogEngagement(...args),
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
    opportunityId: null,
    meetingAt: null,
    assignedAt: new Date("2026-06-01T10:00:00Z"),
    acceptedAt: null,
    createdAt: new Date("2026-06-01T10:00:00Z"),
    updatedAt: new Date("2026-06-01T10:00:00Z"),
    contact: null,
    school: null,
    district: null,
    assignedBdr: null,
    opportunity: null,
    ...overrides,
  };
}

const routeParams = { params: Promise.resolve({ id: "lead-1" }) };

function postRequest(body: unknown) {
  return new NextRequest(new URL("/api/leads/lead-1/engagement", "http://localhost:3005"), {
    method: "POST",
    body: JSON.stringify(body),
  } as never);
}

describe("POST /api/leads/[id]/engagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(TEST_USER);
    mockIsAdmin.mockResolvedValue(false);
    mockPrisma.lead.findUnique.mockResolvedValue(
      leadFixture() as never,
    );
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(postRequest({ type: "cold_call", title: "Call" }), routeParams);
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown lead", async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null as never);
    const res = await POST(postRequest({ type: "cold_call", title: "Call" }), routeParams);
    expect(res.status).toBe(404);
  });

  it("returns 403 when the lead belongs to another BDR and the user is not admin", async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(
      leadFixture({ assignedBdrId: "someone-else" }) as never,
    );
    const res = await POST(postRequest({ type: "cold_call", title: "Call" }), routeParams);
    expect(res.status).toBe(403);
    expect(mockLogEngagement).not.toHaveBeenCalled();
  });

  it("logs the engagement and returns the activity id + serialized lead", async () => {
    mockLogEngagement.mockResolvedValue({
      activity: { id: 42 },
      lead: leadFixture({ score: 100 }),
    });
    const body = {
      type: "cold_call",
      title: "Call · Mesa Valley USD 51",
      notes: "Budget confirmed",
      rating: 4,
      outcomeType: "positive_progress",
      resultingStatus: "meeting_scheduled",
    };
    const res = await POST(postRequest(body), routeParams);
    expect(res.status).toBe(200);
    expect(mockLogEngagement).toHaveBeenCalledWith("lead-1", body, "user-1");
    const json = await res.json();
    expect(json.activityId).toBe(42);
    expect(json.lead.id).toBe("lead-1");
    expect(json.lead.status).toBe("working");
  });

  it("propagates ServiceError status codes (422 illegal transition)", async () => {
    mockLogEngagement.mockRejectedValue(
      new ServiceError("Cannot transition lead from working to sales_qualified", 422),
    );
    const res = await POST(
      postRequest({ type: "cold_call", title: "Call", resultingStatus: "sales_qualified" }),
      routeParams,
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toMatch(/Cannot transition/);
  });

  it("returns 400 for a malformed JSON body", async () => {
    const req = new NextRequest(
      new URL("/api/leads/lead-1/engagement", "http://localhost:3005"),
      { method: "POST", body: "{not json" } as never,
    );
    const res = await POST(req, routeParams);
    expect(res.status).toBe(400);
  });
});
