import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { JumpNav } from "../JumpNav";
import type { BuilderVersion } from "../types";

function v(n: number): BuilderVersion {
  return {
    n,
    summary: { source: `Version ${n}` },
    columns: [],
    rows: [],
    rowCount: 0,
    sql: "SELECT 1",
    executionTimeMs: 0,
    createdAt: 0,
  };
}

describe("JumpNav", () => {
  it("renders nothing when there are no versions", () => {
    const { container } = render(<JumpNav versions={[]} selectedN={null} onSelect={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one button per version with the v{n} label", () => {
    render(<JumpNav versions={[v(1), v(2), v(3)]} selectedN={2} onSelect={() => {}} />);
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
  });

  it("calls onSelect with the version number when a pill is clicked", () => {
    const onSelect = vi.fn();
    render(<JumpNav versions={[v(1), v(2)]} selectedN={1} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("v2"));
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
