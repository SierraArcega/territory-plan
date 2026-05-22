import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import GridView from "../GridView";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";

const mockUseViewsData = vi.fn();
vi.mock("@/features/views/hooks/useViewsData", () => ({
  useViewsData: (...args: unknown[]) => mockUseViewsData(...args),
}));

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

/** First arg of the most recent useViewsData call. */
function lastArgs(): { limit: number; offset: number } {
  const call = mockUseViewsData.mock.calls.at(-1);
  return call?.[0] as { limit: number; offset: number };
}

beforeEach(() => {
  mockUseViewsData.mockReset();
});

describe("GridView — pagination", () => {
  it("requests a fixed 50-row window at offset 0 on first render", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: rows(50), total: 738 },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView source="districts" leaids={["1"]} listId={null} layout={emptyLayout()} />
      </Wrapper>,
    );

    expect(lastArgs()).toMatchObject({ limit: 50, offset: 0 });
  });

  it("renders the pager when the total exceeds one page", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: rows(50), total: 738 },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView source="districts" leaids={["1"]} listId={null} layout={emptyLayout()} />
      </Wrapper>,
    );

    expect(screen.getByText("Showing 1–50 of 738")).toBeInTheDocument();
  });

  it("does not render the pager when everything fits on one page", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: rows(10), total: 10 },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView source="districts" leaids={["1"]} listId={null} layout={emptyLayout()} />
      </Wrapper>,
    );

    expect(screen.queryByText(/^Showing /)).toBeNull();
    expect(screen.queryByRole("button", { name: /next page/i })).toBeNull();
  });

  it("fetches the next window at offset 50 when Next is clicked", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: rows(50), total: 738 },
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <GridView source="districts" leaids={["1"]} listId={null} layout={emptyLayout()} />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: /next page/i }));

    expect(lastArgs()).toMatchObject({ limit: 50, offset: 50 });
    expect(screen.getByText("Showing 51–100 of 738")).toBeInTheDocument();
  });

  it("resets to the first page when the filters change", () => {
    mockUseViewsData.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: rows(50), total: 738 },
    });

    const Wrapper = makeWrapper();
    const { rerender } = render(
      <Wrapper>
        <GridView source="districts" leaids={["1"]} listId={null} layout={emptyLayout()} />
      </Wrapper>,
    );

    // Advance to page 2 (offset 50).
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(lastArgs()).toMatchObject({ offset: 50 });

    // Changing the filter tree should snap back to page 1 (offset 0).
    const filtered: GridViewLayout = {
      ...emptyLayout(),
      filters: {
        kind: "and",
        children: [{ kind: "rule", fieldId: "state", op: "eq", value: "CA" }],
      },
    };
    rerender(
      <Wrapper>
        <GridView source="districts" leaids={["1"]} listId={null} layout={filtered} />
      </Wrapper>,
    );

    expect(lastArgs()).toMatchObject({ offset: 0 });
    expect(screen.getByText("Showing 1–50 of 738")).toBeInTheDocument();
  });
});
