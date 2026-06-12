import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import InfoTip from "../InfoTip";

describe("InfoTip", () => {
  it("is hidden by default", () => {
    render(<InfoTip label="New" text="Fresh MQL awaiting acceptance." />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows on focus and hides on blur", () => {
    render(<InfoTip label="New" text="Fresh MQL awaiting acceptance." />);
    const trigger = screen.getByRole("button", { name: "New" });

    fireEvent.focus(trigger);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Fresh MQL awaiting acceptance.");
    // aria wiring: trigger points at the tooltip while shown
    expect(trigger).toHaveAttribute("aria-describedby", tip.id);

    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute("aria-describedby");
  });

  it("shows on hover and hides on mouse leave", () => {
    render(<InfoTip text="Definition" />);
    const wrapper = screen.getByRole("button", {
      name: "More information",
    }).parentElement!;

    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("dismisses on Escape", () => {
    render(<InfoTip text="Definition" />);
    const trigger = screen.getByRole("button", { name: "More information" });

    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("renders the bold label line when provided", () => {
    render(<InfoTip label="Working" text="BDR is actively sequencing." />);
    fireEvent.focus(screen.getByRole("button", { name: "Working" }));
    expect(screen.getByText("Working")).toBeInTheDocument();
    expect(screen.getByText("BDR is actively sequencing.")).toBeInTheDocument();
  });

  it("anchors to the requested edge", () => {
    render(<InfoTip text="Edge case" align="right" />);
    fireEvent.focus(screen.getByRole("button", { name: "More information" }));
    expect(screen.getByRole("tooltip").style.right).toBe("0px");
  });
});
