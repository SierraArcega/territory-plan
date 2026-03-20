import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Prisma before any imports that reference it
// ---------------------------------------------------------------------------
vi.mock("@/lib/prisma", () => {
  return {
    default: {
      userIntegration: { findUnique: vi.fn() },
      activity: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
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
import { enrichActivitiesWithMixmax } from "../mixmax-enrichment";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMixmaxIntegration(overrides: Record<string, unknown> = {}) {
  return {
    id: "int-mixmax-1",
    userId: "user-123",
    service: "mixmax",
    accessToken: "enc-apikey",
    refreshToken: null,
    tokenExpiresAt: null,
    status: "connected",
    syncEnabled: true,
    metadata: null,
    ...overrides,
  };
}

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: "act-1",
    gmailMessageId: "msg-001",
    contacts: [{ contact: { email: "jane@school.org" } }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("enrichActivitiesWithMixmax", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early with enriched: 0 when no Mixmax integration exists", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(null as never);

    const result = await enrichActivitiesWithMixmax("user-123", ["msg-001"]);

    expect(result).toEqual({ enriched: 0, errors: [] });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(prisma.activity.update).not.toHaveBeenCalled();
  });

  it("returns early with enriched: 0 when gmailMessageIds is empty", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(
      makeMixmaxIntegration() as never
    );
    vi.mocked(prisma.activity.findMany).mockResolvedValue([] as never);

    const result = await enrichActivitiesWithMixmax("user-123", []);

    expect(result).toEqual({ enriched: 0, errors: [] });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("enriches activities when a recipient email matches a synced contact", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(
      makeMixmaxIntegration() as never
    );

    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      makeActivity(),
    ] as never);

    // Mixmax: GET /v1/sequences returns one sequence
    const sequencesResponse = {
      ok: true,
      json: async () => ({
        results: [
          { _id: "seq-abc", name: "Q1 Outreach", stages: [{}, {}, {}] },
        ],
      }),
    };

    // Mixmax: GET /v1/sequences/seq-abc/recipients returns one recipient matching our contact
    const recipientsResponse = {
      ok: true,
      json: async () => ({
        results: [
          {
            contact: { email: "jane@school.org" },
            currentStage: 2,
            status: "active",
            metrics: { opens: 3, clicks: 1 },
          },
        ],
      }),
    };

    mockFetch
      .mockResolvedValueOnce(sequencesResponse)
      .mockResolvedValueOnce(recipientsResponse);

    vi.mocked(prisma.activity.update).mockResolvedValue({} as never);

    const result = await enrichActivitiesWithMixmax("user-123", ["msg-001"]);

    expect(result.enriched).toBe(1);
    expect(result.errors).toEqual([]);

    expect(prisma.activity.update).toHaveBeenCalledWith({
      where: { id: "act-1" },
      data: {
        mixmaxSequenceName: "Q1 Outreach",
        mixmaxSequenceStep: 2,
        mixmaxSequenceTotal: 3,
        mixmaxStatus: "active",
        mixmaxOpenCount: 3,
        mixmaxClickCount: 1,
      },
    });
  });

  it("does not enrich when no recipient emails match synced contacts", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(
      makeMixmaxIntegration() as never
    );

    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      makeActivity({ contacts: [{ contact: { email: "jane@school.org" } }] }),
    ] as never);

    const sequencesResponse = {
      ok: true,
      json: async () => ({
        results: [
          { _id: "seq-abc", name: "Q1 Outreach", stages: [{}, {}] },
        ],
      }),
    };

    const recipientsResponse = {
      ok: true,
      json: async () => ({
        results: [
          {
            contact: { email: "other@different.org" },
            currentStage: 1,
            status: "active",
            metrics: { opens: 0, clicks: 0 },
          },
        ],
      }),
    };

    mockFetch
      .mockResolvedValueOnce(sequencesResponse)
      .mockResolvedValueOnce(recipientsResponse);

    const result = await enrichActivitiesWithMixmax("user-123", ["msg-001"]);

    expect(result.enriched).toBe(0);
    expect(result.errors).toEqual([]);
    expect(prisma.activity.update).not.toHaveBeenCalled();
  });

  it("handles Mixmax API error for sequences gracefully", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(
      makeMixmaxIntegration() as never
    );

    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      makeActivity(),
    ] as never);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    });

    const result = await enrichActivitiesWithMixmax("user-123", ["msg-001"]);

    expect(result.enriched).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/401/);
    expect(prisma.activity.update).not.toHaveBeenCalled();
  });

  it("handles Mixmax API error for recipients gracefully", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(
      makeMixmaxIntegration() as never
    );

    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      makeActivity(),
    ] as never);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ _id: "seq-abc", name: "Outreach", stages: [{}] }],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal Server Error" }),
      });

    const result = await enrichActivitiesWithMixmax("user-123", ["msg-001"]);

    expect(result.enriched).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles fetch network error gracefully", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(
      makeMixmaxIntegration() as never
    );

    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      makeActivity(),
    ] as never);

    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await enrichActivitiesWithMixmax("user-123", ["msg-001"]);

    expect(result.enriched).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/Network failure/);
  });

  it("uses decrypted API key in the Authorization header", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(
      makeMixmaxIntegration({ accessToken: "enc-apikey" }) as never
    );

    // Provide at least one activity so the fetch path is reached
    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      makeActivity(),
    ] as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await enrichActivitiesWithMixmax("user-123", ["msg-001"]);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("mixmax.com"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-API-Token": "decrypted_enc-apikey",
        }),
      })
    );
  });

  it("handles activities with no linked contacts", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(
      makeMixmaxIntegration() as never
    );

    // Activity with empty contacts array
    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      makeActivity({ contacts: [] }),
    ] as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            _id: "seq-abc",
            name: "Outreach",
            stages: [{}],
          },
        ],
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            contact: { email: "someone@school.org" },
            currentStage: 1,
            status: "active",
            metrics: { opens: 1, clicks: 0 },
          },
        ],
      }),
    });

    const result = await enrichActivitiesWithMixmax("user-123", ["msg-001"]);

    expect(result.enriched).toBe(0);
    expect(prisma.activity.update).not.toHaveBeenCalled();
  });

  it("correctly uses decrypted API key (not the raw encrypted value)", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(
      makeMixmaxIntegration({ accessToken: "raw-encrypted-token" }) as never
    );

    // Provide at least one activity so the fetch path is reached
    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      makeActivity({ gmailMessageId: "msg-xyz" }),
    ] as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await enrichActivitiesWithMixmax("user-123", ["msg-xyz"]);

    const callArgs = mockFetch.mock.calls[0];
    const headers = callArgs[1]?.headers as Record<string, string>;
    // The mock decrypt prepends "decrypted_" so we verify that, not the raw value
    expect(headers["X-API-Token"]).toBe("decrypted_raw-encrypted-token");
    expect(headers["X-API-Token"]).not.toBe("raw-encrypted-token");
  });
});
