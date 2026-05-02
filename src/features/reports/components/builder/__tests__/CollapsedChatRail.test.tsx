import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CollapsedChatRail } from "../CollapsedChatRail";
import type { BuilderVersion } from "../types";

function v(n: number, label?: string): BuilderVersion {
  return {
    n,
    summary: { source: `Version ${n}`, versionLabel: label },
    columns: [],
    rows: [],
    rowCount: 0,
    sql: "SELECT 1",
    executionTimeMs: 0,
    createdAt: 0,
  };
}

describe("CollapsedChatRail", () => {
  it("renders one pill per version, all filled, with v{n} labels", () => {
    render(
      <CollapsedChatRail
        versions={[v(1), v(2), v(3)]}
        selectedN={2}
        onSelectVersion={() => {}}
        onExpand={() => {}}
      />,
    );
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
  });

  it("calls onExpand when the chevron-right button is clicked", () => {
    const onExpand = vi.fn();
    render(
      <CollapsedChatRail
        versions={[v(1)]}
        selectedN={1}
        onSelectVersion={() => {}}
        onExpand={onExpand}
      />,
    );
    fireEvent.click(screen.getByLabelText(/^expand chat$/i));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("calls onExpand when the bottom send-icon button is clicked", () => {
    const onExpand = vi.fn();
    render(
      <CollapsedChatRail
        versions={[v(1)]}
        selectedN={1}
        onSelectVersion={() => {}}
        onExpand={onExpand}
      />,
    );
    fireEvent.click(screen.getByLabelText(/follow-up/i));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("calls onSelectVersion when a pill is clicked", () => {
    const onSelectVersion = vi.fn();
    render(
      <CollapsedChatRail
        versions={[v(1), v(2)]}
        selectedN={1}
        onSelectVersion={onSelectVersion}
        onExpand={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("v2"));
    expect(onSelectVersion).toHaveBeenCalledWith(2);
  });

  it("renders no pill stack when there are no versions", () => {
    render(
      <CollapsedChatRail
        versions={[]}
        selectedN={null}
        onSelectVersion={() => {}}
        onExpand={() => {}}
      />,
    );
    // Only the two button labels — no v{n} text anywhere.
    expect(screen.queryByText(/^v\d+/)).not.toBeInTheDocument();
  });
});
