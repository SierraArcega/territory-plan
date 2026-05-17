import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import GridView from "../GridView";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";
import { SOURCE_COLUMNS } from "@/features/views/lib/columns";

// Control what useViewsData returns in each test.
const mockUseViewsData = vi.fn();
vi.mock("@/features/views/hooks/useViewsData", () => ({
  useViewsData: (...args: unknown[]) => mockUseViewsData(...args),
}));

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

/** A minimal valid GridViewLayout with no overrides. */
function emptyLayout(): GridViewLayout {
  return {
    columns: [],
    sort: [],
    filters: { kind: "and", children: [] },
  };
}

beforeEach(() => {
  mockUseViewsData.mockReset();
});

// ---------------------------------------------------------------------------
// Districts: default visible columns
// ---------------------------------------------------------------------------
describe("GridView — districts source", () => {
  it("renders default visible columns from SOURCE_COLUMNS.districts when layout columns are empty", () => {
    const defaultVisibleHeaders = SOURCE_COLUMNS.districts
      .filter((c) => c.defaultVisible)
      .map((c) => c.header);

    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        rows: [{ name: "Acme USD", stateAbbrev: "CA", tier: "Tier 1", metricValue: 42000, stage: "Prospect" }],
        total: 1,
      },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["0100005"]}
          listId={null}
          layout={emptyLayout()}
        />
      </Wrapper>,
    );

    for (const header of defaultVisibleHeaders) {
      // Multiple columns share short headers like "Count" / "Min" / "Max"
      // (one per deal-status group), so allow any number of matches as long
      // as the header is rendered somewhere.
      expect(
        screen.getAllByText(header).length,
        `Expected header "${header}" to be present`,
      ).toBeGreaterThan(0);
    }
  });

  it("hides non-visible columns when layout sets visible: false for 'state'", () => {
    const layout: GridViewLayout = {
      columns: [{ id: "state", order: 1, visible: false }],
      sort: [],
      filters: { kind: "and", children: [] },
    };

    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        rows: [{ name: "Acme USD", metricValue: 0, stage: "Prospect", tier: "Tier 1" }],
        total: 1,
      },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["0100005"]}
          listId={null}
          layout={layout}
        />
      </Wrapper>,
    );

    // "State" header must not appear since visible: false
    expect(screen.queryByText("State")).toBeNull();
    // "District" header should still appear (defaultVisible: true, not overridden)
    expect(screen.getByText("District")).toBeTruthy();
  });

  it("reorders columns when layout sets non-default order", () => {
    // Put "Target" before "District" (defaultOrder 0) via layout overrides.
    const layout: GridViewLayout = {
      columns: [
        { id: "name",    order: 99,  visible: true },
        { id: "state",   order: 100, visible: false },
        { id: "pipeline", order: 102, visible: false },
        { id: "target",  order: 0,   visible: true },
      ],
      sort: [],
      filters: { kind: "and", children: [] },
    };

    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        rows: [{ name: "Acme USD", target: 0 }],
        total: 1,
      },
    });

    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["0100005"]}
          listId={null}
          layout={layout}
        />
      </Wrapper>,
    );

    const headers = container.querySelectorAll("th");
    const headerTexts = Array.from(headers).map((h) => h.textContent?.trim());

    // Target (order: 0) should appear before District (order: 99) in the rendered header row.
    const targetIdx = headerTexts.indexOf("Target");
    const districtIdx = headerTexts.indexOf("District");
    expect(targetIdx).toBeGreaterThanOrEqual(0);
    expect(districtIdx).toBeGreaterThanOrEqual(0);
    expect(targetIdx).toBeLessThan(districtIdx);
  });

  it("renders rows with data-row-kind='district' for districts source", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        rows: [
          { leaid: "0100005", name: "Mountain USD", stateAbbrev: "CA", tier: "Tier 1", metricValue: 0, stage: "Prospect" },
          { leaid: "0100006", name: "Valley USD",   stateAbbrev: "CA", tier: "Tier 2", metricValue: 0, stage: "Customer" },
        ],
        total: 2,
      },
    });

    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["0100005", "0100006"]}
          listId={null}
          layout={emptyLayout()}
        />
      </Wrapper>,
    );

    const rows = container.querySelectorAll("tr[data-row-kind]");
    expect(rows.length).toBe(2);
    for (const row of Array.from(rows)) {
      expect(row.getAttribute("data-row-kind")).toBe("district");
    }
    expect(
      (container.querySelector("tr[data-row-id='0100005']") as HTMLElement | null)?.getAttribute("data-row-id"),
    ).toBe("0100005");
  });
});

