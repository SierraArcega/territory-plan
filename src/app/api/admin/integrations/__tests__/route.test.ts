import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetAdminUser, mockPrisma } = vi.hoisted(() => ({
  mockGetAdminUser: vi.fn(),
  mockPrisma: {
    userProfile: { count: vi.fn() },
    userIntegration: { count: vi.fn(), findFirst: vi.fn() },
    dataRefreshLog: { findFirst: vi.fn() },
    appSetting: { findUnique: vi.fn() },
    generatedDocument: { aggregate: vi.fn() },
  },
}));

vi.mock("@/lib/supabase/server", () => ({ getAdminUser: mockGetAdminUser }));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("server-only", () => ({}));

import { GET } from "../route";

describe("GET /api/admin/integrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminUser.mockResolvedValue({ user: { id: "u1" }, profile: { id: "u1", role: "admin" } });
    mockPrisma.userProfile.count.mockResolvedValue(7);
    mockPrisma.userIntegration.count.mockResolvedValue(0);
    mockPrisma.userIntegration.findFirst.mockResolvedValue(null);
    mockPrisma.dataRefreshLog.findFirst.mockResolvedValue(null);
    mockPrisma.appSetting.findUnique.mockResolvedValue(null);
    mockPrisma.generatedDocument.aggregate.mockResolvedValue({ _max: { sentAt: null } });
  });

  it("403s for non-admins", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("includes a dropbox-sign entry defaulting to test mode", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const { integrations } = await res.json();
    const ds = integrations.find((i: { slug: string }) => i.slug === "dropbox-sign");
    expect(ds).toMatchObject({
      name: "Dropbox Sign",
      status: "test",
      connectedUsers: null,
      totalUsers: null,
      modeChangedAt: null,
      modeChangedByName: null,
    });
    expect(ds.lastSyncAt).toBeNull();
  });

  it("reports live mode + change metadata + last send", async () => {
    mockPrisma.appSetting.findUnique.mockResolvedValue({
      key: "dropbox_sign_test_mode",
      value: false,
      updatedAt: new Date("2026-06-12T10:00:00Z"),
      updatedBy: { fullName: "Aston Arcega" },
    });
    mockPrisma.generatedDocument.aggregate.mockResolvedValue({ _max: { sentAt: new Date("2026-06-11T09:00:00Z") } });
    const res = await GET();
    const { integrations } = await res.json();
    const ds = integrations.find((i: { slug: string }) => i.slug === "dropbox-sign");
    expect(ds).toMatchObject({
      status: "live",
      modeChangedByName: "Aston Arcega",
      lastSyncAt: "2026-06-11T09:00:00.000Z",
      modeChangedAt: "2026-06-12T10:00:00.000Z",
    });
  });
});
