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

  it("zooms the Y-axis to the rank range shown rather than the full roster cap", () => {
    // Caller ranks #1–#8 in a 34-rep roster: axis should anchor near #9, not span
    // to #34 (which would glue every line to the top). The old behavior drew a #12
    // gridline (12 ≤ 34); the zoomed axis stops below it.
    const topPerformer = [
      { name: "Bookings", color: "#F37167", ranks: [8, 7, 6, 5, 4, 3, 2, 1, 1, 1, 1, 1, 1] },
    ];
    const { container } = render(
      <RankTrajectoryChart series={topPerformer} months={COLUMNS} carryover todayIndex={8} totalRanks={34} />,
    );
    expect(container.textContent).toContain("#9"); // zoomed bottom gridline
    expect(container.textContent).not.toContain("#12"); // not stretched to the roster
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