// ---------------------------------------------------------------------------
// Opps: data-row-kind + visible columns
// ---------------------------------------------------------------------------
describe("GridView — opps source", () => {
  it("renders rows with data-row-kind='opp' for opps source", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        rows: [{ id: "opp-1", stage: "Proposal", netBookingAmount: 50000, closeDate: "2026-06-01", ownerName: "Sierra" }],
        total: 1,
      },
    });

    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <GridView
          source="opps"
          leaids={["0100005"]}
          listId={null}
          layout={emptyLayout()}
        />
      </Wrapper>,
    );

    const row = container.querySelector("tr[data-row-kind='opp']");
    expect(row).not.toBeNull();
    expect(row?.getAttribute("data-row-id")).toBe("opp-1");
  });
});

// ---------------------------------------------------------------------------
// Loading and empty states
// ---------------------------------------------------------------------------
describe("GridView — query states", () => {
  it("renders LoadingState while query is loading", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    });

    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["0100005"]}
          listId={null}
          layout={emptyLayout()}
        />
      </Wrapper>,
    );

    // LoadingState renders an aria-busy list
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("renders EmptyState when rows array is empty", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: [], total: 0 },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["0100005"]}
          listId={null}
          layout={emptyLayout()}
        />
      </Wrapper>,
    );

    expect(screen.getByText("No matching rows")).toBeTruthy();
  });

  it("renders ErrorState when query errors", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error("Network failure"),
      data: undefined,
      refetch: vi.fn(),
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["0100005"]}
          listId={null}
          layout={emptyLayout()}
        />
      </Wrapper>,
    );

    expect(screen.getByText("Network failure")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Contacts: data-row-kind
// ---------------------------------------------------------------------------
describe("GridView — contacts source", () => {
  it("renders rows with data-row-kind='contact' for contacts source", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        rows: [{ id: "c-1", name: "Jane Doe", title: "Superintendent", persona: "champion", seniorityLevel: "C-level", leaid: "0100005" }],
        total: 1,
      },
    });

    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <GridView
          source="contacts"
          leaids={["0100005"]}
          listId={null}
          layout={emptyLayout()}
        />
      </Wrapper>,
    );

    const row = container.querySelector("tr[data-row-kind='contact']");
    expect(row).not.toBeNull();
    expect(row?.getAttribute("data-row-id")).toBe("c-1");
  });
});

