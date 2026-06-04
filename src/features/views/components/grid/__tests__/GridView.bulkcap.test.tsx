import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import GridView from "../GridView";
import { BULK_SELECT_CAP } from "../grid-pagination";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseViewsData = vi.fn();
vi.mock("@/features/views/hooks/useViewsData", () => ({
  useViewsData: (...args: unknown[]) => mockUseViewsData(...args),
}));

// Stub heavy sub-components to avoid cascading dependency mocks.
vi.mock("../actions/BulkActionsMenu", () => ({
  BulkActionsMenu: () => <div data-testid="bulk-actions-stub" />,
}));
vi.mock("../actions/AddDistrictsModal", () => ({
  AddDistrictsModal: () => null,
}));
vi.mock("../actions/RowActionsMenu", () => ({
  RowActionsMenu: () => null,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function emptyLayout(): GridViewLayout {
  return { columns: [], sort: [], filters: { kind: "and", children: [] } };
}

function rows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    leaid: String(i + 1),
    name: `District ${i + 1}`,
    stateAbbrev: "CA",
    stage: "Prospect",
  }));
}

/** Render GridView with showRowActions = true (plan context). */
function renderGrid(pageRows: ReturnType<typeof rows>, total: number) {
  const Wrapper = makeWrapper();
  render(
    <Wrapper>
      <GridView
        source="districts"
        leaids={null}
        listId={null}
        parentKind="plan"
        parentId="plan-1"
        viewType="table"
        layout={emptyLayout()}
        onLayoutChange={() => {}}
      />
    </Wrapper>,
  );

  // Feed the mocked hook with the desired data.
  mockUseViewsData.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { rows: pageRows, total },
  });
}

beforeEach(() => {
  mockUseViewsData.mockReset();
});

/** Generate n mock district rows with unique leaids. */
function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    leaid: `leaid-${i + 1}`,
    name: `District ${i + 1}`,
    stateAbbrev: "CA",
    stage: "Prospect",
  }));
}

function renderGridWithData(pageRows: ReturnType<typeof makeRows>, total: number) {
  mockUseViewsData.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { rows: pageRows, total },
  });
  const Wrapper = makeWrapper();
  render(
    <Wrapper>
      <GridView
        source="districts"
        leaids={null}
        listId={null}
        parentKind="plan"
        parentId="plan-1"
        viewType="table"
        layout={emptyLayout()}
        onLayoutChange={() => {}}
      />
    </Wrapper>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("BULK_SELECT_CAP constant", () => {
  it("equals 100", () => {
    expect(BULK_SELECT_CAP).toBe(100);
  });
});

describe("GridView — bulk selection cap", () => {
  it('"Select all N" button is visible when total ≤ cap (75 rows, 5 on page)', () => {
    // Return 5 page rows, total 75 — within the 100-row cap.
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: rows(5), total: 75 },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={null}
          listId={null}
          parentKind="plan"
          parentId="plan-1"
          viewType="table"
          layout={emptyLayout()}
          onLayoutChange={() => {}}
        />
      </Wrapper>,
    );

    // Select all rows on the page via the header checkbox.
    fireEvent.click(screen.getByRole("checkbox", { name: /select all on page/i }));

    // The "Select all 75" promote button should be visible.
    expect(screen.getByRole("button", { name: /select all 75/i })).toBeInTheDocument();
  });

  it('"Select all N" button is hidden when total > cap (200 rows, 5 on page)', () => {
    // Return 5 page rows, total 200 — exceeds the 100-row cap.
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: rows(5), total: 200 },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={null}
          listId={null}
          parentKind="plan"
          parentId="plan-1"
          viewType="table"
          layout={emptyLayout()}
          onLayoutChange={() => {}}
        />
      </Wrapper>,
    );

    // Select all rows on the page via the header checkbox.
    fireEvent.click(screen.getByRole("checkbox", { name: /select all on page/i }));

    // The promote button must NOT appear when total > cap.
    expect(screen.queryByRole("button", { name: /select all 200/i })).not.toBeInTheDocument();
  });

  it("shows normal count text when below cap", () => {
    // 5 page rows, total also 5 — nothing to promote.
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: rows(5), total: 5 },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView
          source="districts"
          leaids={null}
          listId={null}
          parentKind="plan"
          parentId="plan-1"
          viewType="table"
          layout={emptyLayout()}
          onLayoutChange={() => {}}
        />
      </Wrapper>,
    );

    // Select all 5 rows on the page.
    fireEvent.click(screen.getByRole("checkbox", { name: /select all on page/i }));

    // Count display should show normal text, not the cap message.
    expect(screen.getByText("5 of 5 on this page selected")).toBeInTheDocument();
  });
});

