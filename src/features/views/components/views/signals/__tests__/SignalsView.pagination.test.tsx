import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock the summary query so we control the full district list the view paginates.
vi.mock("../queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../queries")>();
  return { ...actual, useSignalsSummary: vi.fn() };
});

// Stub the district row so we can count/identify rendered districts without
// pulling in the per-district items query.
vi.mock("../SignalDistrictRow", () => ({
  default: ({ district }: { district: { leaid: string; name: string } }) => (
    <li data-testid="district-row" data-leaid={district.leaid}>
      {district.name}
    </li>
  ),
}));

import SignalsView from "../SignalsView";
import { useSignalsSummary } from "../queries";
import type { SignalsSummaryDistrict } from "../queries";

const useSignalsSummaryMock = useSignalsSummary as unknown as Mock;

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

function ds(n: number): SignalsSummaryDistrict[] {
  return Array.from({ length: n }, (_, i) => ({
    leaid: String(i + 1),
    name: `District ${i + 1}`,
    stateAbbrev: "IL",
    counts: { vac: 1, news: 0, rfp: 0 },
    newestSignalAt: new Date().toISOString(),
  }));
}

const planProps = {
  leaids: ["1"],
  parentKind: "plan" as const,
  parentId: "p1",
  savedLayouts: null,
};

beforeEach(() => {
  useSignalsSummaryMock.mockReset();
});

describe("SignalsView — pagination", () => {
  it("shows only the first 50 districts and a pager when there are more", () => {
    useSignalsSummaryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { districts: ds(60), total: 60 },
    });
    render(wrap(<SignalsView {...planProps} />));
    expect(screen.getAllByTestId("district-row")).toHaveLength(50);
    expect(screen.getByText("Showing 1–50 of 60")).toBeInTheDocument();
  });

  it("does not render a pager when everything fits on one page", () => {
    useSignalsSummaryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { districts: ds(10), total: 10 },
    });
    render(wrap(<SignalsView {...planProps} />));
    expect(screen.queryByRole("button", { name: /next page/i })).toBeNull();
    expect(screen.queryByText(/^Showing /)).toBeNull();
  });

  it("Next shows the second-page window (districts 51–60), not an accumulation", () => {
    useSignalsSummaryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { districts: ds(60), total: 60 },
    });
    render(wrap(<SignalsView {...planProps} />));
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));

    const rows = screen.getAllByTestId("district-row");
    expect(rows).toHaveLength(10);
    expect(rows[0]).toHaveAttribute("data-leaid", "51");
    expect(screen.getByText("Showing 51–60 of 60")).toBeInTheDocument();
  });

  it("resets to the first page when a signal-type filter changes", () => {
    useSignalsSummaryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { districts: ds(60), total: 60 },
    });
    render(wrap(<SignalsView {...planProps} />));
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(screen.getByText("Showing 51–60 of 60")).toBeInTheDocument();

    // Toggling a type chip re-scopes the feed — should snap back to page 1.
    fireEvent.click(screen.getByText("News"));
    const rows = screen.getAllByTestId("district-row");
    expect(rows).toHaveLength(50);
    expect(rows[0]).toHaveAttribute("data-leaid", "1");
    expect(screen.getByText("Showing 1–50 of 60")).toBeInTheDocument();
  });
});
