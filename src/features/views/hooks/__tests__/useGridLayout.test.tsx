/**
 * Tests for useGridLayout hook.
 *
 * Strategy:
 *  - Mock the two mutation hooks (useUpdatePlanLayout / useUpdateListLayout)
 *    so tests don't need a real server.
 *  - Use vi.useFakeTimers() for debounce assertions.
 *  - Wrap in a QueryClientProvider so the mocked hooks can call useQueryClient
 *    without crashing (they don't actually need it, but the real imports would).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useGridLayout } from "../useGridLayout";
import type { ViewLayouts } from "@/lib/saved-views/grid-layout-schema";
import { getDefaultLayoutColumns } from "@/features/views/lib/columns";

// ── Mock the mutation hooks ──────────────────────────────────────────────────

const mutatePlan = vi.fn();
const mutateList = vi.fn();

vi.mock("@/features/views/lib/queries", () => ({
  useUpdatePlanLayout: (_planId: string) => ({ mutate: mutatePlan }),
  useUpdateListLayout: (_listId: string) => ({ mutate: mutateList }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const BASE_ARGS = {
  parentKind: "plan" as const,
  parentId: "plan-1",
  viewType: "table" as const,
  source: "districts" as const,
  savedLayouts: null as ViewLayouts,
};

beforeEach(() => {
  mutatePlan.mockReset();
  mutateList.mockReset();
});

afterEach(() => {
  // Always restore real timers in case a test left fake ones active.
  vi.useRealTimers();
});

// ── Test cases ───────────────────────────────────────────────────────────────

describe("useGridLayout — initial layout", () => {
  it("returns a default layout when savedLayouts is null", () => {
    const { result } = renderHook(
      () => useGridLayout({ ...BASE_ARGS, savedLayouts: null }),
      { wrapper: makeWrapper() },
    );
    const expectedColumns = getDefaultLayoutColumns("districts");
    expect(result.current.layout.columns).toEqual(expectedColumns);
    expect(result.current.layout.sort).toEqual([]);
    expect(result.current.layout.filters).toEqual({
      kind: "and",
      children: [],
    });
  });

  it("returns the savedLayout for the viewType when provided", () => {
    const savedLayouts: ViewLayouts = {
      table: {
        columns: [{ id: "name", order: 0, visible: true }],
        sort: [{ id: "name", dir: "asc" }],
        filters: { kind: "and", children: [] },
      },
    };
    const { result } = renderHook(
      () => useGridLayout({ ...BASE_ARGS, savedLayouts }),
      { wrapper: makeWrapper() },
    );
    expect(result.current.layout.columns).toEqual([
      { id: "name", order: 0, visible: true },
    ]);
    expect(result.current.layout.sort).toEqual([{ id: "name", dir: "asc" }]);
  });
});

describe("useGridLayout — setLayout optimistic update", () => {
  it("setLayout(next) updates local state immediately", () => {
    vi.useFakeTimers();
    const { result } = renderHook(
      () => useGridLayout({ ...BASE_ARGS, savedLayouts: null }),
      { wrapper: makeWrapper() },
    );

    const next = {
      columns: [{ id: "state", order: 1, visible: true }],
      sort: [],
      filters: { kind: "and" as const, children: [] },
    };

    act(() => {
      result.current.setLayout(next);
    });

    // State updated before timer fires.
    expect(result.current.layout.columns).toEqual(next.columns);
    expect(mutatePlan).not.toHaveBeenCalled();
  });
});

describe("useGridLayout — debounced save", () => {
  it("fires planMutation after 500ms with merged viewLayouts", async () => {
    vi.useFakeTimers();

    const savedLayouts: ViewLayouts = {
      contacts: {
        columns: [{ id: "name", order: 0, visible: true }],
        sort: [],
        filters: { kind: "and", children: [] },
      },
    };

    const { result } = renderHook(
      () =>
        useGridLayout({
          ...BASE_ARGS,
          savedLayouts,
        }),
      { wrapper: makeWrapper() },
    );

    const next = {
      columns: [{ id: "enrollment", order: 3, visible: true }],
      sort: [{ id: "name", dir: "asc" as const }],
      filters: { kind: "and" as const, children: [] },
    };

    act(() => {
      result.current.setLayout(next);
    });

    // Before 500ms — no mutation yet.
    expect(mutatePlan).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mutatePlan).toHaveBeenCalledTimes(1);
    const called = mutatePlan.mock.calls[0][0] as ViewLayouts;
    // The current viewType slot is updated.
    expect(called?.table).toEqual(next);
    // Other view-type slots are preserved.
    expect(called?.contacts).toEqual(savedLayouts.contacts);
  });

  it("fires listMutation (not planMutation) when parentKind is list", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(
      () =>
        useGridLayout({
          ...BASE_ARGS,
          parentKind: "list",
          parentId: "list-42",
          savedLayouts: null,
        }),
      { wrapper: makeWrapper() },
    );

    act(() => {
      result.current.setLayout({
        columns: [],
        sort: [],
        filters: { kind: "and", children: [] },
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mutateList).toHaveBeenCalledTimes(1);
    expect(mutatePlan).not.toHaveBeenCalled();
  });

  it("multiple setLayout calls within 500ms collapse to a single mutation", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(
      () => useGridLayout({ ...BASE_ARGS, savedLayouts: null }),
      { wrapper: makeWrapper() },
    );

    const makeLayout = (id: string) => ({
      columns: [{ id, order: 0, visible: true }],
      sort: [],
      filters: { kind: "and" as const, children: [] },
    });

    act(() => {
      result.current.setLayout(makeLayout("name"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    act(() => {
      result.current.setLayout(makeLayout("state"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    act(() => {
      result.current.setLayout(makeLayout("enrollment"));
    });

    // 200ms after last call — still within debounce window.
    expect(mutatePlan).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Only one mutation fires, with the last layout.
    expect(mutatePlan).toHaveBeenCalledTimes(1);
    const called = mutatePlan.mock.calls[0][0] as ViewLayouts;
    expect(called?.table?.columns).toEqual([
      { id: "enrollment", order: 0, visible: true },
    ]);
  });

  it("cleanup: unmounting cancels the pending debounce timer", async () => {
    vi.useFakeTimers();

    const { result, unmount } = renderHook(
      () => useGridLayout({ ...BASE_ARGS, savedLayouts: null }),
      { wrapper: makeWrapper() },
    );

    act(() => {
      result.current.setLayout({
        columns: [],
        sort: [],
        filters: { kind: "and", children: [] },
      });
    });

    // Unmount before the debounce fires.
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    // Timer was cancelled — no mutation.
    expect(mutatePlan).not.toHaveBeenCalled();
  });
});