// ---------------------------------------------------------------------------
// Sort interaction: single-sort and shift-click multi-sort
// ---------------------------------------------------------------------------
describe("GridView — sort interactions", () => {
  /** Render GridView with prop-driven layout so we can capture layout changes. */
  function renderWithLayout(initial: GridViewLayout) {
    let current = initial;
    const onChange = vi.fn((next: GridViewLayout) => { current = next; });

    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        rows: [{ name: "Acme USD", stateAbbrev: "CA", tier: "Tier 1", metricValue: 42000, stage: "Prospect" }],
        total: 1,
      },
    });

    const Wrapper = makeWrapper();
    const utils = render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["0100005"]}
          listId={null}
          layout={current}
          onLayoutChange={onChange}
        />
      </Wrapper>,
    );

    return { ...utils, onChange, getCurrent: () => current };
  }

  /**
   * Find a column header button by text — the `<th>` contains the text.
   * Distinguishes from sort chips, which live in the toolbar above the table.
   */
  function headerButton(label: string): HTMLButtonElement {
    const ths = Array.from(document.querySelectorAll("th"));
    for (const th of ths) {
      if (th.textContent?.includes(label)) {
        const btn = th.querySelector("button");
        if (btn) return btn as HTMLButtonElement;
      }
    }
    throw new Error(`No header button found for "${label}"`);
  }

  it("single click on a non-sorted column sets sort stack to length 1", () => {
    const { onChange } = renderWithLayout(emptyLayout());

    fireEvent.click(headerButton("District"));

    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0][0] as GridViewLayout;
    expect(next.sort).toHaveLength(1);
    expect(next.sort[0].id).toBe("name");
    expect(next.sort[0].dir).toBe("asc");
  });

  it("single click on a sorted column cycles direction; stack length stays 1", () => {
    const initial: GridViewLayout = {
      ...emptyLayout(),
      sort: [{ id: "name", dir: "asc" }],
    };
    const { onChange } = renderWithLayout(initial);

    fireEvent.click(headerButton("District"));

    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0][0] as GridViewLayout;
    expect(next.sort).toHaveLength(1);
    expect(next.sort[0].dir).toBe("desc");
  });

  it("plain click after multi-sort collapses stack to 1", () => {
    const initial: GridViewLayout = {
      ...emptyLayout(),
      sort: [
        { id: "name", dir: "asc" },
        { id: "state", dir: "desc" },
      ],
    };
    const { onChange } = renderWithLayout(initial);

    fireEvent.click(headerButton("District"));

    const next = onChange.mock.calls[0][0] as GridViewLayout;
    // "name" was already asc, next cycle is "desc"; stack collapses to 1
    expect(next.sort).toHaveLength(1);
  });

  it("shift-click on a second column appends to the sort stack", () => {
    const initial: GridViewLayout = {
      ...emptyLayout(),
      sort: [{ id: "name", dir: "asc" }],
    };
    const { onChange } = renderWithLayout(initial);

    fireEvent.click(headerButton("State"), { shiftKey: true });

    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0][0] as GridViewLayout;
    expect(next.sort).toHaveLength(2);
    expect(next.sort[0]).toEqual({ id: "name", dir: "asc" });
    expect(next.sort[1]).toEqual({ id: "state", dir: "asc" });
  });

  it("shift-click on an already-sorted column cycles its direction within the stack", () => {
    const initial: GridViewLayout = {
      ...emptyLayout(),
      sort: [
        { id: "name", dir: "asc" },
        { id: "state", dir: "asc" },
      ],
    };
    const { onChange } = renderWithLayout(initial);

    fireEvent.click(headerButton("State"), { shiftKey: true });

    const next = onChange.mock.calls[0][0] as GridViewLayout;
    expect(next.sort).toHaveLength(2);
    expect(next.sort[0]).toEqual({ id: "name", dir: "asc" });
    expect(next.sort[1]).toEqual({ id: "state", dir: "desc" });
  });
});

