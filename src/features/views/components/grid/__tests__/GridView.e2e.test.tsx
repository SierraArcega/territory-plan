/**
 * GridView E2E — filter → debounced save → refetch
 *
 * Exercises the full chain:
 *   1. User clicks + Filter
 *   2. Picks "State" in the field picker
 *   3. Checks "NY" in the MultiSelect popover and clicks Apply
 *   4. A State chip appears immediately (optimistic local state)
 *   5. After 500ms debounce, useUpdatePlanLayout.mutate is called with the
 *      correct filter shape
 *   6. useViewsData is called again with the updated filter in its args
 *
 * Does NOT mock useGridLayout — it is the thing under test.
 * Mocks its dependencies: useUpdatePlanLayout, useUpdateListLayout,
 * useViewsData, and useEnumValues.
 */
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ── Module mocks ─────────────────────────────────────────────────────────────
// These must be declared before the dynamic imports below so Vitest can hoist
// them ahead of the module graph.

vi.mock("@/features/views/hooks/useViewsData", () => ({
  useViewsData: vi.fn(),
}));

vi.mock("@/features/views/hooks/useEnumValues", () => ({
  useEnumValues: vi.fn(),
}));

vi.mock("@/features/views/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/views/lib/queries")>();
  return {
    ...actual,
    useUpdatePlanLayout: vi.fn(),
    useUpdateListLayout: vi.fn(),
  };
});

// ── Import mocked hooks after vi.mock declarations ────────────────────────────
import GridView from "../GridView";
import { useViewsData } from "@/features/views/hooks/useViewsData";
import { useEnumValues } from "@/features/views/hooks/useEnumValues";
import { useUpdatePlanLayout, useUpdateListLayout } from "@/features/views/lib/queries";

// ── Shared mock fn for the mutation ──────────────────────────────────────────
const mutateMock = vi.fn();

// ── Wrapper ───────────────────────────────────────────────────────────────────

function wrap(children: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("GridView e2e — filter → debounced save → refetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // useViewsData always returns one row so the table renders (not EmptyState).
    (useViewsData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        rows: [{ leaid: "lea1", name: "Alpha USD", stateAbbrev: "NY", tier: "Tier 1", metricValue: 0, stage: "Prospect" }],
        total: 1,
      },
      isLoading: false,
      isError: false,
    });

    // useEnumValues returns stub state options for the State multiselect.
    (useEnumValues as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { values: [{ value: "NY", label: "NY" }, { value: "NJ", label: "NJ" }] },
      isLoading: false,
    });

    // useUpdatePlanLayout returns a mutation-shaped object.
    (useUpdatePlanLayout as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    });

    // useUpdateListLayout also needs a mock shape (called unconditionally by
    // the hook regardless of parentKind — Rules of Hooks).
    (useUpdateListLayout as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds a State filter, debounces the PATCH, and re-queries with the new filter", async () => {
    render(
      wrap(
        <GridView
          source="districts"
          leaids={["lea1", "lea2"]}
          listId={null}
          parentKind="plan"
          parentId="p1"
          viewType="table"
          savedLayouts={null}
        />,
      ),
    );

    // ── Step 1: Click + Filter ─────────────────────────────────────────────
    // The button renders as: <Plus icon><span>Filter</span>
    // getByText("Filter") matches the span inside the button.
    fireEvent.click(screen.getByText("Filter"));

    // ── Step 2: The FilterFieldPicker opens — click "State" ───────────────
    // FilterFieldPicker renders <button type="button">{col.header}</button>
    // inside a ".w-56" picker panel. "State" also appears in the table header
    // (<span>State</span> inside a th>button). Filter to buttons only.
    const stateButtons = screen.getAllByRole("button", { name: /^State$/i });
    // The picker button has class "block w-full" — pick the one that's inside
    // the picker panel (not the header sort button).
    const pickerStateBtn = stateButtons.find(
      (el) => el.className.includes("block w-full"),
    ) as HTMLButtonElement;
    fireEvent.click(pickerStateBtn);

    // ── Step 3: MultiSelectWidget is now open — check "NY" ────────────────
    // MultiSelectWidget renders: <label><input type="checkbox" /><span>NY</span></label>
    // getByLabelText works because the <input> is inside the <label> that contains "NY".
    const nyCheckbox = screen.getByLabelText("NY");
    fireEvent.click(nyCheckbox);

    // ── Step 4: Click Apply ────────────────────────────────────────────────
    fireEvent.click(screen.getByText("Apply"));

    // ── Assert: State chip is now rendered ────────────────────────────────
    // The chip renders: <span class="font-medium">State:</span>
    // screen.getByText("State:") matches the label portion of the chip.
    expect(screen.getByText("State:")).toBeInTheDocument();

    // ── Step 5: Advance fake timers past the 500ms debounce ───────────────
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // ── Assert: mutation was called exactly once with the right shape ──────
    expect(mutateMock).toHaveBeenCalledTimes(1);

    const arg = mutateMock.mock.calls[0][0] as Record<string, unknown>;
    // arg is the full ViewLayouts blob: { table: GridViewLayout }
    const tableLayout = arg.table as {
      filters: { children: Array<{ fieldId: string; kind: string; op?: string; values?: string[] }> };
    };
    expect(tableLayout.filters.children).toHaveLength(1);

    const leaf = tableLayout.filters.children[0];
    // The State column uses a multiselect widget → emits a FilterAny node.
    // FilterAny: { kind: "any", fieldId: "state", op: "in", values: ["NY"] }
    expect(leaf.fieldId).toBe("state");

    // ── Assert: useViewsData was called again with the filter in args ──────
    // Because the layout changes optimistically on Apply (before the debounce
    // fires), useViewsData should have been called with the updated filter.
    const calls = (useViewsData as ReturnType<typeof vi.fn>).mock.calls;
    // Find any call where the layout's filter children are non-empty.
    const filteredCall = calls.find(
      ([args]: [{ layout: { filters: { children: unknown[] } } }]) =>
        args.layout.filters.children.length === 1,
    );
    expect(filteredCall).toBeDefined();
    const filteredArg = filteredCall![0] as {
      layout: { filters: { children: Array<{ fieldId: string }> } };
    };
    expect(filteredArg.layout.filters.children[0].fieldId).toBe("state");
  });
});
