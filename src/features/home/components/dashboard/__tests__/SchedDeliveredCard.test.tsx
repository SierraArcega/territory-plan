import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SchedDeliveredCard from "../SchedDeliveredCard";

const base = {
  label: "Sched + Delivered",
  revenue: 748000,
  take: 224000,
  rank: 2,
  totalReps: 12,
  inRoster: true,
  revenueSegments: [{ key: "return" as const, label: "Return", value: 601000 }],
  takeSegments: [{ key: "return" as const, label: "Return", value: 180000 }],
  detail: { minCommit: 650000, maxBudget: 1100000, oppCount: 8, accountCount: 6 },
  priorFyLabel: "FY26",
  currentFyLabel: "FY27",
};

describe("SchedDeliveredCard", () => {
  it("shows the revenue headline, the take + take-rate line, and the ceiling", () => {
    render(<SchedDeliveredCard {...base} />);
    expect(screen.getByText("$748K")).toBeInTheDocument();
    expect(screen.getByText("$224K")).toBeInTheDocument();
    expect(screen.getByText(/30% take rate/)).toBeInTheDocument();
    expect(screen.getByText(/Budget \$1\.1M/)).toBeInTheDocument();
  });

  it("renders an empty-range note when there are no won contracts", () => {
    render(<SchedDeliveredCard {...base} detail={{ minCommit: 0, maxBudget: 0, oppCount: 0, accountCount: 0 }} />);
    expect(screen.getByText(/no won contracts/i)).toBeInTheDocument();
  });

  it("renders the empty-range note when detail is null", () => {
    render(<SchedDeliveredCard {...base} detail={null} />);
    expect(screen.getByText(/no won contracts/i)).toBeInTheDocument();
  });
});
