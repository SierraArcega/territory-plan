import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...a: unknown[]) => mockGetUser(...a),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    district: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;
import { GET, POST } from "../route";
import { DELETE } from "../[userId]/route";

const user = { id: "11111111-1111-1111-1111-111111111111", email: "rep@fm.com" };
const other = "22222222-2222-2222-2222-222222222222";
const addedAt = new Date("2026-06-02T12:00:00Z");

function req(url: string, body?: unknown) {
  const init: RequestInit = body
    ? { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
    : { method: "GET" };
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue(user);
});

describe("GET /api/districts/[leaid]/collaborators", () => {
  it("401s when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(req("http://localhost/api/districts/3601234/collaborators"), {
      params: Promise.resolve({ leaid: "3601234" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns serialized collaborators", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { user_id: other, source: "auto", added_at: addedAt, full_name: "Rep Two", email: "two@fm.com", avatar_url: null },
    ]);
    const res = await GET(req("http://localhost/api/districts/3601234/collaborators"), {
      params: Promise.resolve({ leaid: "3601234" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.collaborators).toEqual([
      {
        userId: other,
        source: "auto",
        addedAt: addedAt.toISOString(),
        user: { id: other, fullName: "Rep Two", email: "two@fm.com", avatarUrl: null },
      },
    ]);
  });
});

describe("POST /api/districts/[leaid]/collaborators", () => {
  it("404s when district missing", async () => {
    mockPrisma.district.findUnique.mockResolvedValue(null);
    const res = await POST(req("http://localhost/api/districts/x/collaborators", { userId: other }), {
      params: Promise.resolve({ leaid: "x" }),
    });
    expect(res.status).toBe(404);
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("adds a manual collaborator and defaults userId to current user", async () => {
    mockPrisma.district.findUnique.mockResolvedValue({ leaid: "3601234" });
    mockPrisma.$executeRaw.mockResolvedValue(1);
    mockPrisma.$queryRaw.mockResolvedValue([
      { user_id: user.id, source: "manual", added_at: addedAt, full_name: "Rep", email: user.email, avatar_url: null },
    ]);
    const res = await POST(req("http://localhost/api/districts/3601234/collaborators", {}), {
      params: Promise.resolve({ leaid: "3601234" }),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.collaborator).toMatchObject({ userId: user.id, source: "manual" });
    expect(mockPrisma.$executeRaw).toHaveBeenCalledOnce();
  });
});

describe("DELETE /api/districts/[leaid]/collaborators/[userId]", () => {
  it("401s when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await DELETE(req("http://localhost/api/districts/3601234/collaborators/" + other), {
      params: Promise.resolve({ leaid: "3601234", userId: other }),
    });
    expect(res.status).toBe(401);
  });

  it("removes a collaborator", async () => {
    mockPrisma.$executeRaw.mockResolvedValue(1);
    const res = await DELETE(req("http://localhost/api/districts/3601234/collaborators/" + other), {
      params: Promise.resolve({ leaid: "3601234", userId: other }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).removed).toBe(1);
  });
});
