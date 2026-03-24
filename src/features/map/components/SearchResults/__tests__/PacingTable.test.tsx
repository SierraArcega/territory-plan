import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceTypeBreakdown } from "../ServiceTypeBreakdown";

describe("ServiceTypeBreakdown", () => {
  it("renders bar chart with service type data", () => {
    const data = [
      { serviceType: "Tutoring", revenue: 12400 },
      { serviceType: "Mentoring", revenue: 8100 },
    ];
    render(<ServiceTypeBreakdown data={data} fiscalYear={2026} />);

    expect(screen.getByText("Tutoring")).toBeInTheDocument();
    expect(screen.getByText("Mentoring")).toBeInTheDocument();
    expect(screen.getByText("$12.4K")).toBeInTheDocument();
    expect(screen.getByText("$8.1K")).toBeInTheDocument();
    expect(screen.getByText(/Revenue by Service Type/)).toBeInTheDocument();
    expect(screen.getByText(/FY26/)).toBeInTheDocument();
  });

  it("renders empty state when data is empty", () => {
    render(<ServiceTypeBreakdown data={[]} fiscalYear={2026} />);
    expect(screen.getByText("No Session Data available")).toBeInTheDocument();
  });

  it("sorts bars by revenue descending", () => {
    const data = [
      { serviceType: "Mentoring", revenue: 5000 },
      { serviceType: "Tutoring", revenue: 15000 },
      { serviceType: "College Prep", revenue: 3000 },
    ];
    render(<ServiceTypeBreakdown data={data} fiscalYear={2026} />);

    const labels = screen.getAllByTestId("service-type-label");
    expect(labels[0]).toHaveTextContent("Tutoring");
    expect(labels[1]).toHaveTextContent("Mentoring");
    expect(labels[2]).toHaveTextContent("College Prep");
  });
});
