import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const planMutate = vi.fn();
const listMutate = vi.fn();
vi.mock("@/features/views/lib/queries", () => ({
  useUpdatePlanLayout: () => ({ mutate: planMutate }),
  useUpdateListLayout: () => ({ mutate: listMutate }),
}));

import { useKanbanLayout, DEFAULT_KANBAN_LAYOUT } from "../useKanbanLayout";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

describe("useKanbanLayout", () => {
  it("seeds from savedLayouts.kanban when present, else the default", () => {
    const { result: a } = renderHook(() =>
      useKanbanLayout({ parentKind: "plan", parentId: "p1", savedLayouts: null }),
    );
    expect(a.current.layout).toEqual(DEFAULT_KANBAN_LAYOUT);

    const seeded = { filters: { kind: "and" as const, children: [] }, sort: [{ id: "close_date", dir: "asc" as const }], rankBuckets: [], rankSort: null };
    const { result: b } = renderHook(() =>
      useKanbanLayout({ parentKind: "plan", parentId: "p1", savedLayouts: { kanban: seeded } }),
    );
    expect(b.current.layout.sort).toEqual([{ id: "close_date", dir: "asc" }]);
  });

  it("optimistically updates and debounces a PATCH that merges into the blob", () => {
    const { result } = renderHook(() =>
      useKanbanLayout({
        parentKind: "plan",
        parentId: "p1",
        savedLayouts: { opps: { columns: [], sort: [], filters: { kind: "and", children: [] }, groupBy: null } } as never,
      }),
    );
    const next = { ...DEFAULT_KANBAN_LAYOUT, rankSort: "desc" as const };
    act(() => result.current.setLayout(next));
    expect(result.current.layout.rankSort).toBe("desc"); // optimistic
    expect(planMutate).not.toHaveBeenCalled(); // debounced
    act(() => vi.advanceTimersByTime(500));
    expect(planMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        opps: expect.anything(), // preserved
        kanban: next,            // merged
      }),
    );
  });
});
