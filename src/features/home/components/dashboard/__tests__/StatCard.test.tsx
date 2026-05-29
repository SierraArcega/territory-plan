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
    expect(screen.getByText(/of 34 reps/i)).toBeTruthy();
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
});
