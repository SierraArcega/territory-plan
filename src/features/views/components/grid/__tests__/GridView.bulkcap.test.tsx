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
