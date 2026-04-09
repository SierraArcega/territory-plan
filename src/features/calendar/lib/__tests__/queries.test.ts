import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type {
  CalendarStatusResponse,
  CalendarSyncResult,
} from "@/features/shared/types/api-types";

// ---------------------------------------------------------------------------
// Mock the shared fetch helper. All four hooks funnel through fetchJson, so we
// only need to intercept that one module.
// ---------------------------------------------------------------------------
vi.mock("@/features/shared/lib/api-client", () => ({
  API_BASE: "/api",
  fetchJson: vi.fn(),
}));

import { fetchJson } from "@/features/shared/lib/api-client";
import {
  useAutoSyncCalendarOnMount,
  useBackfillStatus,
  useStartBackfill,
  useCompleteBackfill,
} from "../queries";

const mockedFetchJson = fetchJson as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStatus(
  overrides: Partial<CalendarStatusResponse["connection"]> = {},
  opts: { connected?: boolean; pendingCount?: number } = {}
): CalendarStatusResponse {
  const base: CalendarStatusResponse["connection"] = {
    id: "conn-1",
    googleAccountEmail: "rep@fullmindlearning.com",
    companyDomain: "fullmindlearning.com",
    syncEnabled: true,
    lastSyncAt: null,
    status: "connected",
    syncDirection: "one_way",
    syncedActivityTypes: [],
    reminderMinutes: 10,
    secondReminderMinutes: null,
    createdAt: new Date().toISOString(),
    backfillStartDate: null,
    backfillCompletedAt: null,
    backfillWindowDays: null,
  };
  return {
    connected: opts.connected ?? true,
    connection: overrides ? { ...base, ...overrides } : base,
    pendingCount: opts.pendingCount ?? 0,
  };
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client },
      children as React.ReactElement
    );
  };
}

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

// ---------------------------------------------------------------------------
// useBackfillStatus
// ---------------------------------------------------------------------------

