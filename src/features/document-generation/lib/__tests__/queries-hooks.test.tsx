import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Hook-level regression tests for the doc-gen query hooks. Both hooks funnel
// through the shared fetchJson helper, so mocking that one module is enough.
// ---------------------------------------------------------------------------
vi.mock("@/features/shared/lib/api-client", () => ({
  API_BASE: "/api",
  fetchJson: vi.fn(),
}));

import { fetchJson } from "@/features/shared/lib/api-client";
import {
  useDocGenSettings,
  useGeneratedDocumentStatus,
  SEND_POLL_MS,
  SEND_POLL_MAX_UPDATES,
} from "../queries";

const mockedFetchJson = vi.mocked(fetchJson);

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  // mockReset (not mockClear) — drop any unconsumed mockResolvedValueOnce
  // queue so one test's leftover payloads can't leak into the next.
  mockedFetchJson.mockReset();
});

// ---------------------------------------------------------------------------
// Bug 1 — test-mode callout must never serve a stale cached value.
// The admin can flip Test Mode at any moment; a modal remount within the old
// 60s staleTime window served the cached value with no refetch, so the
// ReviewStage amber callout never appeared.
// ---------------------------------------------------------------------------
describe("useDocGenSettings freshness", () => {
  it("refetches on remount so an admin test-mode flip is picked up", async () => {
    const queryClient = createClient();
    const wrapper = createWrapper(queryClient);

    // First mount: admin toggle is Live.
    mockedFetchJson.mockResolvedValueOnce({ testMode: false });
    const first = renderHook(() => useDocGenSettings(), { wrapper });
    await waitFor(() => expect(first.result.current.data).toEqual({ testMode: false }));
    first.unmount();

    // Admin flips Test Mode back ON. Reopening the modal (remount) must
    // refetch instead of serving the cached { testMode: false }.
    mockedFetchJson.mockResolvedValueOnce({ testMode: true });
    const second = renderHook(() => useDocGenSettings(), { wrapper });
    await waitFor(() => expect(second.result.current.data).toEqual({ testMode: true }));
    expect(mockedFetchJson).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Bug 2 — pollTimedOut must flip even when every poll returns identical data.
// Structural sharing keeps `data` referentially stable across identical polls,
// so without a forced notification the component stops re-rendering and the
// render-time pollTimedOut computation is never re-read — the send banner
// stays frozen at "Sending…" instead of flipping to "awaiting confirmation".
// ---------------------------------------------------------------------------
describe("useGeneratedDocumentStatus poll timeout on identical-data polls", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flips pollTimedOut after the update budget when the payload never changes", async () => {
    // Webhook can't reach localhost → every poll returns the SAME payload.
    mockedFetchJson.mockImplementation(async () => ({
      id: 12,
      status: "processing",
      errorMessage: null,
      recipientEmail: "x@y.org",
      docUrl: "u",
    }));

    const queryClient = createClient();
    const { result, unmount } = renderHook(() => useGeneratedDocumentStatus(12), {
      wrapper: createWrapper(queryClient),
    });

    // Flush the initial fetch (TanStack's notifyManager batches notifications
    // through setTimeout(0), so a small non-zero advance is needed).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(result.current.data?.status).toBe("processing");
    expect(result.current.pollTimedOut).toBe(false);

    // Advance through the full poll budget (plus slack) — each cycle returns
    // identical data, so dataUpdateCount climbs while `data` stays stable.
    for (let i = 0; i < SEND_POLL_MAX_UPDATES + 2; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SEND_POLL_MS);
      });
    }

    expect(result.current.pollTimedOut).toBe(true);

    unmount();
  });
});
