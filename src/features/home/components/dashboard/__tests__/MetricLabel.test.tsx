import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MetricLabel from "../MetricLabel";

describe("MetricLabel", () => {
  it("renders its label children and an info trigger", () => {
    render(<MetricLabel tip="Open opps you're working.">Open Pipeline</MetricLabel>);
    expect(screen.getByText("Open Pipeline")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("hides the tip until hovered, then shows it", () => {
    render(<MetricLabel tip="Open opps you're working.">Open Pipeline</MetricLabel>);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseEnter(screen.getByText("Open Pipeline").parentElement!);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Open opps you're working.");
    fireEvent.mouseLeave(screen.getByText("Open Pipeline").parentElement!);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows the tip on keyboard focus and hides on blur", () => {
    render(<MetricLabel tip="Closed-won bookings.">Bookings</MetricLabel>);
    const trigger = screen.getByRole("button");
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Closed-won bookings.");
    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
