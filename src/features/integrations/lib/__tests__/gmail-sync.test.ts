import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Prisma before any imports that reference it
// ---------------------------------------------------------------------------
vi.mock("@/lib/prisma", () => {
  return {
    default: {
      contact: { findMany: vi.fn() },
      userIntegration: { findUnique: vi.fn(), update: vi.fn() },
      activity: { upsert: vi.fn() },
      activityDistrict: { upsert: vi.fn() },
      activityContact: { upsert: vi.fn() },
    },
  };
});

// Mock the Google Gmail helpers
vi.mock("@/features/integrations/lib/google-gmail", () => ({
  refreshGmailToken: vi.fn(),
  isTokenExpired: vi.fn(),
}));

// Mock the encryption module
vi.mock("@/features/integrations/lib/encryption", () => ({
  decrypt: vi.fn((v: string) => `decrypted_${v}`),
  encrypt: vi.fn((v: string) => `encrypted_${v}`),
}));

// Mock googleapis
vi.mock("googleapis", () => {
  const mockList = vi.fn();
  const mockGet = vi.fn();
  const mockHistoryList = vi.fn();
  return {
    google: {
      auth: {
        OAuth2: vi.fn().mockImplementation(() => ({
          setCredentials: vi.fn(),
        })),
      },
      gmail: vi.fn(() => ({
        users: {
          messages: { list: mockList, get: mockGet },
          history: { list: mockHistoryList },
        },
      })),
    },
    __mockList: mockList,
    __mockGet: mockGet,
    __mockHistoryList: mockHistoryList,
  };
});

import prisma from "@/lib/prisma";
import { matchEmailToContacts, syncGmailMessages } from "../gmail-sync";
import { isTokenExpired, refreshGmailToken } from "../google-gmail";
import { decrypt } from "../encryption";

// ---------------------------------------------------------------------------
// matchEmailToContacts
// ---------------------------------------------------------------------------
describe("matchEmailToContacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("matches emails to contacts and returns district leaids", async () => {
    const mockContacts = [
      { id: 1, email: "jane@school.org", leaid: "0100001" },
      { id: 2, email: "bob@district.edu", leaid: "0100002" },
    ];
    vi.mocked(prisma.contact.findMany).mockResolvedValue(mockContacts as never);

    const result = await matchEmailToContacts([
      "jane@school.org",
      "bob@district.edu",
    ]);

    expect(prisma.contact.findMany).toHaveBeenCalledWith({
      where: { email: { in: ["jane@school.org", "bob@district.edu"], mode: "insensitive" } },
      select: { id: true, email: true, leaid: true },
    });

    expect(result).toEqual([
      { contactId: 1, contactEmail: "jane@school.org", districtLeaid: "0100001" },
      { contactId: 2, contactEmail: "bob@district.edu", districtLeaid: "0100002" },
    ]);
  });

  it("returns empty array when no emails provided", async () => {
    const result = await matchEmailToContacts([]);

    expect(prisma.contact.findMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns empty array when no contacts match", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([] as never);

    const result = await matchEmailToContacts(["unknown@example.com"]);

    expect(result).toEqual([]);
  });

  it("performs case-insensitive matching via Prisma mode", async () => {
    const mockContacts = [
      { id: 5, email: "Admin@School.Org", leaid: "0200001" },
    ];
    vi.mocked(prisma.contact.findMany).mockResolvedValue(mockContacts as never);

    const result = await matchEmailToContacts(["admin@school.org"]);

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { in: ["admin@school.org"], mode: "insensitive" } },
      })
    );

    expect(result).toEqual([
      { contactId: 5, contactEmail: "Admin@School.Org", districtLeaid: "0200001" },
    ]);
  });

  it("filters out contacts without email or leaid", async () => {
    const mockContacts = [
      { id: 1, email: "good@school.org", leaid: "0100001" },
      { id: 2, email: null, leaid: "0100002" },
      { id: 3, email: "nodistrict@example.com", leaid: null },
    ];
    vi.mocked(prisma.contact.findMany).mockResolvedValue(mockContacts as never);

    const result = await matchEmailToContacts([
      "good@school.org",
      "nodistrict@example.com",
    ]);

    // Only the contact with both email and leaid should be returned
    expect(result).toEqual([
      { contactId: 1, contactEmail: "good@school.org", districtLeaid: "0100001" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// syncGmailMessages
// ---------------------------------------------------------------------------
describe("syncGmailMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no Gmail integration exists", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(null as never);

    const result = await syncGmailMessages("user-123");

    expect(result.errors).toContain("No Gmail connection found");
    expect(result.messagesProcessed).toBe(0);
  });

  it("returns error when sync is disabled", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue({
      id: "int-1",
      userId: "user-123",
      service: "gmail",
      syncEnabled: false,
      accessToken: "enc-token",
      refreshToken: "enc-refresh",
      tokenExpiresAt: new Date(Date.now() + 3600_000),
      metadata: null,
    } as never);

    const result = await syncGmailMessages("user-123");

    expect(result.errors).toContain("Gmail sync is disabled");
  });

  it("refreshes expired token before syncing", async () => {
    vi.mocked(isTokenExpired).mockReturnValue(true);
    vi.mocked(refreshGmailToken).mockResolvedValue({
      accessToken: "new-token",
      expiresAt: new Date(Date.now() + 3600_000),
    });

    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue({
      id: "int-1",
      userId: "user-123",
      service: "gmail",
      syncEnabled: true,
      accessToken: "enc-token",
      refreshToken: "enc-refresh",
      tokenExpiresAt: new Date(Date.now() - 1000),
      metadata: null,
      status: "connected",
    } as never);

    // Import the mock list/get functions
    const { __mockList, __mockGet } = await import("googleapis") as unknown as {
      __mockList: ReturnType<typeof vi.fn>;
      __mockGet: ReturnType<typeof vi.fn>;
    };

    __mockList.mockResolvedValue({ data: { messages: [], resultSizeEstimate: 0 } });

    const result = await syncGmailMessages("user-123");

    expect(refreshGmailToken).toHaveBeenCalled();
    expect(prisma.userIntegration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "int-1" },
        data: expect.objectContaining({
          accessToken: "encrypted_new-token",
        }),
      })
    );
    expect(result.errors).toEqual([]);
  });
});
