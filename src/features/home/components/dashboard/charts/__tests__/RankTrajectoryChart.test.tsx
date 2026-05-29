import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import RankTrajectoryChart from "../RankTrajectoryChart";

const COLUMNS = ["Pre-FY", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const series = [
  { name: "Bookings", color: "#F37167", ranks: [8, 7, 6, 6, 5, 5, 4, 3, 3, 2, 2, 1, 1] },
  { name: "Open pipeline", color: "#403770", ranks: [7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 3, 3] },
];

describe("RankTrajectoryChart", () => {
  it("renders an SVG with a line per series and the month-column labels", () => {
    const { container } = render(
      <RankTrajectoryChart series={series} months={COLUMNS} carryover todayIndex={8} totalRanks={12} />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
    // at least one polyline per series (delivered segment)
    expect(container.querySelectorAll("polyline").length).toBeGreaterThanOrEqual(series.length);
    // x-axis month labels present
    expect(container.textContent).toContain("Jul");
    expect(container.textContent).toContain("Jun");
  });

  it("shows the TODAY marker and PROJECTED band when today is mid-year", () => {
    const { container } = render(
      <RankTrajectoryChart series={series} months={COLUMNS} carryover todayIndex={8} totalRanks={12} />,
    );
    expect(container.textContent).toContain("TODAY");
    expect(container.textContent).toContain("PROJECTED");
  });

  it("omits the PROJECTED band when today is the final column (fully delivered FY)", () => {
    const { container } = render(
      <RankTrajectoryChart series={series} months={COLUMNS} carryover todayIndex={12} totalRanks={12} />,
    );
    expect(container.textContent).not.toContain("PROJECTED");
  });

  it("renders end-of-line metric labels unless suppressed", () => {
    const { container, rerender } = render(
      <RankTrajectoryChart series={series} months={COLUMNS} carryover todayIndex={8} totalRanks={12} />,
    );
    expect(container.textContent).toContain("Bookings");

    rerender(
      <RankTrajectoryChart series={series} months={COLUMNS} carryover todayIndex={8} totalRanks={12} hideEndLabels />,
    );
    expect(container.textContent).not.toContain("Bookings");
  });
});