describe("cap enforcement behaviors", () => {
  it("shows '${BULK_SELECT_CAP} (max) selected' text when 100 rows are selected", () => {
    // Render exactly BULK_SELECT_CAP (100) rows. Clicking the header selects
    // all 100, which is exactly at the cap — the max-selected label must appear.
    renderGridWithData(makeRows(BULK_SELECT_CAP), BULK_SELECT_CAP);

    fireEvent.click(screen.getByRole("checkbox", { name: /select all on page/i }));

    expect(
      screen.getByText(`${BULK_SELECT_CAP} (max) selected`),
    ).toBeInTheDocument();
  });

  it("disables the checkbox for an unselected row when at cap", () => {
    // 101 rows on the page. Clicking the header selects the first 100 (slice to
    // remainingCap = 100). The 101st row is unselected and must be disabled.
    renderGridWithData(makeRows(BULK_SELECT_CAP + 1), BULK_SELECT_CAP + 1);

    fireEvent.click(screen.getByRole("checkbox", { name: /select all on page/i }));

    // Row checkboxes (excluding the header) — 101 total.
    const rowCheckboxes = screen
      .getAllByRole("checkbox")
      .filter((cb) => cb.getAttribute("aria-label") !== "Select all on page");

    // The 101st row's checkbox (index 100) should be disabled (locked out).
    expect(rowCheckboxes[BULK_SELECT_CAP]).toBeDisabled();
  });

  it("clicking a locked-out checkbox does not change the selection count", () => {
    // Same 101-row setup: after clicking the header we are at cap.
    renderGridWithData(makeRows(BULK_SELECT_CAP + 1), BULK_SELECT_CAP + 1);

    fireEvent.click(screen.getByRole("checkbox", { name: /select all on page/i }));

    // Attempt to click the disabled 101st checkbox.
    const rowCheckboxes = screen
      .getAllByRole("checkbox")
      .filter((cb) => cb.getAttribute("aria-label") !== "Select all on page");
    fireEvent.click(rowCheckboxes[BULK_SELECT_CAP]);

    // Count must still show the max-selected label (no 101st item added).
    expect(
      screen.getByText(`${BULK_SELECT_CAP} (max) selected`),
    ).toBeInTheDocument();
  });

  it("allows unchecking an already-selected row when at cap", () => {
    // 101 rows, header click → 100 selected (at cap). Unchecking one of the
    // selected rows should drop the count to 99 and show normal count text.
    renderGridWithData(makeRows(BULK_SELECT_CAP + 1), BULK_SELECT_CAP + 1);

    fireEvent.click(screen.getByRole("checkbox", { name: /select all on page/i }));

    // One of the first 100 row checkboxes is selected — click it to uncheck.
    const rowCheckboxes = screen
      .getAllByRole("checkbox")
      .filter((cb) => cb.getAttribute("aria-label") !== "Select all on page");
    // rowCheckboxes[0] corresponds to leaid-1, which IS in the selection.
    fireEvent.click(rowCheckboxes[0].closest("td")!);

    // After unchecking, count drops to 99 of 101 rows on this page selected.
    expect(
      screen.getByText(`${BULK_SELECT_CAP - 1} of ${BULK_SELECT_CAP + 1} on this page selected`),
    ).toBeInTheDocument();
  });
});