describe("useBackfillStatus", () => {
  beforeEach(() => {
    mockedFetchJson.mockReset();
  });

  it("reports needsSetup when connected with no backfill dates", async () => {
    mockedFetchJson.mockResolvedValue(makeStatus({}));
    const client = makeClient();
    const { result } = renderHook(() => useBackfillStatus(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.connected).toBe(true));
    expect(result.current.needsSetup).toBe(true);
    expect(result.current.needsResume).toBe(false);
    expect(result.current.backfillCompletedAt).toBeNull();
  });

  it("reports needsResume when backfillStartDate set but not completed", async () => {
    mockedFetchJson.mockResolvedValue(
      makeStatus({
        backfillStartDate: "2026-04-01T00:00:00.000Z",
        backfillCompletedAt: null,
      })
    );
    const client = makeClient();
    const { result } = renderHook(() => useBackfillStatus(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.needsResume).toBe(true));
    expect(result.current.needsSetup).toBe(false);
  });

  it("reports neither when backfill is complete", async () => {
    mockedFetchJson.mockResolvedValue(
      makeStatus({
        backfillStartDate: "2026-04-01T00:00:00.000Z",
        backfillCompletedAt: "2026-04-02T00:00:00.000Z",
      })
    );
    const client = makeClient();
    const { result } = renderHook(() => useBackfillStatus(), { wrapper: wrapper(client) });

    await waitFor(() =>
      expect(result.current.backfillCompletedAt).toBe("2026-04-02T00:00:00.000Z")
    );
    expect(result.current.needsSetup).toBe(false);
    expect(result.current.needsResume).toBe(false);
  });

  it("reports not connected when connection is missing", async () => {
    mockedFetchJson.mockResolvedValue({
      connected: false,
      connection: null,
      pendingCount: 0,
    });
    const client = makeClient();
    const { result } = renderHook(() => useBackfillStatus(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.connected).toBe(false);
    expect(result.current.needsSetup).toBe(false);
    expect(result.current.needsResume).toBe(false);
  });

  it("exposes loading state from the underlying query", async () => {
    // Never resolve — hook should remain loading
    mockedFetchJson.mockImplementation(() => new Promise(() => {}));
    const client = makeClient();
    const { result } = renderHook(() => useBackfillStatus(), { wrapper: wrapper(client) });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.connected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useAutoSyncCalendarOnMount
// ---------------------------------------------------------------------------

describe("useAutoSyncCalendarOnMount", () => {
  beforeEach(() => {
    mockedFetchJson.mockReset();
  });

  it("skips sync when not connected", async () => {
    mockedFetchJson.mockResolvedValue({
      connected: false,
      connection: null,
      pendingCount: 0,
    });
    const client = makeClient();
    const { result } = renderHook(() => useAutoSyncCalendarOnMount(), {
      wrapper: wrapper(client),
    });

    // Wait for the status query to settle without triggering act warnings.
    await waitFor(() => expect(result.current).toBeDefined());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    const syncCalls = mockedFetchJson.mock.calls.filter(([url]) =>
      String(url).includes("/calendar/sync")
    );
    expect(syncCalls).toHaveLength(0);
  });

  it("skips sync when backfillCompletedAt is null", async () => {
    mockedFetchJson.mockResolvedValue(
      makeStatus({ backfillStartDate: "2026-04-01T00:00:00.000Z", backfillCompletedAt: null })
    );
    const client = makeClient();
    const { result } = renderHook(() => useAutoSyncCalendarOnMount(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current).toBeDefined());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    const syncCalls = mockedFetchJson.mock.calls.filter(([url]) =>
      String(url).includes("/calendar/sync")
    );
    expect(syncCalls).toHaveLength(0);
  });

  it("skips sync when syncEnabled is false", async () => {
    mockedFetchJson.mockResolvedValue(
      makeStatus({
        syncEnabled: false,
        backfillCompletedAt: "2026-04-02T00:00:00.000Z",
      })
    );
    const client = makeClient();
    const { result } = renderHook(() => useAutoSyncCalendarOnMount(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current).toBeDefined());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    const syncCalls = mockedFetchJson.mock.calls.filter(([url]) =>
      String(url).includes("/calendar/sync")
    );
    expect(syncCalls).toHaveLength(0);
  });

  it("fires sync exactly once when connected and backfill complete, and calls onNewEvents", async () => {
    const syncResult: CalendarSyncResult = {
      eventsProcessed: 3,
      newEvents: 2,
      updatedEvents: 0,
      cancelledEvents: 0,
      errors: [],
    };
    mockedFetchJson.mockImplementation((url: string) => {
      if (url.includes("/calendar/status")) {
        return Promise.resolve(
          makeStatus({ backfillCompletedAt: "2026-04-02T00:00:00.000Z" })
        );
      }
      if (url.includes("/calendar/sync")) {
        return Promise.resolve(syncResult);
      }
      return Promise.resolve({});
    });

    const client = makeClient();
    const newEventsCb = vi.fn();

    const { result, rerender } = renderHook(() => useAutoSyncCalendarOnMount(), {
      wrapper: wrapper(client),
    });

    // Wire up the callback so the effect's onSuccess has a target
    act(() => {
      result.current.setOnNewEvents(newEventsCb);
    });

    await waitFor(() => {
      const syncCalls = mockedFetchJson.mock.calls.filter(([url]) =>
        String(url).includes("/calendar/sync")
      );
      expect(syncCalls).toHaveLength(1);
    });

    await waitFor(() => expect(newEventsCb).toHaveBeenCalledWith(2));

    // Rerender should not fire another sync — ranRef guards it
    rerender();
    await new Promise((r) => setTimeout(r, 10));
    const syncCalls = mockedFetchJson.mock.calls.filter(([url]) =>
      String(url).includes("/calendar/sync")
    );
    expect(syncCalls).toHaveLength(1);
  });

  it("does not fire onNewEvents when newEvents === 0", async () => {
    mockedFetchJson.mockImplementation((url: string) => {
      if (url.includes("/calendar/status")) {
        return Promise.resolve(
          makeStatus({ backfillCompletedAt: "2026-04-02T00:00:00.000Z" })
        );
      }
      if (url.includes("/calendar/sync")) {
        return Promise.resolve({
          eventsProcessed: 0,
          newEvents: 0,
          updatedEvents: 0,
          cancelledEvents: 0,
          errors: [],
        });
      }
      return Promise.resolve({});
    });

    const client = makeClient();
    const newEventsCb = vi.fn();
    const { result } = renderHook(() => useAutoSyncCalendarOnMount(), {
      wrapper: wrapper(client),
    });
    act(() => {
      result.current.setOnNewEvents(newEventsCb);
    });

    await waitFor(() => {
      const syncCalls = mockedFetchJson.mock.calls.filter(([url]) =>
        String(url).includes("/calendar/sync")
      );
      expect(syncCalls).toHaveLength(1);
    });
    expect(newEventsCb).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useStartBackfill + useCompleteBackfill
// ---------------------------------------------------------------------------

describe("useStartBackfill", () => {
  beforeEach(() => {
    mockedFetchJson.mockReset();
  });

  it("POSTs to /calendar/backfill/start with the selected days", async () => {
    mockedFetchJson.mockResolvedValue({
      eventsProcessed: 0,
      newEvents: 0,
      updatedEvents: 0,
      cancelledEvents: 0,
      errors: [],
      pendingCount: 0,
    });
    const client = makeClient();
    const { result } = renderHook(() => useStartBackfill(), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.mutateAsync(30);
    });

    expect(mockedFetchJson).toHaveBeenCalledWith(
      "/api/calendar/backfill/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ days: 30 }),
      })
    );
  });
});

describe("useCompleteBackfill", () => {
  beforeEach(() => {
    mockedFetchJson.mockReset();
  });

  it("POSTs to /calendar/backfill/complete", async () => {
    mockedFetchJson.mockResolvedValue({ success: true });
    const client = makeClient();
    const { result } = renderHook(() => useCompleteBackfill(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockedFetchJson).toHaveBeenCalledWith(
      "/api/calendar/backfill/complete",
      expect.objectContaining({ method: "POST" })
    );
  });
});
