import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SparklineLegend from "../SparklineLegend";

describe("SparklineLegend", () => {
  it("labels the solid current-FY line and the dashed prior-FY line", () => {
    render(<SparklineLegend currentFyLabel="FY26" priorFyLabel="FY25" tip="what this means" />);
    expect(screen.getByText("FY26")).toBeInTheDocument();
    expect(screen.getByText("FY25")).toBeInTheDocument();
  });

  it("exposes the explanation through the (i) affordance", () => {
    render(<SparklineLegend currentFyLabel="FY26" priorFyLabel="FY25" tip="cumulative running total" />);
    expect(screen.getByRole("button", { name: /what this means/i })).toBeInTheDocument();
  });

  it("omits the prior-FY swatch when there's no prior-year data", () => {
    render(<SparklineLegend currentFyLabel="FY26" tip="no prior data" />);
    expect(screen.getByText("FY26")).toBeInTheDocument();
    expect(screen.queryByText("FY25")).not.toBeInTheDocument();
  });
});
