import { describe, it, expect, vi } from "vitest";

// Mock the reused run_sql terminal so the answer rail doesn't touch a real DB.
vi.mock("@/features/reports/lib/tools/run-sql", () => ({
  handleRunSql: vi.fn(async (sql: string, summary: unknown) => ({
    kind: "ok",
    sql,
    summary,
    columns: ["a"],
    rows: [{ a: 1 }],
    rowCount: 1,
    executionTimeMs: 3,
  })),
}));

import { runAgentLoop } from "@/features/reports/lib/agent/agent-loop";

function scripted(responses: Array<unknown>) {
  let i = 0;
  // The loop calls messages.stream(...).on("text", …) then awaits finalMessage().
  return {
    messages: {
      stream: vi.fn(() => {
        const resp = responses[i++];
        return { on: vi.fn(), finalMessage: vi.fn(async () => resp) };
      }),
    },
  };
}

const SYS = "copilot system prompt";
const TOOLS = [] as never;

describe("agent-loop copilot variant (two terminals)", () => {
  it("routes run_sql to the answer rail → result", async () => {
    const anthropic = scripted([
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "run_sql",
            input: { sql: "SELECT a FROM tasks LIMIT 10", summary: { source: "Tasks" } },
          },
        ],
      },
    ]);
    const res = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "how many open tasks?",
      priorTurns: [],
      userId: "u1",
      agentVariant: "copilot",
      systemPrompt: SYS,
      tools: TOOLS,
      terminalTool: { name: "propose_actions", handle: vi.fn() },
    });
    expect(res.kind).toBe("result");
  });

  it("routes propose_actions to the write rail → terminal_result", async () => {
    const handle = vi.fn(async () => ({
      kind: "ok" as const,
      result: { proposedActions: [{ id: "x" }] },
    }));
    const anthropic = scripted([
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "propose_actions",
            input: { actions: [{ objectType: "task", operation: "create", fields: { title: "X" } }] },
          },
        ],
      },
    ]);
    const res = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "add a task",
      priorTurns: [],
      userId: "u1",
      agentVariant: "copilot",
      systemPrompt: SYS,
      tools: TOOLS,
      terminalTool: { name: "propose_actions", handle },
    });
    expect(res.kind).toBe("terminal_result");
    expect(handle).toHaveBeenCalledTimes(1);
    if (res.kind === "terminal_result") {
      expect(
        (res.terminalResult as { proposedActions: unknown[] }).proposedActions,
      ).toHaveLength(1);
    }
  });

  it("retries propose_actions on validation_error, then succeeds", async () => {
    const handle = vi
      .fn()
      .mockResolvedValueOnce({ kind: "validation_error", errors: ["bad fields"] })
      .mockResolvedValueOnce({ kind: "ok", result: { proposedActions: [] } });
    const toolMsg = {
      stop_reason: "tool_use",
      content: [
        { type: "tool_use", id: "t1", name: "propose_actions", input: { actions: [] } },
      ],
    };
    const anthropic = scripted([toolMsg, toolMsg]);
    const res = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "do a thing",
      priorTurns: [],
      userId: "u1",
      agentVariant: "copilot",
      systemPrompt: SYS,
      tools: TOOLS,
      terminalTool: { name: "propose_actions", handle },
    });
    expect(res.kind).toBe("terminal_result");
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it("treats a plain-text turn as clarifying (no tool call)", async () => {
    const anthropic = scripted([
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Which district did you mean?" }],
      },
    ]);
    const res = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "log a call",
      priorTurns: [],
      userId: "u1",
      agentVariant: "copilot",
      systemPrompt: SYS,
      tools: TOOLS,
      terminalTool: { name: "propose_actions", handle: vi.fn() },
    });
    expect(res.kind).toBe("clarifying");
  });

  it("continues across pause_turn, then returns research on the final text", async () => {
    const anthropic = scripted([
      {
        stop_reason: "pause_turn",
        content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "x" } }],
      },
      {
        stop_reason: "end_turn",
        content: [
          {
            type: "text",
            text: "Austin ISD passed a $2.4B bond in 2024.",
            citations: [{ url: "https://austinisd.org/bond", title: "2024 Bond" }],
          },
        ],
      },
    ]);
    const res = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "any recent Austin ISD news?",
      priorTurns: [],
      userId: "u1",
      agentVariant: "copilot",
      systemPrompt: SYS,
      tools: TOOLS,
      terminalTool: { name: "propose_actions", handle: vi.fn() },
    });
    expect(res.kind).toBe("research");
    if (res.kind === "research") {
      expect(res.assistantText).toContain("bond");
      expect(res.citations).toEqual([{ url: "https://austinisd.org/bond", title: "2024 Bond" }]);
    }
    expect(anthropic.messages.stream).toHaveBeenCalledTimes(2);
  });

  it("returns research when server tools ran without a pause_turn", async () => {
    const anthropic = scripted([
      {
        stop_reason: "end_turn",
        content: [
          { type: "server_tool_use", id: "s1", name: "web_search", input: {} },
          { type: "text", text: "done", citations: [] },
        ],
      },
    ]);
    const res = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "search the web",
      priorTurns: [],
      userId: "u1",
      agentVariant: "copilot",
      systemPrompt: SYS,
      tools: TOOLS,
      terminalTool: { name: "propose_actions", handle: vi.fn() },
    });
    expect(res.kind).toBe("research");
    if (res.kind === "research") expect(res.citations).toEqual([]);
  });

  it("still treats a no-tool text turn as clarifying when no server tools ran", async () => {
    const anthropic = scripted([
      { stop_reason: "end_turn", content: [{ type: "text", text: "Which district?" }] },
    ]);
    const res = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "tell me about it",
      priorTurns: [],
      userId: "u1",
      agentVariant: "copilot",
      systemPrompt: SYS,
      tools: TOOLS,
      terminalTool: { name: "propose_actions", handle: vi.fn() },
    });
    expect(res.kind).toBe("clarifying");
  });
});
