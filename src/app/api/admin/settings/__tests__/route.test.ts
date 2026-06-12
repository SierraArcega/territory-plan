import { describe, it, expect, vi, beforeEach } from "vitest";

// app-settings imports "server-only"; stub it so the test can import the module.
vi.mock("server-only", () => ({}));

const { mockGetAdminUser, mockUpsert } = vi.hoisted(() => ({
  mockGetAdminUser: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getAdminUser: mockGetAdminUser }));
vi.mock("@/lib/prisma", () => ({ default: { appSetting: { upsert: mockUpsert } } }));

import { PATCH } from "../route";
import { DROPBOX_SIGN_TEST_MODE_KEY } from "@/features/shared/lib/app-setting-keys";

function req(body: unknown) {
  return new Request("http://localhost/api/admin/settings", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminUser.mockResolvedValue({ user: { id: "u1" }, profile: { id: "u1", role: "admin" } });
    mockUpsert.mockResolvedValue({
      key: DROPBOX_SIGN_TEST_MODE_KEY, value: false, updatedAt: new Date("2026-06-12T00:00:00Z"), updatedById: "u1",
    });
  });

  it("403s for non-admins", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await PATCH(req({ key: DROPBOX_SIGN_TEST_MODE_KEY, value: false }));
    expect(res.status).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("400s for an unknown key", async () => {
    const res = await PATCH(req({ key: "nonsense", value: false }));
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("400s for a non-boolean value", async () => {
    const res = await PATCH(req({ key: DROPBOX_SIGN_TEST_MODE_KEY, value: "no" }));
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("400s for a malformed JSON body", async () => {
    const badReq = new Request("http://localhost/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await PATCH(badReq);
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("500s when the database write fails", async () => {
    mockUpsert.mockRejectedValue(new Error("db down"));
    const res = await PATCH(req({ key: DROPBOX_SIGN_TEST_MODE_KEY, value: false }));
    expect(res.status).toBe(500);
  });

  it("writes the setting stamped with the admin's profile id", async () => {
    const res = await PATCH(req({ key: DROPBOX_SIGN_TEST_MODE_KEY, value: false }));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { key: DROPBOX_SIGN_TEST_MODE_KEY },
      create: { key: DROPBOX_SIGN_TEST_MODE_KEY, value: false, updatedById: "u1" },
      update: { value: false, updatedById: "u1" },
    });
    expect(await res.json()).toMatchObject({ key: DROPBOX_SIGN_TEST_MODE_KEY, value: false });
  });
});
