import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
      expect(
        screen.getByText(header),
        `Expected header "${header}" to be present`,
      ).toBeTruthy();
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
    // Put "Stage" (defaultOrder 8) before "District" (defaultOrder 0) via layout overrides.
    const layout: GridViewLayout = {
      columns: [
        { id: "name",  order: 99, visible: true },
        { id: "state", order: 100, visible: false },
        { id: "tier",  order: 101, visible: false },
        { id: "fy26_arr", order: 102, visible: false },
        { id: "stage", order: 0,  visible: true },
      ],
      sort: [],
      filters: { kind: "and", children: [] },
    };

    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        rows: [{ name: "Acme USD", stage: "Prospect" }],
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

    // Stage (order: 0) should appear before District (order: 99) in the rendered header row.
    const stageIdx = headerTexts.indexOf("Stage");
    const districtIdx = headerTexts.indexOf("District");
    expect(stageIdx).toBeGreaterThanOrEqual(0);
    expect(districtIdx).toBeGreaterThanOrEqual(0);
    expect(stageIdx).toBeLessThan(districtIdx);
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
