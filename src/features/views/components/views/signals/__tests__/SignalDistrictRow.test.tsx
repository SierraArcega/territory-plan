import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock the per-district items query so we can assert it mounts on expand and
// drive its loading/data states without a network round trip.
vi.mock("../queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../queries")>();
  return { ...actual, useDistrictSignals: vi.fn() };
});

import SignalDistrictRow from "../SignalDistrictRow";
import { useDistrictSignals } from "../queries";
import type { SignalsSummaryDistrict } from "../queries";

const useDistrictSignalsMock = useDistrictSignals as unknown as Mock;

function district(
  overrides: Partial<SignalsSummaryDistrict> = {},
): SignalsSummaryDistrict {
  return {
    leaid: "1234567",
    name: "Springfield SD",
    stateAbbrev: "IL",
    counts: { vac: 3, news: 2, rfp: 1 },
    newestSignalAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    ...overrides,
  };
}

const baseProps = {
  types: { vac: true, news: true, rfp: true },
  since: "30d" as const,
  onToggle: vi.fn(),
  lastVisitMs: null,
};

beforeEach(() => {
  useDistrictSignalsMock.mockReset();
  baseProps.onToggle = vi.fn();
});

describe("SignalDistrictRow", () => {
  it("shows count chips and freshness for a district with signals", () => {
    useDistrictSignalsMock.mockReturnValue({ isLoading: false, isError: false, data: undefined });
    render(
      <SignalDistrictRow district={district()} {...baseProps} expanded={false} />,
    );
    expect(screen.getByText("Springfield SD")).toBeInTheDocument();
    // Per-type counts visible (3 vac, 2 news, 1 rfp).
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("2d")).toBeInTheDocument();
  });

  it("does not mount the items query while collapsed", () => {
    useDistrictSignalsMock.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    render(
      <SignalDistrictRow district={district()} {...baseProps} expanded={false} />,
    );
    expect(useDistrictSignalsMock).not.toHaveBeenCalled();
  });

  it("mounts the items query and renders feed items when expanded", () => {
    useDistrictSignalsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [
          { type: "vac", id: "v1", title: "HS Math Teacher", date: new Date().toISOString() },
        ],
        hasMore: false,
      },
    });
    render(
      <SignalDistrictRow district={district()} {...baseProps} expanded={true} />,
    );
    expect(useDistrictSignalsMock).toHaveBeenCalled();
    expect(screen.getByText("HS Math Teacher")).toBeInTheDocument();
  });

  it("calls onToggle with the leaid when the header is clicked", () => {
    useDistrictSignalsMock.mockReturnValue({ isLoading: false, isError: false, data: undefined });
    render(
      <SignalDistrictRow district={district()} {...baseProps} expanded={false} />,
    );
    fireEvent.click(screen.getByText("Springfield SD"));
    expect(baseProps.onToggle).toHaveBeenCalledWith("1234567");
  });

  it("renders a 0-signal district as 'No signals' and is not expandable", () => {
    useDistrictSignalsMock.mockReturnValue({ isLoading: false, isError: false, data: undefined });
    render(
      <SignalDistrictRow
        district={district({ counts: { vac: 0, news: 0, rfp: 0 }, newestSignalAt: null })}
        {...baseProps}
        expanded={false}
      />,
    );
    expect(screen.getByText("No signals")).toBeInTheDocument();
    // No interactive header button → click does nothing / no query.
    expect(screen.queryByRole("button")).toBeNull();
    fireEvent.click(screen.getByText("Springfield SD"));
    expect(baseProps.onToggle).not.toHaveBeenCalled();
    expect(useDistrictSignalsMock).not.toHaveBeenCalled();
  });

  it("shows an inline retry on items error when expanded", () => {
    const refetch = vi.fn();
    useDistrictSignalsMock.mockReturnValue({ isLoading: false, isError: true, refetch });
    render(
      <SignalDistrictRow district={district()} {...baseProps} expanded={true} />,
    );
    expect(screen.getByText(/Couldn.t load signals/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalled();
  });
});
