import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockFindUnique } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFindUnique: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getUser: mockGetUser }));
vi.mock("@/lib/prisma", () => ({ default: { generatedDocument: { findUnique: mockFindUnique } } }));

import { GET } from "../route";
import { NextRequest } from "next/server";

const ROW = {
  id: 7, status: "processing", errorMessage: null,
  recipientEmail: "s@acme.org", docUrl: "https://docs.google.com/d/D/edit",
  ownerProfileId: "user-uuid",
};
function get(id: string) {
  return GET(new NextRequest(`http://localhost/api/document-generation/documents/${id}`),
    { params: Promise.resolve({ id }) });
}

describe("GET /api/document-generation/documents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "user-uuid" });
    mockFindUnique.mockResolvedValue(ROW);
  });

  it("401s when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    expect((await get("7")).status).toBe(401);
  });
  it("400s on a non-integer id", async () => {
    expect((await get("abc")).status).toBe(400);
  });
  it("404s for an unknown row", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect((await get("7")).status).toBe(404);
  });
  it("404s for another owner's row (no existence leak)", async () => {
    mockFindUnique.mockResolvedValue({ ...ROW, ownerProfileId: "someone-else" });
    expect((await get("7")).status).toBe(404);
  });
  it("returns status fields for the owner, without ownerProfileId", async () => {
    const res = await get("7");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      id: 7, status: "processing", errorMessage: null,
      recipientEmail: "s@acme.org", docUrl: "https://docs.google.com/d/D/edit",
    });
  });
});
