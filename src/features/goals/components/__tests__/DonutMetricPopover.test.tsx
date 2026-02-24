import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DonutMetricPopover from "../DonutMetricPopover";

describe("DonutMetricPopover", () => {
  const defaultProps = {
    label: "Earnings",
    current: 45000,
    target: 100000 as number | null,
    format: "currency" as const,
    color: "#F37167",
    onClose: vi.fn(),
  };

  it("renders the metric label with correct color", () => {
    render(<DonutMetricPopover {...defaultProps} />);
    const label = screen.getByText("Earnings");
    expect(label).toBeInTheDocument();
    expect(label).toHaveStyle({ color: "#F37167" });
  });

  it("formats currency values with compact notation", () => {
    render(<DonutMetricPopover {...defaultProps} />);
    expect(screen.getByText("$45K")).toBeInTheDocument();
    expect(screen.getByText("of $100K")).toBeInTheDocument();
  });

  it("formats number values without currency symbol", () => {
    render(
      <DonutMetricPopover
        {...defaultProps}
        label="New Districts"
        current={2}
        target={5}
        format="number"
      />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("of 5")).toBeInTheDocument();
  });

  it("shows dash when target is null", () => {
    render(
      <DonutMetricPopover {...defaultProps} target={null} />,
    );
    expect(screen.getByText("of -")).toBeInTheDocument();
  });

  it("calls onClose when clicking outside", () => {
    const onClose = vi.fn();
    render(<DonutMetricPopover {...defaultProps} onClose={onClose} />);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<DonutMetricPopover {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the popover", () => {
    const onClose = vi.fn();
    render(<DonutMetricPopover {...defaultProps} onClose={onClose} />);
    const popover = screen.getByTestId("donut-popover");
    fireEvent.mouseDown(popover);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("has the data-testid attribute for integration test targeting", () => {
    render(<DonutMetricPopover {...defaultProps} />);
    expect(screen.getByTestId("donut-popover")).toBeInTheDocument();
  });
});
