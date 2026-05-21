import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...a: unknown[]) => mockGetUser(...a),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    districtNote: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;
import { GET, POST } from "../route";

const user = { id: "11111111-1111-1111-1111-111111111111", email: "rep@fm.com" };
const now = new Date("2026-05-21T12:00:00Z");

function req(url: string, body?: unknown) {
  const init: RequestInit = body
    ? { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
    : { method: "GET" };
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

const authorSel = { id: user.id, fullName: "Rep", email: "rep@fm.com", avatarUrl: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue(user);
});

describe("GET /api/districts/[leaid]/notes", () => {
  it("401s when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(req("http://localhost/api/districts/3601234/notes"), {
      params: Promise.resolve({ leaid: "3601234" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns notes newest-first with author + bodyJson", async () => {
    mockPrisma.districtNote.findMany.mockResolvedValue([
      { id: "n1", bodyJson: { type: "doc" }, bodyText: "hi", createdAt: now, updatedAt: now, author: authorSel },
    ]);
    const res = await GET(req("http://localhost/api/districts/3601234/notes"), {
      params: Promise.resolve({ leaid: "3601234" }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.notes[0]).toMatchObject({ id: "n1", bodyText: "hi", author: { id: user.id } });
    expect(mockPrisma.districtNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });
});

describe("POST /api/districts/[leaid]/notes", () => {
  it("400s when bodyText is empty", async () => {
    const res = await POST(req("http://localhost/api/districts/3601234/notes", { bodyJson: { type: "doc" }, bodyText: "  " }), {
      params: Promise.resolve({ leaid: "3601234" }),
    });
    expect(res.status).toBe(400);
  });

  it("creates a note and returns it", async () => {
    mockPrisma.districtNote.create.mockResolvedValue({
      id: "n2", bodyJson: { type: "doc" }, bodyText: "called", createdAt: now, updatedAt: now, author: authorSel,
    });
    const res = await POST(
      req("http://localhost/api/districts/3601234/notes", { bodyJson: { type: "doc" }, bodyText: "called" }),
      { params: Promise.resolve({ leaid: "3601234" }) },
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ id: "n2", bodyText: "called" });
    expect(mockPrisma.districtNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ districtLeaid: "3601234", authorId: user.id, bodyText: "called" }),
      }),
    );
  });
});
