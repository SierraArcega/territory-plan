import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// The shell test covers the FY selector + secondary tabs; stub the data-driven
// strip so it doesn't pull the topline query (covered in ToplineStatStrip.test).
vi.mock("@/features/home/components/dashboard/ToplineStatStrip", () => ({
  default: () => <div data-testid="topline-strip" />,
}));
vi.mock("@/features/home/components/dashboard/RankTrajectoryCard", () => ({
  default: () => <div data-testid="rank-trajectory-card" />,
}));
vi.mock("@/features/home/components/dashboard/pipeline/PipelineSection", () => ({
  default: () => <div data-testid="pipeline-section" />,
}));
vi.mock("@/features/home/components/dashboard/pipeline/VelocityCard", () => ({
  default: () => <div data-testid="velocity-card" />,
}));

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
