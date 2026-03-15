import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Prisma before any imports that reference it
// ---------------------------------------------------------------------------
vi.mock("@/lib/prisma", () => {
  return {
    default: {
      userIntegration: { findUnique: vi.fn(), update: vi.fn() },
      territoryPlanDistrict: { findMany: vi.fn() },
      activity: { upsert: vi.fn() },
      activityDistrict: { upsert: vi.fn() },
    },
  };
});

// Mock the encryption module
vi.mock("@/features/integrations/lib/encryption", () => ({
  decrypt: vi.fn((v: string) => `decrypted_${v}`),
  encrypt: vi.fn((v: string) => `encrypted_${v}`),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import prisma from "@/lib/prisma";
import {
  matchChannelToDistrict,
  truncateMessage,
  syncSlackMessages,
} from "../slack-sync";

// ---------------------------------------------------------------------------
// matchChannelToDistrict (pure function — no DB needed)
// ---------------------------------------------------------------------------
describe("matchChannelToDistrict", () => {
  const districts = [
    { leaid: "0100001", name: "Springfield Public Schools" },
    { leaid: "0100002", name: "Denver Unified" },
    { leaid: "0100003", name: "Los Angeles Unified School District" },
  ];

  it("matches when channel name contains a district name", () => {
    const result = matchChannelToDistrict(
      "springfield-public-schools",
      "",
      districts
    );
    expect(result).toEqual({
      leaid: "0100001",
      name: "Springfield Public Schools",
    });
  });

  it("matches when channel topic contains a district name", () => {
    const result = matchChannelToDistrict(
      "sales-channel",
      "Discussion about Denver Unified partnership",
      districts
    );
    expect(result).toEqual({ leaid: "0100002", name: "Denver Unified" });
  });

  it("matches case-insensitively", () => {
    const result = matchChannelToDistrict(
      "DENVER-UNIFIED",
      "",
      districts
    );
    expect(result).toEqual({ leaid: "0100002", name: "Denver Unified" });
  });

  it("normalizes hyphens and underscores to spaces", () => {
    const result = matchChannelToDistrict(
      "denver_unified_team",
      "",
      districts
    );
    expect(result).toEqual({ leaid: "0100002", name: "Denver Unified" });
  });

  it("returns null when no district matches", () => {
    const result = matchChannelToDistrict(
      "random-chat",
      "Just talking",
      districts
    );
    expect(result).toBeNull();
  });

  it("returns null for empty districts list", () => {
    const result = matchChannelToDistrict("springfield", "", []);
    expect(result).toBeNull();
  });

  it("matches district name contained within channel name", () => {
    // "denver unified" is contained in "denver-unified-team"
    const result = matchChannelToDistrict(
      "denver-unified-team",
      "",
      districts
    );
    expect(result).toEqual({ leaid: "0100002", name: "Denver Unified" });
  });
});

// ---------------------------------------------------------------------------
// truncateMessage
// ---------------------------------------------------------------------------
describe("truncateMessage", () => {
  it("returns text unchanged when shorter than limit", () => {
    expect(truncateMessage("Hello world", 100)).toBe("Hello world");
  });

  it("truncates long text and appends ellipsis", () => {
    const long = "A".repeat(120);
    const result = truncateMessage(long, 100);
    expect(result.length).toBe(100);
    expect(result.endsWith("...")).toBe(true);
  });

  it("returns fallback for empty/null text", () => {
    expect(truncateMessage("", 100)).toBe("(No message text)");
    expect(truncateMessage(undefined as unknown as string, 100)).toBe(
      "(No message text)"
    );
  });
});

// ---------------------------------------------------------------------------
// syncSlackMessages — integration-level tests
// ---------------------------------------------------------------------------
describe("syncSlackMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no Slack integration exists", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(
      null as never
    );

    const result = await syncSlackMessages("user-123");

    expect(result.errors).toContain("No Slack connection found");
    expect(result.messagesProcessed).toBe(0);
  });

  it("returns error when sync is disabled", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue({
      id: "int-1",
      userId: "user-123",
      service: "slack",
      syncEnabled: false,
      accessToken: "enc-token",
      refreshToken: null,
      tokenExpiresAt: null,
      metadata: null,
      status: "connected",
    } as never);

    const result = await syncSlackMessages("user-123");

    expect(result.errors).toContain("Slack sync is disabled");
  });

  it("fetches channels and messages, creates activities for matched districts", async () => {
    // Set up integration
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue({
      id: "int-1",
      userId: "user-123",
      service: "slack",
      syncEnabled: true,
      accessToken: "enc-token",
      refreshToken: null,
      tokenExpiresAt: null,
      metadata: {},
      status: "connected",
      lastSyncAt: null,
    } as never);

    // Set up territory districts
    vi.mocked(prisma.territoryPlanDistrict.findMany).mockResolvedValue([
      {
        district: { leaid: "0100001", name: "Springfield Public Schools" },
      },
    ] as never);

    // Mock Slack API responses
    mockFetch
      // conversations.list
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          channels: [
            {
              id: "C001",
              name: "springfield-public-schools",
              topic: { value: "" },
            },
          ],
        }),
      })
      // conversations.history for C001
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [
            { ts: "1700000001.000001", text: "Meeting went well" },
            { ts: "1700000002.000002", text: "Follow up needed" },
          ],
        }),
      });

    // Mock activity upsert
    vi.mocked(prisma.activity.upsert)
      .mockResolvedValueOnce({
        id: "act-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never)
      .mockResolvedValueOnce({
        id: "act-2",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

    vi.mocked(prisma.activityDistrict.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.userIntegration.update).mockResolvedValue({} as never);

    const result = await syncSlackMessages("user-123");

    expect(result.messagesProcessed).toBe(2);
    expect(result.newMessages).toBe(2);
    expect(result.districtMatches).toBe(2);
    expect(result.errors).toEqual([]);

    // Should have created activity with correct dedup fields
    expect(prisma.activity.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.activity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slackChannelId_slackMessageTs: {
            slackChannelId: "C001",
            slackMessageTs: "1700000001.000001",
          },
        },
        create: expect.objectContaining({
          type: "slack_message",
          source: "slack_sync",
          slackChannelId: "C001",
          slackMessageTs: "1700000001.000001",
          createdByUserId: "user-123",
        }),
      })
    );

    // Should have created ActivityDistrict junction rows
    expect(prisma.activityDistrict.upsert).toHaveBeenCalledTimes(2);

    // Should have updated lastSyncAt
    expect(prisma.userIntegration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "int-1" },
        data: expect.objectContaining({ lastSyncAt: expect.any(Date) }),
      })
    );
  });

  it("creates unlinked activities when no district matches", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue({
      id: "int-1",
      userId: "user-123",
      service: "slack",
      syncEnabled: true,
      accessToken: "enc-token",
      refreshToken: null,
      tokenExpiresAt: null,
      metadata: {},
      status: "connected",
      lastSyncAt: null,
    } as never);

    vi.mocked(prisma.territoryPlanDistrict.findMany).mockResolvedValue([
      {
        district: { leaid: "0100001", name: "Springfield Public Schools" },
      },
    ] as never);

    // Channel name doesn't match any district
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          channels: [
            { id: "C999", name: "random", topic: { value: "" } },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [
            { ts: "1700000010.000001", text: "Random message" },
          ],
        }),
      });

    vi.mocked(prisma.activity.upsert).mockResolvedValueOnce({
      id: "act-unlinked",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(prisma.userIntegration.update).mockResolvedValue({} as never);

    const result = await syncSlackMessages("user-123");

    expect(result.messagesProcessed).toBe(1);
    expect(result.newMessages).toBe(1);
    expect(result.districtMatches).toBe(0);

    // Activity created but no ActivityDistrict junction
    expect(prisma.activity.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.activityDistrict.upsert).not.toHaveBeenCalled();
  });

  it("deduplicates — upsert doesn't create duplicate for same channel+ts", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue({
      id: "int-1",
      userId: "user-123",
      service: "slack",
      syncEnabled: true,
      accessToken: "enc-token",
      refreshToken: null,
      tokenExpiresAt: null,
      metadata: {},
      status: "connected",
      lastSyncAt: null,
    } as never);

    vi.mocked(prisma.territoryPlanDistrict.findMany).mockResolvedValue(
      [] as never
    );

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          channels: [
            { id: "C001", name: "general", topic: { value: "" } },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [{ ts: "1700000001.000001", text: "Hello" }],
        }),
      });

    // Simulate an existing record (updatedAt much later than createdAt)
    const created = new Date("2024-01-01T00:00:00Z");
    const updated = new Date("2024-03-15T00:00:00Z");
    vi.mocked(prisma.activity.upsert).mockResolvedValueOnce({
      id: "act-existing",
      createdAt: created,
      updatedAt: updated,
    } as never);
    vi.mocked(prisma.userIntegration.update).mockResolvedValue({} as never);

    const result = await syncSlackMessages("user-123");

    // The message was processed but counted as updated (not new)
    expect(result.messagesProcessed).toBe(1);
    expect(result.newMessages).toBe(0);
    expect(result.updatedMessages).toBe(1);

    // Upsert was called with the correct composite key
    expect(prisma.activity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slackChannelId_slackMessageTs: {
            slackChannelId: "C001",
            slackMessageTs: "1700000001.000001",
          },
        },
      })
    );
  });

  it("handles Slack API errors gracefully", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue({
      id: "int-1",
      userId: "user-123",
      service: "slack",
      syncEnabled: true,
      accessToken: "enc-token",
      refreshToken: null,
      tokenExpiresAt: null,
      metadata: {},
      status: "connected",
      lastSyncAt: null,
    } as never);

    // Slack API returns error
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: false,
        error: "token_revoked",
      }),
    });

    vi.mocked(prisma.userIntegration.update).mockResolvedValue({} as never);

    const result = await syncSlackMessages("user-123");

    expect(result.errors).toContain(
      "Slack conversations.list failed: token_revoked"
    );
  });

  it("uses lastSyncAt as oldest timestamp for incremental sync", async () => {
    const lastSync = new Date("2024-03-01T00:00:00Z");

    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue({
      id: "int-1",
      userId: "user-123",
      service: "slack",
      syncEnabled: true,
      accessToken: "enc-token",
      refreshToken: null,
      tokenExpiresAt: null,
      metadata: {},
      status: "connected",
      lastSyncAt: lastSync,
    } as never);

    vi.mocked(prisma.territoryPlanDistrict.findMany).mockResolvedValue(
      [] as never
    );

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          channels: [
            { id: "C001", name: "general", topic: { value: "" } },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [],
        }),
      });

    vi.mocked(prisma.userIntegration.update).mockResolvedValue({} as never);

    await syncSlackMessages("user-123");

    // The history call should pass lastSyncAt as oldest
    const historyCall = mockFetch.mock.calls[1];
    const body = historyCall[1]?.body as URLSearchParams;
    const oldest = body.get("oldest");
    expect(oldest).toBe(String(lastSync.getTime() / 1000));
  });
});
