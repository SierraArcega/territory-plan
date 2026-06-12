import { describe, it, expect, vi, beforeEach } from "vitest";

// app-settings imports "server-only"; stub it so the test can import the module.
vi.mock("server-only", () => ({}));

const { mockGetUser, mockFindUnique } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mockGetUser }));
vi.mock("@/lib/prisma", () => ({ default: { appSetting: { findUnique: mockFindUnique } } }));

import { GET } from "../route";
import { DROPBOX_SIGN_TEST_MODE_KEY } from "@/features/shared/lib/app-setting-keys";

describe("GET /api/document-generation/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "rep-uuid" });
    mockFindUnique.mockResolvedValue(null);
  });

  it("401s when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("defaults to testMode true with no row", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ testMode: true });
  });

  it("returns the stored mode", async () => {
    mockFindUnique.mockResolvedValue({ key: DROPBOX_SIGN_TEST_MODE_KEY, value: false });
    const res = await GET();
    expect(await res.json()).toEqual({ testMode: false });
  });

  it("500s when the database read fails", async () => {
    mockFindUnique.mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
