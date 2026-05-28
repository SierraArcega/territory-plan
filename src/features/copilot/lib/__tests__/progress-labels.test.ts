import { describe, it, expect } from "vitest";
import { friendlyProgressLabel } from "../progress-labels";
import type { TurnEvent } from "@/features/reports/lib/agent/types";

const modelCall = (name: string): TurnEvent => ({
  kind: "model_call", iteration: 1, stopReason: null,
  usage: { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
  assistantText: null, toolUses: [{ id: "t1", name, input: {} }],
});

describe("friendlyProgressLabel", () => {
  it("defaults to Thinking when there are no events", () => {
    expect(friendlyProgressLabel([])).toBe("Thinking…");
  });
  it("maps run_sql to a friendly phrase, never the tool name", () => {
    const label = friendlyProgressLabel([modelCall("run_sql")]);
    expect(label).toBe("Searching your data…");
    expect(label).not.toContain("run_sql");
  });
  it("maps propose_actions to Drafting", () => {
    expect(friendlyProgressLabel([modelCall("propose_actions")])).toBe("Drafting…");
  });
  it("uses a generic phrase for an unknown tool (no raw name)", () => {
    const label = friendlyProgressLabel([modelCall("some_internal_tool")]);
    expect(label).toBe("Working…");
    expect(label).not.toContain("some_internal_tool");
  });
});
