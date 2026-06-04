import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VelocityCell from "../VelocityCell";
import type { VelocityCell as Cell } from "@/features/home/lib/velocity";

const base: Cell = {
  metricKey: "closeRate", label: "Close rate", format: "percent",
  value: 0.24, delta: 5, deltaUnit: "pts", teamMedian: 0.19, rank: 4, totalReps: 12, inRoster: true,
};

describe("VelocityCell", () => {
  it("renders label, percent value, pts delta, and median/rank foot", () => {
    render(<VelocityCell cell={base} />);
    expect(screen.getByText("Close rate")).toBeInTheDocument();
    expect(screen.getByText("24%")).toBeInTheDocument();
    expect(screen.getByText("+5 pts")).toBeInTheDocument();
    expect(screen.getByText(/team median 19%/)).toBeInTheDocument();
    expect(screen.getByText(/#4\/12/)).toBeInTheDocument();
  });

  it("formats currency + percent-change delta", () => {
    render(<VelocityCell cell={{ ...base, metricKey: "avgDealSize", label: "Avg deal size", format: "currency", value: 48000, delta: 14, deltaUnit: "pct", teamMedian: 42000 }} />);
    expect(screen.getByText("$48K")).toBeInTheDocument();
    expect(screen.getByText("+14%")).toBeInTheDocument();
    expect(screen.getByText(/team median \$42K/)).toBeInTheDocument();
  });

  it("shows a dash and Not ranked when out of roster", () => {
    render(<VelocityCell cell={{ ...base, value: 0, delta: null, rank: 13, inRoster: false }} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Not ranked")).toBeInTheDocument();
  });

  it("omits the delta chip when delta is null but the rep is ranked", () => {
    render(<VelocityCell cell={{ ...base, delta: null }} />);
    expect(screen.queryByText(/pts/)).toBeNull();
    expect(screen.getByText(/team median/)).toBeInTheDocument();
  });
});
