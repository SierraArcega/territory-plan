import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock the summary query so the orchestrator's data flow is fully controlled.
vi.mock("../queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../queries")>();
  return { ...actual, useSignalsSummary: vi.fn() };
});

// Replace the district row with a lightweight stub so we don't pull in the
// per-district items query; we only assert which districts the view renders.
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

function d(name: string, leaid: string): SignalsSummaryDistrict {
  return {
    leaid,
    name,
    stateAbbrev: "IL",
    counts: { vac: 1, news: 0, rfp: 0 },
    newestSignalAt: new Date().toISOString(),
  };
}

const planProps = {
  leaids: ["1", "2"],
  parentKind: "plan" as const,
  parentId: "p1",
  savedLayouts: null,
};

beforeEach(() => {
  useSignalsSummaryMock.mockReset();
});

describe("SignalsView", () => {
  it("renders a district row per summary district", () => {
    useSignalsSummaryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { districts: [d("Springfield SD", "1"), d("Shelbyville SD", "2")], total: 2 },
    });
    render(wrap(<SignalsView {...planProps} />));
    expect(screen.getAllByTestId("district-row")).toHaveLength(2);
    expect(screen.getByText("Springfield SD")).toBeInTheDocument();
  });

  it("filters districts client-side by the search box", () => {
    useSignalsSummaryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { districts: [d("Springfield SD", "1"), d("Shelbyville SD", "2")], total: 2 },
    });
    render(wrap(<SignalsView {...planProps} />));
    fireEvent.change(screen.getByLabelText("Search districts"), {
      target: { value: "spring" },
    });
    const rows = screen.getAllByTestId("district-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Springfield SD");
  });

  it("toggling a type chip re-calls the summary hook with a narrower type mask", () => {
    useSignalsSummaryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { districts: [d("Springfield SD", "1")], total: 1 },
    });
    render(wrap(<SignalsView {...planProps} />));
    // Baseline: all three types on.
    const before = useSignalsSummaryMock.mock.calls.at(-1)?.[0];
    expect(before.types).toEqual({ vac: true, news: true, rfp: true });

    fireEvent.click(screen.getByText("News"));
    const after = useSignalsSummaryMock.mock.calls.at(-1)?.[0];
    expect(after.types).toEqual({ vac: true, news: false, rfp: true });
  });

  it("shows the list-scope coming-soon note for a list with null leaids", () => {
    useSignalsSummaryMock.mockReturnValue({ isLoading: false, isError: false, data: undefined });
    render(
      wrap(
        <SignalsView
          leaids={null}
          parentKind="list"
          parentId="l1"
          savedLayouts={null}
        />,
      ),
    );
    expect(screen.getByText(/Signals for lists are coming soon/)).toBeInTheDocument();
  });

  it("shows the whole-empty state when the summary has no districts", () => {
    useSignalsSummaryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { districts: [], total: 0 },
    });
    render(wrap(<SignalsView {...planProps} />));
    expect(screen.getByText("No signals match these filters")).toBeInTheDocument();
  });

  it("shows an error state with retry when the summary errors", () => {
    const refetch = vi.fn();
    useSignalsSummaryMock.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error("boom"),
      refetch,
    });
    render(wrap(<SignalsView {...planProps} />));
    expect(screen.getByText("Couldn't load")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows skeleton rows while the summary is loading", () => {
    useSignalsSummaryMock.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    const { container } = render(wrap(<SignalsView {...planProps} />));
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });
});
