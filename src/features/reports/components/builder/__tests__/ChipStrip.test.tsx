import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ChipStrip } from "../ChipStrip";

describe("ChipStrip", () => {
  it("renders nothing when summary has no chip data", () => {
    const { container } = render(
      <ChipStrip summary={{ source: "Texas districts" }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders one chip per filter", () => {
    render(
      <ChipStrip
        summary={{
          source: "x",
          filters: ["State: Texas", "Days in stage > 90"],
        }}
      />,
    );
    expect(screen.getByText("State: Texas")).toBeInTheDocument();
    expect(screen.getByText("Days in stage > 90")).toBeInTheDocument();
    expect(screen.getAllByText(/^Filter$/i)).toHaveLength(2);
  });

  it("inlines columns up to 4 and collapses to '+N more' beyond that", () => {
    render(
      <ChipStrip
        summary={{
          source: "x",
          columns: ["A", "B", "C", "D"],
        }}
      />,
    );
    expect(screen.getByText("A, B, C, D")).toBeInTheDocument();
  });

  it("collapses 5+ columns", () => {
    render(
      <ChipStrip
        summary={{
          source: "x",
          columns: ["District", "State", "Stage", "Days", "Amount", "Owner"],
        }}
      />,
    );
    expect(screen.getByText("District, State, Stage +3 more")).toBeInTheDocument();
  });

  it("renders sort with arrow", () => {
    render(<ChipStrip summary={{ source: "x", sort: "Close date ↓" }} />);
    expect(screen.getByText("Close date ↓")).toBeInTheDocument();
    expect(screen.getByText("Sort")).toBeInTheDocument();
  });

  it("ignores empty/whitespace filter strings", () => {
    render(
      <ChipStrip
        summary={{
          source: "x",
          filters: ["State: Texas", "  ", ""],
        }}
      />,
    );
    expect(screen.getByText("State: Texas")).toBeInTheDocument();
    expect(screen.getAllByText(/^Filter$/i)).toHaveLength(1);
  });
});