// ---------------------------------------------------------------------------
// Filtered-empty and truncated states
// ---------------------------------------------------------------------------
describe("GridView — filtered-empty and truncated", () => {
  /** Layout with one active filter. */
  function layoutWithFilter(): GridViewLayout {
    return {
      columns: [],
      sort: [],
      filters: {
        kind: "and",
        children: [{ kind: "rule", fieldId: "state", op: "eq", value: "CA" }],
      },
    };
  }

  it("default empty state renders when no filters AND no rows", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: [], total: 0 },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["0100005"]}
          listId={null}
          layout={emptyLayout()}
        />
      </Wrapper>,
    );

    expect(screen.getByText("No matching rows")).toBeTruthy();
    expect(screen.queryByText("No rows match your filters")).toBeNull();
    expect(screen.queryByRole("button", { name: /clear filters/i })).toBeNull();
  });

  it("filtered-empty state renders Clear filters button when filters are active and rows are empty", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: [], total: 0 },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["0100005"]}
          listId={null}
          layout={layoutWithFilter()}
        />
      </Wrapper>,
    );

    expect(screen.getByText("No rows match your filters")).toBeTruthy();
    expect(screen.getByText("Try widening or removing filters.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /clear filters/i })).toBeTruthy();
    // The default empty state title should NOT appear
    expect(screen.queryByText("No matching rows")).toBeNull();
  });

  it("clicking Clear filters empties layout.filters.children", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: [], total: 0 },
    });

    const onChange = vi.fn();
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["0100005"]}
          listId={null}
          layout={layoutWithFilter()}
          onLayoutChange={onChange}
        />
      </Wrapper>,
    );

    const clearBtn = screen.getByRole("button", { name: /clear filters/i });
    fireEvent.click(clearBtn);

    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0][0] as GridViewLayout;
    expect(next.filters.children).toHaveLength(0);
    expect(next.filters.kind).toBe("and");
  });

  it("truncated banner renders when q.data.truncated is true (with rows)", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        rows: [{ name: "Acme USD", stateAbbrev: "CA", tier: "Tier 1", metricValue: 0, stage: "Prospect" }],
        total: 1,
        truncated: true,
      },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["0100005"]}
          listId={null}
          layout={emptyLayout()}
        />
      </Wrapper>,
    );

    expect(screen.getByText("Result too large — narrow your filters.")).toBeTruthy();
  });

  it("truncated banner renders when q.data.truncated is true (with zero rows + filters)", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: [], total: 0, truncated: true },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["0100005"]}
          listId={null}
          layout={layoutWithFilter()}
        />
      </Wrapper>,
    );

    // Both the banner AND the filtered-empty state should be visible
    expect(screen.getByText("Result too large — narrow your filters.")).toBeTruthy();
    expect(screen.getByText("No rows match your filters")).toBeTruthy();
    expect(screen.getByRole("button", { name: /clear filters/i })).toBeTruthy();
  });

  it("truncated banner does NOT render when truncated is false", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        rows: [{ name: "Acme USD", stateAbbrev: "CA", tier: "Tier 1", metricValue: 0, stage: "Prospect" }],
        total: 1,
        truncated: false,
      },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["0100005"]}
          listId={null}
          layout={emptyLayout()}
        />
      </Wrapper>,
    );

    expect(screen.queryByText("Result too large — narrow your filters.")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Group rendering
// ---------------------------------------------------------------------------
describe("GridView — group rendering", () => {
  function groupedRows() {
    return [
      { leaid: "1", name: "Acme USD",  stateAbbrev: "NY", stage: "Prospect" },
      { leaid: "2", name: "Beta USD",  stateAbbrev: "NY", stage: "Prospect" },
      { leaid: "3", name: "Gamma USD", stateAbbrev: "CA", stage: "Prospect" },
      { leaid: "4", name: "Delta USD", stateAbbrev: null, stage: "Prospect" },
    ];
  }

  it("renders group headers when layout.groupBy is set", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: groupedRows(), total: 4 },
    });

    const layout: GridViewLayout = {
      ...emptyLayout(),
      groupBy: { id: "state" },
    };

    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["1", "2", "3", "4"]}
          listId={null}
          layout={layout}
        />
      </Wrapper>,
    );

    // 3 headers: NY (2 rows), CA (1 row), — No value — (1 row)
    const groupHeaders = Array.from(
      container.querySelectorAll("tr[data-group-key]"),
    );
    expect(groupHeaders.length).toBe(3);

    const headerLabels = groupHeaders.map(
      (h) => h.querySelector("span.uppercase")?.textContent,
    );
    expect(headerLabels).toContain("NY");
    expect(headerLabels).toContain("CA");
    expect(headerLabels).toContain("— No value —");

    const headerCounts = groupHeaders.map(
      (h) => h.querySelectorAll("span")[1]?.textContent,
    );
    expect(headerCounts).toContain("· 2 rows");
    expect(headerCounts.filter((c) => c === "· 1 rows").length).toBe(2);
  });

  it("null group renders last under '— No value —'", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: groupedRows(), total: 4 },
    });

    const layout: GridViewLayout = {
      ...emptyLayout(),
      groupBy: { id: "state" },
    };

    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["1", "2", "3", "4"]}
          listId={null}
          layout={layout}
        />
      </Wrapper>,
    );

    const headers = Array.from(
      container.querySelectorAll("tr[data-group-key]"),
    );
    const keys = headers.map((h) => h.getAttribute("data-group-key"));
    expect(keys[keys.length - 1]).toBe("__nogroup__");
  });

  it("clicking a group header collapses its rows", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: groupedRows(), total: 4 },
    });

    const layout: GridViewLayout = {
      ...emptyLayout(),
      groupBy: { id: "state" },
    };

    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["1", "2", "3", "4"]}
          listId={null}
          layout={layout}
        />
      </Wrapper>,
    );

    // Expanded: 4 data rows + 3 headers
    const beforeDataRows = container.querySelectorAll("tr[data-row-kind]");
    expect(beforeDataRows.length).toBe(4);

    // Click NY header
    const nyHeader = container.querySelector('tr[data-group-key="NY"]')!;
    fireEvent.click(nyHeader);

    // NY rows hidden — 2 fewer data rows
    const afterDataRows = container.querySelectorAll("tr[data-row-kind]");
    expect(afterDataRows.length).toBe(2);
    // Header still present
    expect(container.querySelector('tr[data-group-key="NY"]')).not.toBeNull();
  });

  it("no headers render when layout.groupBy is null", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: groupedRows(), total: 4 },
    });

    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={["1", "2", "3", "4"]}
          listId={null}
          layout={emptyLayout()}
        />
      </Wrapper>,
    );

    expect(container.querySelectorAll("tr[data-group-key]").length).toBe(0);
    expect(container.querySelectorAll("tr[data-row-kind]").length).toBe(4);
  });
});
