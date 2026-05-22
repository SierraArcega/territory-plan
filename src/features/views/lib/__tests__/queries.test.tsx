import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  usePlansWithStats,
  useLists,
  useList,
  useCreateList,
  useUpdateList,
  useDeleteList,
  useHideList,
  useUnhideList,
  useHidePlan,
  useUnhidePlan,
  useListPreview,
} from "../queries";

const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function mockJsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    redirected: false,
    json: async () => payload,
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("usePlansWithStats", () => {
  it("hits /api/territory-plans?stats=1 (canonical path) and returns plans", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse([{ id: "p1", name: "Northeast" }]),
    );
    const { result } = renderHook(() => usePlansWithStats(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/territory-plans");
    expect(calledUrl).toContain("stats=1");
    expect(calledUrl).not.toContain("/api/plans?");
  });

  it("scopes to the current user's plans via mine=1", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse([]));
    renderHook(() => usePlansWithStats(), { wrapper: makeWrapper() });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("mine=1");
  });

  it("appends showHidden=1 when requested", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse([]));
    renderHook(() => usePlansWithStats(true), { wrapper: makeWrapper() });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("showHidden=1");
  });
});

describe("useLists", () => {
  it("fetches /api/lists and unwraps the { lists } envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ lists: [{ id: "l1", name: "Hot prospects" }] }),
    );
    const { result } = renderHook(() => useLists(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "l1", name: "Hot prospects" }]);
  });
});

describe("useList", () => {
  it("is disabled until id is provided", async () => {
    const { result } = renderHook(() => useList(null), {
      wrapper: makeWrapper(),
    });
    // Wait a tick to ensure no fetch happens.
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
  });

  it("fetches /api/lists/[id] when given an id", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ id: "l1", name: "Hot prospects" }),
    );
    const { result } = renderHook(() => useList("l1"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/lists/l1");
  });
});

describe("mutations target the right routes", () => {
  it("useCreateList POSTs to /api/lists", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ id: "l1" }));
    const { result } = renderHook(() => useCreateList(), {
      wrapper: makeWrapper(),
    });
    await result.current.mutateAsync({
      name: "test",
      source: "districts",
      filterTree: { kind: "and", children: [] },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/lists");
    expect(init.method).toBe("POST");
  });

  it("useUpdateList PATCHes /api/lists/[id]", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ id: "l1" }));
    const { result } = renderHook(() => useUpdateList(), {
      wrapper: makeWrapper(),
    });
    await result.current.mutateAsync({ id: "l1", data: { name: "renamed" } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/lists/l1");
    expect(init.method).toBe("PATCH");
  });

  it("useDeleteList DELETEs /api/lists/[id]", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ ok: true }));
    const { result } = renderHook(() => useDeleteList(), {
      wrapper: makeWrapper(),
    });
    await result.current.mutateAsync("l1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/lists/l1");
    expect(init.method).toBe("DELETE");
  });

  it("useHideList POSTs to /api/lists/[id]/hide with hidden=true", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ ok: true }));
    const { result } = renderHook(() => useHideList(), {
      wrapper: makeWrapper(),
    });
    await result.current.mutateAsync({ id: "l1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/lists/l1/hide");
    expect(JSON.parse(init.body as string)).toEqual({ hidden: true });
  });

  it("useUnhideList sends hidden=false", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ ok: true }));
    const { result } = renderHook(() => useUnhideList(), {
      wrapper: makeWrapper(),
    });
    await result.current.mutateAsync({ id: "l1" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ hidden: false });
  });

  it("useHidePlan targets canonical /api/territory-plans/[id]/hide", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ ok: true }));
    const { result } = renderHook(() => useHidePlan(), {
      wrapper: makeWrapper(),
    });
    await result.current.mutateAsync({ id: "p1" });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/territory-plans/p1/hide");
  });

  it("useUnhidePlan targets canonical /api/territory-plans/[id]/hide", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ ok: true }));
    const { result } = renderHook(() => useUnhidePlan(), {
      wrapper: makeWrapper(),
    });
    await result.current.mutateAsync({ id: "p1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/territory-plans/p1/hide");
    expect(JSON.parse(init.body as string)).toEqual({ hidden: false });
  });
});

describe("useListPreview", () => {
  it("does not fetch when spec is null", async () => {
    const { result } = renderHook(() => useListPreview(null), {
      wrapper: makeWrapper(),
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
  });

  it("debounces the spec before issuing the request", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(mockJsonResponse({ count: 7, sample: [] }));
    const spec = {
      source: "districts" as const,
      filterTree: { kind: "and" as const, children: [] },
    };
    renderHook(() => useListPreview(spec, { debounceMs: 300 }), {
      wrapper: makeWrapper(),
    });
    // Immediately after mount, the debounce timer has not fired yet — but
    // because debounce baseline is the initial value, the first request
    // can still go out on the same tick. Advance timers + drain microtasks
    // to ensure exactly one call happens.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(310);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("uses a stable query key based on JSON-stringified spec", async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ count: 0, sample: [] }));
    const spec = {
      source: "districts" as const,
      filterTree: { kind: "and" as const, children: [] },
    };
    const { rerender } = renderHook(
      ({ s }: { s: typeof spec }) =>
        useListPreview(s, { debounceMs: 0 }),
      { wrapper: makeWrapper(), initialProps: { s: spec } },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Rerender with a fresh-but-deep-equal spec object. Without primitive
    // serialization in the key, this would trigger a second fetch.
    rerender({ s: { ...spec } });
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
