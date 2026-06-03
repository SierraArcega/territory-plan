import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatCard from "../StatCard";

const spark = (yoy: number | null) => ({
  current: [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  prior: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6],
  yoy,
});

describe("StatCard", () => {
  it("renders the label, value, and rank", () => {
    render(<StatCard label="Bookings" value={612000} rank={2} totalReps={34} inRoster segments={[]} />);
    expect(screen.getByText("Bookings")).toBeTruthy();
    expect(screen.getByText("#2/34")).toBeInTheDocument();
  });

  it("renders the sparkline and a positive YoY chip", () => {
    const { container } = render(
      <StatCard label="Bookings" value={612000} rank={2} totalReps={34} inRoster segments={[]} sparkline={spark(0.09)} priorFyLabel="FY25" />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.getByText("+9%")).toBeTruthy();
    expect(screen.getByText(/vs FY25/i)).toBeTruthy();
  });

  it("renders a negative YoY chip", () => {
    render(<StatCard label="Take" value={98000} rank={5} totalReps={34} inRoster segments={[]} sparkline={spark(-0.05)} priorFyLabel="FY25" />);
    expect(screen.getByText("-5%")).toBeTruthy();
  });

  it("omits the YoY chip when there is no prior-year baseline", () => {
    render(<StatCard label="Take" value={98000} rank={5} totalReps={34} inRoster segments={[]} sparkline={spark(null)} priorFyLabel="FY25" />);
    expect(screen.queryByText(/vs FY25/i)).toBeNull();
  });

  it("renders the last-7d WoW chip when a delta is provided", () => {
    render(<StatCard label="Open Pipeline" value={480000} rank={3} totalReps={34} inRoster segments={[]} wow={0.18} />);
    expect(screen.getByText(/\+18% · last 7d/)).toBeInTheDocument();
  });

  it("omits the WoW chip when there is no 7d delta (unsupported metric)", () => {
    render(<StatCard label="Take" value={98000} rank={5} totalReps={34} inRoster segments={[]} wow={null} />);
    expect(screen.queryByText(/7d/i)).toBeNull();
  });

  it("renders open-pipeline detail: opp/account counts plus min commit and max budget", () => {
    render(
      <StatCard
        label="Open Pipeline"
        value={1200000}
        rank={3}
        totalReps={34}
        inRoster
        segments={[]}
        pipelineDetail={{ minCommit: 840000, maxBudget: 1600000, oppCount: 12, accountCount: 9 }}
      />,
    );
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText(/open opps/i)).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
    expect(screen.getByText(/accounts/i)).toBeTruthy();
    expect(screen.getByText(/Min commit/i)).toBeTruthy();
    expect(screen.getByText(/Max budget/i)).toBeTruthy();
  });

  it("singularizes a single opp / single account", () => {
    render(
      <StatCard
        label="Open Pipeline"
        value={50000}
        rank={3}
        totalReps={34}
        inRoster
        segments={[]}
        pipelineDetail={{ minCommit: 40000, maxBudget: 60000, oppCount: 1, accountCount: 1 }}
      />,
    );
    expect(screen.getByText(/open opp\b/i)).toBeTruthy();
    expect(screen.getByText(/\baccount\b/i)).toBeTruthy();
  });

  it("hides the detail block when the rep has no open opps", () => {
    render(
      <StatCard
        label="Open Pipeline"
        value={0}
        rank={20}
        totalReps={34}
        inRoster
        segments={[]}
        pipelineDetail={{ minCommit: 0, maxBudget: 0, oppCount: 0, accountCount: 0 }}
      />,
    );
    expect(screen.queryByText(/Min commit/i)).toBeNull();
  });

  it("renders the rank pill via the shell", () => {
    render(<StatCard label="Open Pipeline" value={1200000} rank={3} totalReps={12} inRoster segments={[]} />);
    expect(screen.getByText("#3/12")).toBeInTheDocument();
    expect(screen.getByText("top 25%")).toBeInTheDocument();
  });

  it("renders a vertical segment legend with percents", () => {
    render(
      <StatCard
        label="Open Pipeline" value={480000} rank={3} totalReps={12} inRoster
        segments={[
          { key: "return", label: "Return", value: 280000 },
          { key: "new", label: "New biz", value: 140000 },
          { key: "winback", label: "Win-back", value: 60000 },
        ]}
      />,
    );
    expect(screen.getByText("Return")).toBeInTheDocument();
    expect(screen.getByText("58%")).toBeInTheDocument();
  });

  it("shows open-pipeline min commit / max budget on the min/max line", () => {
    render(
      <StatCard
        label="Open Pipeline" value={1200000} rank={3} totalReps={12} inRoster segments={[]}
        pipelineDetail={{ minCommit: 840000, maxBudget: 1600000, oppCount: 12, accountCount: 9 }}
      />,
    );
    expect(screen.getByText(/min commit/i)).toBeInTheDocument();
    expect(screen.getByText(/max budget/i)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument(); // opp count retained
  });
});
