import { describe, it, expect, vi, beforeEach } from "vitest";

// app-settings imports "server-only"; stub it so the test can import the module.
vi.mock("server-only", () => ({}));

const { mockFindUnique, mockUpsert } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: { appSetting: { findUnique: mockFindUnique, upsert: mockUpsert } },
}));

import {
  DROPBOX_SIGN_TEST_MODE_KEY,
  dropboxSignTestModeFromValue,
  getDropboxSignTestMode,
  setAppSetting,
} from "../app-settings";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dropboxSignTestModeFromValue", () => {
  it("returns the value for explicit booleans", () => {
    expect(dropboxSignTestModeFromValue(false)).toBe(false);
    expect(dropboxSignTestModeFromValue(true)).toBe(true);
  });

  it("fails safe to true for anything else", () => {
    expect(dropboxSignTestModeFromValue(undefined)).toBe(true);
    expect(dropboxSignTestModeFromValue(null)).toBe(true);
    expect(dropboxSignTestModeFromValue("0")).toBe(true);
    expect(dropboxSignTestModeFromValue(0)).toBe(true);
  });
});

describe("getDropboxSignTestMode", () => {
  it("returns true when no row exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await getDropboxSignTestMode()).toBe(true);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { key: DROPBOX_SIGN_TEST_MODE_KEY } });
  });

  it("returns the stored boolean", async () => {
    mockFindUnique.mockResolvedValue({ key: DROPBOX_SIGN_TEST_MODE_KEY, value: false });
    expect(await getDropboxSignTestMode()).toBe(false);
  });

  it("fails safe to true on a malformed value", async () => {
    mockFindUnique.mockResolvedValue({ key: DROPBOX_SIGN_TEST_MODE_KEY, value: "live" });
    expect(await getDropboxSignTestMode()).toBe(true);
  });

  it("propagates DB errors (send must fail loudly, not silently flip mode)", async () => {
    mockFindUnique.mockRejectedValue(new Error("db down"));
    await expect(getDropboxSignTestMode()).rejects.toThrow("db down");
  });
});

describe("setAppSetting", () => {
  it("upserts value + updatedById", async () => {
    mockUpsert.mockResolvedValue({ key: DROPBOX_SIGN_TEST_MODE_KEY, value: false });
    await setAppSetting(DROPBOX_SIGN_TEST_MODE_KEY, false, "admin-uuid");
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { key: DROPBOX_SIGN_TEST_MODE_KEY },
      create: { key: DROPBOX_SIGN_TEST_MODE_KEY, value: false, updatedById: "admin-uuid" },
      update: { value: false, updatedById: "admin-uuid" },
    });
  });
});
