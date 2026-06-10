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
  it("shows delivered headline, % of min and % of max, take, and margin", () => {
    render(<SchedDeliveredCard {...base} />);
    expect(screen.getByText("$748K")).toBeInTheDocument();        // delivered rev (headline)
    expect(screen.getByText("115%")).toBeInTheDocument();         // of min commit = 748 / 650
    expect(screen.getByText("68%")).toBeInTheDocument();          // of max budget = 748 / 1100
    expect(screen.getByText("$224K")).toBeInTheDocument();        // take
    expect(screen.getByText("30%")).toBeInTheDocument();          // margin = take / revenue
    expect(screen.getByText(/Max \$1\.1M/)).toBeInTheDocument();  // budget ceiling
  });

  it("flags UNDER MIN and defers the gap to the floor when delivered is below the min", () => {
    render(<SchedDeliveredCard {...base} revenue={88000} take={26000} />);
    expect(screen.getByText("UNDER MIN")).toBeInTheDocument();
    expect(screen.getByText("$562K")).toBeInTheDocument(); // deferred = 650 − 88 (still owed to floor)
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
