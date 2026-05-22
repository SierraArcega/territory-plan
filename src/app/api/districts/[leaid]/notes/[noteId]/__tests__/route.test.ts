import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockIsAdmin = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...a: unknown[]) => mockGetUser(...a),
  isAdmin: (...a: unknown[]) => mockIsAdmin(...a),
}));
vi.mock("@/lib/prisma", () => ({
  default: { districtNote: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;
import { PATCH, DELETE } from "../route";

const user = { id: "author-1", email: "rep@fm.com" };
const now = new Date("2026-05-21T12:00:00Z");
const authorSel = { id: "author-1", fullName: "Rep", email: "rep@fm.com", avatarUrl: null };

function req(method: string, body?: unknown) {
  const init: RequestInit = { method };
  if (body) { init.body = JSON.stringify(body); init.headers = { "Content-Type": "application/json" }; }
  return new NextRequest(new URL("http://localhost/api/districts/3601234/notes/n1"), init as never);
}
const ctx = { params: Promise.resolve({ leaid: "3601234", noteId: "n1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue(user);
  mockIsAdmin.mockResolvedValue(false);
});

describe("PATCH note", () => {
  it("403s when editing another author's note", async () => {
    mockPrisma.districtNote.findUnique.mockResolvedValue({ id: "n1", districtLeaid: "3601234", authorId: "someone-else" });
    const res = await PATCH(req("PATCH", { bodyJson: { type: "doc" }, bodyText: "x" }), ctx);
    expect(res.status).toBe(403);
  });

  it("updates own note", async () => {
    mockPrisma.districtNote.findUnique.mockResolvedValue({ id: "n1", districtLeaid: "3601234", authorId: "author-1" });
    mockPrisma.districtNote.update.mockResolvedValue({
      id: "n1", bodyJson: { type: "doc" }, bodyText: "edited", noteType: "risk_flag", createdAt: now, updatedAt: now, author: authorSel,
    });
    const res = await PATCH(req("PATCH", { bodyJson: { type: "doc" }, bodyText: "edited" }), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.bodyText).toBe("edited");
    expect(json.noteType).toBe("risk_flag");
  });
});

describe("DELETE note", () => {
  it("404s when note missing or wrong district", async () => {
    mockPrisma.districtNote.findUnique.mockResolvedValue(null);
    const res = await DELETE(req("DELETE"), ctx);
    expect(res.status).toBe(404);
  });

  it("deletes own note", async () => {
    mockPrisma.districtNote.findUnique.mockResolvedValue({ id: "n1", districtLeaid: "3601234", authorId: "author-1" });
    mockPrisma.districtNote.delete.mockResolvedValue({});
    const res = await DELETE(req("DELETE"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
