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
    lead: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "lead-new" }),
    },
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
  return new NextRequest(new URL(`/api/leads/import${query}`, "http://localhost:3005"), {
    method: "POST",
    body: JSON.stringify(body),
  } as never);
}

describe("POST /api/leads/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.contact.findMany.mockResolvedValue([] as never);
    mockPrisma.school.findMany.mockResolvedValue([] as never);
    mockPrisma.district.findMany.mockResolvedValue([
      { leaid: "0612480", name: "East Side Union HSD" },
    ] as never);
    mockPrisma.lead.findMany.mockResolvedValue([] as never);
    mockPrisma.userProfile.findMany.mockResolvedValue([] as never);
    mockPrisma.contact.create.mockResolvedValue({ id: 9 } as never);
    mockPrisma.lead.create.mockResolvedValue({ id: "lead-new" } as never);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(request({ rows: [{ email: "a@b.org" }] }));
    expect(res.status).toBe(401);
  });

  it("validates the rows payload (shape + 500 cap)", async () => {
    expect((await POST(request({ rows: [] }))).status).toBe(400);
    expect((await POST(request({}))).status).toBe(400);
    const tooMany = Array.from({ length: 501 }, (_, i) => ({ email: `u${i}@x.org` }));
    const res = await POST(request({ rows: tooMany }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("too_many_rows");
  });

  it("?dryRun=1 returns the resolution plan without writing", async () => {
    const res = await POST(
      request(
        { rows: [{ email: "new@esuhsd.org", name: "New Person", leaid: "0612480" }] },
        "?dryRun=1",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(body.rows[0]).toMatchObject({
      ok: true,
      contact: expect.objectContaining({ willCreate: true }),
      district: expect.objectContaining({ leaid: "0612480", willCreate: false }),
    });
    expect(body.summary).toMatchObject({ total: 1, toCreate: 1, failed: 0 });

    expect(mockPrisma.contact.create).not.toHaveBeenCalled();
    expect(mockPrisma.district.create).not.toHaveBeenCalled();
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    expect(mockPrisma.leadEvent.create).not.toHaveBeenCalled();
  });

  it("wet run imports rows and reports succeeded/failed", async () => {
    const res = await POST(
      request({
        rows: [
          { email: "new@esuhsd.org", name: "New Person", leaid: "0612480" },
          { name: "No Email" },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.succeeded).toEqual([0]);
    expect(body.failed).toEqual([{ index: 1, reason: "invalid_email" }]);
    expect(mockPrisma.lead.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.leadEvent.create).toHaveBeenCalledTimes(1);
  });
});
