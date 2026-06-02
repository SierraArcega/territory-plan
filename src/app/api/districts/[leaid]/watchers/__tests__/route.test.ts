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

describe("GET /api/districts/[leaid]/watchers", () => {
  it("401s when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(req("http://localhost/api/districts/3601234/watchers"), {
      params: Promise.resolve({ leaid: "3601234" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns serialized watchers", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { user_id: other, added_at: addedAt, full_name: "Rep Two", email: "two@fm.com", avatar_url: null },
    ]);
    const res = await GET(req("http://localhost/api/districts/3601234/watchers"), {
      params: Promise.resolve({ leaid: "3601234" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.watchers).toEqual([
      {
        userId: other,
        addedAt: addedAt.toISOString(),
        user: { id: other, fullName: "Rep Two", email: "two@fm.com", avatarUrl: null },
      },
    ]);
  });
});

describe("POST /api/districts/[leaid]/watchers", () => {
  it("404s when district missing", async () => {
    mockPrisma.district.findUnique.mockResolvedValue(null);
    const res = await POST(req("http://localhost/api/districts/x/watchers", {}), {
      params: Promise.resolve({ leaid: "x" }),
    });
    expect(res.status).toBe(404);
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("adds the current user as a watcher by default", async () => {
    mockPrisma.district.findUnique.mockResolvedValue({ leaid: "3601234" });
    mockPrisma.$executeRaw.mockResolvedValue(1);
    mockPrisma.$queryRaw.mockResolvedValue([
      { user_id: user.id, added_at: addedAt, full_name: "Rep", email: user.email, avatar_url: null },
    ]);
    const res = await POST(req("http://localhost/api/districts/3601234/watchers", {}), {
      params: Promise.resolve({ leaid: "3601234" }),
    });
    expect(res.status).toBe(201);
    expect((await res.json()).watcher).toMatchObject({ userId: user.id });
  });
});

describe("DELETE /api/districts/[leaid]/watchers/[userId]", () => {
  it("removes a watcher", async () => {
    mockPrisma.$executeRaw.mockResolvedValue(1);
    const res = await DELETE(req("http://localhost/api/districts/3601234/watchers/" + other), {
      params: Promise.resolve({ leaid: "3601234", userId: other }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).removed).toBe(1);
  });
});
