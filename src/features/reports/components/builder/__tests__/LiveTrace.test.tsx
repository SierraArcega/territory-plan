import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { LiveTrace } from "../LiveTrace";
import { TraceLine } from "../TraceLine";
import type { TurnEvent } from "../../../lib/agent/types";

const ZERO_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

// Builds a typical event sequence: model_call -> tool_result -> model_call ->
// tool_result. The first tool is `search_metadata("stuck")`; the second is
// `run_sql("SELECT 1")`.
function fixtureFinishedEvents(): TurnEvent[] {
  return [
    {
      kind: "model_call",
      iteration: 1,
      stopReason: "tool_use",
      usage: ZERO_USAGE,
      assistantText: null,
      toolUses: [{ id: "t1", name: "search_metadata", input: { query: "stuck" } }],
    },
    {
      kind: "tool_result",
      toolUseId: "t1",
      toolName: "search_metadata",
      isError: false,
      content: "found 3",
    },
    {
      kind: "model_call",
      iteration: 2,
      stopReason: "tool_use",
      usage: ZERO_USAGE,
      assistantText: null,
      toolUses: [{ id: "t2", name: "run_sql", input: { sql: "SELECT 1" } }],
    },
    {
      kind: "tool_result",
      toolUseId: "t2",
      toolName: "run_sql",
      isError: false,
      content: "run_sql ok",
    },
  ];
}

// Mid-stream: search_metadata done, run_sql still pending.
function fixtureInFlightEvents(): TurnEvent[] {
  return [
    {
      kind: "model_call",
      iteration: 1,
      stopReason: "tool_use",
      usage: ZERO_USAGE,
      assistantText: null,
      toolUses: [{ id: "t1", name: "search_metadata", input: { query: "stuck" } }],
    },
    {
      kind: "tool_result",
      toolUseId: "t1",
      toolName: "search_metadata",
      isError: false,
      content: "found 3",
    },
    {
      kind: "model_call",
      iteration: 2,
      stopReason: "tool_use",
      usage: ZERO_USAGE,
      assistantText: null,
      toolUses: [{ id: "t2", name: "run_sql", input: { sql: "SELECT 1" } }],
    },
  ];
}

describe("TraceLine", () => {
  it("renders the $ prefix, tool name, arg, and ms in done state", () => {
    render(<TraceLine tool="search_metadata" arg='"stuck"' state="done" ms={124} />);
    expect(screen.getByText("$")).toBeTruthy();
    expect(screen.getByText('search_metadata("stuck")')).toBeTruthy();
    expect(screen.getByText(/124ms/)).toBeTruthy();
  });

  it("shows the blinking cursor in active state and no ms", () => {
    const { container } = render(
      <TraceLine tool="run_sql" arg='"SELECT 1"' state="active" />,
    );
    expect(container.textContent).toContain("▌");
    expect(container.textContent).not.toContain("ms");
  });

  it("dims the body in queued state", () => {
    const { container } = render(
      <TraceLine tool="describe_table" arg='"districts"' state="queued" />,
    );
    expect(container.textContent).toContain("describe_table");
    expect(container.textContent).not.toContain("ms");
    expect(container.textContent).not.toContain("▌");
  });
});

describe("LiveTrace", () => {
  it("collapses to a toggle on completed turns by default", () => {
    render(<LiveTrace events={fixtureFinishedEvents()} completed totalMs={2500} />);
    expect(screen.getByRole("button").textContent).toMatch(/2 steps · 2\.5s/);
    // Lines themselves are not rendered yet.
    expect(screen.queryByText('search_metadata("stuck")')).toBeNull();
  });

  it("expands the trace on toggle click", () => {
    render(<LiveTrace events={fixtureFinishedEvents()} completed totalMs={2500} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText('search_metadata("stuck")')).toBeTruthy();
    expect(screen.getByText('run_sql("SELECT 1")')).toBeTruthy();
  });

  it("renders the in-flight header with the pending version label", () => {
    const { container } = render(
      <LiveTrace events={fixtureInFlightEvents()} completed={false} pendingVersionN={3} />,
    );
    expect(container.textContent).toContain("Working on v3");
    // step 2 of 2 (search_metadata done, run_sql active)
    expect(container.textContent).toMatch(/step 2 of 2/);
    // active line shows the cursor
    expect(container.textContent).toContain("▌");
    // earlier line is done with ✓
    expect(container.textContent).toContain("✓");
  });

  it("hides ghost-report-retry events from the visible trace", () => {
    const events: TurnEvent[] = [
      {
        kind: "tool_result",
        toolUseId: "ghost-report-retry",
        toolName: "ghost_report_retry",
        isError: true,
        content: "you wrote SQL in text",
      },
      {
        kind: "model_call",
        iteration: 1,
        stopReason: "tool_use",
        usage: ZERO_USAGE,
        assistantText: null,
        toolUses: [{ id: "t1", name: "run_sql", input: { sql: "SELECT 1" } }],
      },
      {
        kind: "tool_result",
        toolUseId: "t1",
        toolName: "run_sql",
        isError: false,
        content: "ok",
      },
    ];
    render(<LiveTrace events={events} completed totalMs={1000} />);
    fireEvent.click(screen.getByRole("button"));
    // 1 step (run_sql), retry is hidden.
    const allLines = document.body.textContent ?? "";
    expect(allLines).toContain("run_sql");
    expect(allLines).not.toContain("ghost_report_retry");
  });

  it("returns null on completed with zero (visible) lines", () => {
    const { container } = render(
      <LiveTrace events={[]} completed totalMs={0} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
