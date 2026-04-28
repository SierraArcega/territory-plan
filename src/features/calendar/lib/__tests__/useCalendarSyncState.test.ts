import { describe, it, expect } from "vitest";
import {
  deriveSyncState,
  SYNC_STALE_MS,
} from "../useCalendarSyncState";
import type { CalendarStatusResponse } from "@/features/shared/types/api-types";

const NOW = new Date("2026-04-27T12:00:00.000Z").getTime();

function buildStatus(overrides: {
  connected?: boolean;
  status?: "connected" | "disconnected" | "error";
  lastSyncAt?: string | null;
  pendingCount?: number;
}): CalendarStatusResponse {
  const connected = overrides.connected ?? true;
  const status = overrides.status ?? "connected";
  return {
    connected,
    pendingCount: overrides.pendingCount ?? 0,
    connection: connected
      ? {
          id: "conn-1",
          googleAccountEmail: "user@example.com",
          companyDomain: "example.com",
          syncEnabled: true,
          lastSyncAt:
            overrides.lastSyncAt === undefined
              ? new Date(NOW - 5 * 60 * 1000).toISOString()
              : overrides.lastSyncAt,
          status,
          syncDirection: "two_way",
          syncedActivityTypes: [],
          reminderMinutes: 0,
          secondReminderMinutes: null,
          createdAt: new Date(NOW - 86400_000).toISOString(),
          backfillStartDate: null,
          backfillCompletedAt: new Date(NOW - 86400_000).toISOString(),
          backfillWindowDays: null,
        }
      : null,
  };
}

describe("deriveSyncState", () => {
  it("returns 'disconnected' when payload is null", () => {
    expect(deriveSyncState(null, NOW)).toBe("disconnected");
  });

  it("returns 'disconnected' when not connected", () => {
    expect(deriveSyncState(buildStatus({ connected: false }), NOW)).toBe("disconnected");
  });

  it("returns 'disconnected' when status is 'error'", () => {
    expect(deriveSyncState(buildStatus({ status: "error" }), NOW)).toBe("disconnected");
  });

  it("returns 'connected' when last sync was recent and no pending events", () => {
    expect(deriveSyncState(buildStatus({}), NOW)).toBe("connected");
  });

  it("returns 'stale' when last sync exceeds the 30-minute threshold", () => {
    const old = new Date(NOW - SYNC_STALE_MS - 1000).toISOString();
    expect(deriveSyncState(buildStatus({ lastSyncAt: old }), NOW)).toBe("stale");
  });

  it("returns 'stale' when pendingCount > 0 even if last sync is recent", () => {
    expect(
      deriveSyncState(buildStatus({ pendingCount: 3 }), NOW)
    ).toBe("stale");
  });

  it("returns 'stale' when lastSyncAt is null", () => {
    expect(deriveSyncState(buildStatus({ lastSyncAt: null }), NOW)).toBe("stale");
  });

  it("respects the custom staleMs override", () => {
    const old = new Date(NOW - 10 * 60 * 1000).toISOString();
    expect(
      deriveSyncState(buildStatus({ lastSyncAt: old }), NOW, 5 * 60 * 1000)
    ).toBe("stale");
    expect(
      deriveSyncState(buildStatus({ lastSyncAt: old }), NOW, 30 * 60 * 1000)
    ).toBe("connected");
  });
});
