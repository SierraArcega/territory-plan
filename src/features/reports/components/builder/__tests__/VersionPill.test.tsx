import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { VersionPill } from "../VersionPill";

describe("VersionPill", () => {
  it("renders the version label", () => {
    render(<VersionPill n={3} />);
    expect(screen.getByText("v3")).toBeInTheDocument();
  });

  it("invokes onClick when clicked (interactive variant)", () => {
    const onClick = vi.fn();
    render(<VersionPill n={1} onClick={onClick} />);
    fireEvent.click(screen.getByText("v1"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders as a span (non-interactive) when no onClick provided", () => {
    render(<VersionPill n={2} />);
    const el = screen.getByText("v2");
    expect(el.tagName).toBe("SPAN");
  });

  it("applies coral fill when selected", () => {
    render(<VersionPill n={1} selected />);
    const el = screen.getByText("v1");
    expect(el).toHaveStyle({ background: "#F37167" });
  });
});
