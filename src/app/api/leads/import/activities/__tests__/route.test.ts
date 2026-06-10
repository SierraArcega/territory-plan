import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    contact: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
    school: { findMany: vi.fn().mockResolvedValue([]) },
    district: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
    lead: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    leadEvent: { create: vi.fn() },
    activity: { create: vi.fn() },
    userProfile: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import prisma from "@/lib/prisma";
const mockPrisma = vi.mocked(prisma, { deep: true });

import { POST } from "../route";

const TEST_USER = { id: "user-1", email: "bdr@fullmindlearning.com" };

function request(body: unknown, query = "") {
  return new NextRequest(
    new URL(`/api/leads/import/activities${query}`, "http://localhost:3005"),
    { method: "POST", body: JSON.stringify(body) } as never,
  );
}

describe("POST /api/leads/import/activities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.contact.findMany.mockResolvedValue([
      {
        id: 5,
        name: "Renee Alvarado",
        email: "renee@esuhsd.org",
        leaid: "0612480",
        schoolNcessch: null,
        createdAt: new Date("2026-01-01"),
        lastEnrichedAt: null,
      },
    ] as never);
    mockPrisma.school.findMany.mockResolvedValue([] as never);
    mockPrisma.district.findMany.mockResolvedValue([
      { leaid: "0612480", name: "East Side Union HSD" },
    ] as never);
    mockPrisma.lead.findMany.mockResolvedValue([{ id: "lead-5", contactId: 5 }] as never);
    mockPrisma.activity.create.mockResolvedValue({ id: "act-1" } as never);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(request({ rows: [{ email: "a@b.org" }] }));
    expect(res.status).toBe(401);
  });

  it("validates the rows payload", async () => {
    expect((await POST(request({ rows: "nope" }))).status).toBe(400);
    const tooMany = Array.from({ length: 501 }, (_, i) => ({ email: `u${i}@x.org` }));
    expect((await POST(request({ rows: tooMany }))).status).toBe(400);
  });

  it("?dryRun=1 returns the resolution plan + summary without writing", async () => {
    const res = await POST(
      request({ rows: [{ email: "renee@esuhsd.org", kind: "call", points: 12 }] }, "?dryRun=1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(body.rows[0]).toMatchObject({ ok: true, leadId: "lead-5", points: 12 });
    expect(body.summary).toEqual({ total: 1, toActiveLeads: 1, retained: 0, failed: 0 });

    expect(mockPrisma.activity.create).not.toHaveBeenCalled();
    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    expect(mockPrisma.contact.create).not.toHaveBeenCalled();
    expect(mockPrisma.district.create).not.toHaveBeenCalled();
  });

  it("wet run writes activities, increments active-lead scores, and summarizes for the toast", async () => {
    mockPrisma.contact.create.mockResolvedValue({ id: 88 } as never);
    const res = await POST(
      request({
        rows: [
          { email: "renee@esuhsd.org", kind: "call", title: "Connected", points: 12 },
          { email: "new@esuhsd.org", leaid: "0612480", kind: "email", points: 8 },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toEqual({ imported: 2, toActiveLeads: 1, retained: 1 });
    expect(mockPrisma.activity.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-5" },
      data: { score: { increment: 12 } },
    });
  });
});
