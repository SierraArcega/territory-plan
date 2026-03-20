import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PlanHighlightBanner from "../PlanHighlightBanner";

describe("PlanHighlightBanner", () => {
  it("renders plan name and district count", () => {
    render(
      <PlanHighlightBanner
        planName="West Region Q1"
        districtCount={5}
        onClear={vi.fn()}
      />
    );

    expect(screen.getByText(/Showing 5 districts from/)).toBeInTheDocument();
    expect(screen.getByText("West Region Q1")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("calls onClear when Clear button is clicked", () => {
    const onClear = vi.fn();
    render(
      <PlanHighlightBanner
        planName="West Region Q1"
        districtCount={5}
        onClear={onClear}
      />
    );

    fireEvent.click(screen.getByText("Clear"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("does not render when planName is empty", () => {
    const { container } = render(
      <PlanHighlightBanner
        planName=""
        districtCount={0}
        onClear={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("handles singular district count", () => {
    render(
      <PlanHighlightBanner
        planName="Small Plan"
        districtCount={1}
        onClear={vi.fn()}
      />
    );

    expect(screen.getByText(/Showing 1 district from/)).toBeInTheDocument();
  });
});
