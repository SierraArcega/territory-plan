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
    lead: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userProfile: { findUnique: vi.fn() },
    school: { findUnique: vi.fn() },
    activity: { delete: vi.fn(), deleteMany: vi.fn() },
  },
}));

const mockTransitionLead = vi.fn();
vi.mock("@/features/leads/lib/server/lead-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/leads/lib/server/lead-service")>();
  return {
    ...actual,
    transitionLead: (...args: unknown[]) => mockTransitionLead(...args),
  };
});

import prisma from "@/lib/prisma";
import { ServiceError } from "@/features/shared/lib/service-error";

const mockPrisma = vi.mocked(prisma, { deep: true });

import { PATCH, DELETE } from "../route";

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

function patchRequest(body: unknown) {
  return new NextRequest(new URL("/api/leads/lead-1", "http://localhost:3005"), {
    method: "PATCH",
    body: JSON.stringify(body),
  } as never);
}

function deleteRequest() {
  return new NextRequest(new URL("/api/leads/lead-1", "http://localhost:3005"), {
    method: "DELETE",
  } as never);
}

describe("PATCH /api/leads/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(TEST_USER);
    mockIsAdmin.mockResolvedValue(false);
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: "lead-1",
      assignedBdrId: "user-1",
    } as never);
    mockPrisma.lead.update.mockResolvedValue(leadFixture() as never);
    mockTransitionLead.mockResolvedValue(leadFixture({ status: "meeting_scheduled" }));
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ status: "working" }), routeParams);
    expect(res.status).toBe(401);
  });

  it("returns 404 for a missing lead", async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ status: "working" }), routeParams);
    expect(res.status).toBe(404);
  });

  it("returns 403 for a non-owner non-admin", async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: "lead-1",
      assignedBdrId: "someone-else",
    } as never);
    const res = await PATCH(patchRequest({ status: "working" }), routeParams);
    expect(res.status).toBe(403);
  });

  it("admin can edit another user's lead", async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: "lead-1",
      assignedBdrId: "someone-else",
    } as never);
    mockIsAdmin.mockResolvedValue(true);
    const res = await PATCH(patchRequest({ status: "meeting_scheduled" }), routeParams);
    expect(res.status).toBe(200);
  });

  it("routes lifecycle transitions through the service", async () => {
    const res = await PATCH(
      patchRequest({ status: "unqualified", reason: "No Response" }),
      routeParams,
    );
    expect(res.status).toBe(200);
    expect(mockTransitionLead).toHaveBeenCalledWith(
      "lead-1",
      { status: "unqualified", reason: "No Response" },
      "user-1",
    );
  });

  it("maps an illegal transition ServiceError to 422", async () => {
    mockTransitionLead.mockRejectedValue(
      new ServiceError("Cannot transition lead from unqualified to working", 422),
    );
    const res = await PATCH(patchRequest({ status: "working" }), routeParams);
    expect(res.status).toBe(422);
  });

  it("applies field edits directly with validation", async () => {
    const res = await PATCH(
      patchRequest({ leadType: "inbound", sequence: "General BDR Sequence" }),
      routeParams,
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead-1" },
        data: { leadType: "inbound", sequence: "General BDR Sequence" },
      }),
    );
    expect(mockTransitionLead).not.toHaveBeenCalled();
  });

  it("rejects an unknown leadType and an unknown BDR", async () => {
    let res = await PATCH(patchRequest({ leadType: "telegraph" }), routeParams);
    expect(res.status).toBe(400);

    mockPrisma.userProfile.findUnique.mockResolvedValue(null);
    res = await PATCH(patchRequest({ assignedBdrId: "ghost" }), routeParams);
    expect(res.status).toBe(400);
  });

  it("starts the SLA clock when routing an unassigned new lead to a BDR", async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: "lead-1",
      assignedBdrId: null,
      status: "new",
    } as never);
    mockPrisma.userProfile.findUnique.mockResolvedValue({ id: "user-2" } as never);
    const res = await PATCH(patchRequest({ assignedBdrId: "user-2" }), routeParams);
    expect(res.status).toBe(200);
    const data = mockPrisma.lead.update.mock.calls[0][0].data as {
      assignedBdrId: string;
      assignedAt?: Date;
    };
    expect(data.assignedBdrId).toBe("user-2");
    expect(data.assignedAt).toBeInstanceOf(Date);
  });

  it("does not reset assignedAt when the lead already has a BDR", async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: "lead-1",
      assignedBdrId: "user-1",
      status: "new",
    } as never);
    mockPrisma.userProfile.findUnique.mockResolvedValue({ id: "user-2" } as never);
    const res = await PATCH(patchRequest({ assignedBdrId: "user-2" }), routeParams);
    expect(res.status).toBe(200);
    const data = mockPrisma.lead.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).toEqual({ assignedBdrId: "user-2" });
  });

  it("does not reset assignedAt when an unassigned lead is past New", async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: "lead-1",
      assignedBdrId: null,
      status: "working",
    } as never);
    mockPrisma.userProfile.findUnique.mockResolvedValue({ id: "user-2" } as never);
    const res = await PATCH(patchRequest({ assignedBdrId: "user-2" }), routeParams);
    expect(res.status).toBe(200);
    const data = mockPrisma.lead.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).toEqual({ assignedBdrId: "user-2" });
  });

  it("returns 400 when there is nothing to update", async () => {
    const res = await PATCH(patchRequest({}), routeParams);
    expect(res.status).toBe(400);
  });

  it("passes meetingAt through to the service on a transition", async () => {
    const res = await PATCH(
      patchRequest({ status: "meeting_scheduled", meetingAt: "2026-06-15T14:00:00Z" }),
      routeParams,
    );
    expect(res.status).toBe(200);
    expect(mockTransitionLead).toHaveBeenCalledWith(
      "lead-1",
      { status: "meeting_scheduled", reason: undefined, meetingAt: "2026-06-15T14:00:00Z" },
      "user-1",
    );
    // meetingAt rode the transition — no separate field-edit write
    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
  });

  it("updates meetingAt as a standalone field edit", async () => {
    const res = await PATCH(patchRequest({ meetingAt: "2026-06-20T09:30:00Z" }), routeParams);
    expect(res.status).toBe(200);
    const data = mockPrisma.lead.update.mock.calls[0][0].data as { meetingAt: Date };
    expect(data.meetingAt).toBeInstanceOf(Date);
    expect(data.meetingAt.toISOString()).toBe("2026-06-20T09:30:00.000Z");
    expect(mockTransitionLead).not.toHaveBeenCalled();
  });

  it("allows clearing meetingAt with null", async () => {
    const res = await PATCH(patchRequest({ meetingAt: null }), routeParams);
    expect(res.status).toBe(200);
    expect(mockPrisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { meetingAt: null } }),
    );
  });

  it("rejects a garbage meetingAt with 400", async () => {
    for (const meetingAt of ["not-a-date", 12345, true]) {
      const res = await PATCH(patchRequest({ meetingAt }), routeParams);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_meeting_at" });
    }
    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/leads/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(TEST_USER);
    mockIsAdmin.mockResolvedValue(false);
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: "lead-1",
      assignedBdrId: "user-1",
    } as never);
    mockPrisma.lead.delete.mockResolvedValue(leadFixture() as never);
  });

  it("deletes the lead and never touches engagement activities", async () => {
    const res = await DELETE(deleteRequest(), routeParams);
    expect(res.status).toBe(200);
    expect(mockPrisma.lead.delete).toHaveBeenCalledWith({ where: { id: "lead-1" } });
    expect(mockPrisma.activity.delete).not.toHaveBeenCalled();
    expect(mockPrisma.activity.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-owner non-admin", async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: "lead-1",
      assignedBdrId: "someone-else",
    } as never);
    const res = await DELETE(deleteRequest(), routeParams);
    expect(res.status).toBe(403);
    expect(mockPrisma.lead.delete).not.toHaveBeenCalled();
  });
});
