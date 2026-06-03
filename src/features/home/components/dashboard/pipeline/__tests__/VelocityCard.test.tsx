import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseVelocity = vi.fn();
vi.mock("@/features/home/lib/queries", () => ({ useVelocity: (fy: number) => mockUseVelocity(fy) }));

import VelocityCard from "../VelocityCard";

const cell = (over: Record<string, unknown>) => ({
  metricKey: "closeRate", label: "Close rate", format: "percent",
  value: 0.24, delta: 5, deltaUnit: "pts", teamMedian: 0.19, rank: 4, totalReps: 12, inRoster: true, ...over,
});

describe("VelocityCard", () => {
  beforeEach(() => vi.resetAllMocks());

  it("renders the header and one cell per metric", () => {
    mockUseVelocity.mockReturnValue({
      data: { fy: 2026, schoolYr: "2025-26", cells: [
        cell({ metricKey: "closeRate", label: "Close rate" }),
        cell({ metricKey: "avgDealSize", label: "Avg deal size", format: "currency", value: 48000, deltaUnit: "pct" }),
        cell({ metricKey: "grossMargin", label: "Gross margin", value: 0.345 }),
        cell({ metricKey: "dealsWon", label: "Deals won", format: "count", value: 90, deltaUnit: "count" }),
      ] },
      isLoading: false, isError: false,
    });
    render(<VelocityCard fy={2026} />);
    expect(screen.getByText("Velocity")).toBeInTheDocument();
    expect(screen.getByText("Close rate")).toBeInTheDocument();
    expect(screen.getByText("Avg deal size")).toBeInTheDocument();
    expect(screen.getByText("Gross margin")).toBeInTheDocument();
    expect(screen.getByText("Deals won")).toBeInTheDocument();
  });

  it("shows a loading skeleton", () => {
    mockUseVelocity.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<VelocityCard fy={2026} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("shows an error state with retry", () => {
    const refetch = vi.fn();
    mockUseVelocity.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    render(<VelocityCard fy={2026} />);
    expect(screen.getByText(/Couldn't load/i)).toBeInTheDocument();
  });
});
