import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardTab from "../DashboardTab";
import { getCurrentFY } from "@/lib/fiscal-year";

describe("DashboardTab", () => {
  it("renders the Performance header and FY pills with the current FY active", () => {
    render(<DashboardTab />);

    expect(screen.getByRole("heading", { name: "Performance" })).toBeInTheDocument();

    const currentLabel = `FY${String(getCurrentFY()).slice(-2)}`;
    expect(screen.getByRole("button", { name: currentLabel })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("activates a different fiscal year on click", () => {
    render(<DashboardTab />);

    const priorLabel = `FY${String(getCurrentFY() - 1).slice(-2)}`;
    const pill = screen.getByRole("button", { name: priorLabel });
    fireEvent.click(pill);

    expect(pill).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the Pipeline secondary tab", () => {
    render(<DashboardTab />);
    expect(screen.getByRole("tab", { name: /pipeline/i })).toBeInTheDocument();
  });
});
