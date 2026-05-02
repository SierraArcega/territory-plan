import { describe, it, expect, vi } from "vitest";
import type { QuerySummary } from "../types";

// Mock handlers
vi.mock("@/features/reports/lib/tools/list-tables", () => ({
  handleListTables: vi.fn(async () => "districts: ~13K US school districts"),
}));
vi.mock("@/features/reports/lib/tools/describe-table", () => ({
  handleDescribeTable: vi.fn(async () => "columns..."),
}));
vi.mock("@/features/reports/lib/tools/search-metadata", () => ({
  handleSearchMetadata: vi.fn(async () => "no matches"),
}));
vi.mock("@/features/reports/lib/tools/get-column-values", () => ({
  handleGetColumnValues: vi.fn(async () => "values..."),
}));
vi.mock("@/features/reports/lib/tools/count-rows", () => ({
  handleCountRows: vi.fn(async () => "Row count: 10"),
}));
vi.mock("@/features/reports/lib/tools/sample-rows", () => ({
  handleSampleRows: vi.fn(async () => "rows..."),
}));
vi.mock("@/features/reports/lib/tools/run-sql", () => ({
  handleRunSql: vi.fn(async (_sql: string, summary: QuerySummary) => ({
    kind: "ok",
    sql: "SELECT 1 LIMIT 100",
    summary,
    columns: ["a"],
    rows: [{ a: 1 }],
    rowCount: 1,
    executionTimeMs: 5,
  })),
}));
vi.mock("@/features/reports/lib/tools/saved-reports", () => ({
  handleSearchSavedReports: vi.fn(async () => "no reports"),
  handleGetSavedReport: vi.fn(async () => "no report"),
}));

// Scripted Anthropic mock
function makeScriptedAnthropic(responses: Array<unknown>) {
  let i = 0;
  return {
    messages: {
      create: vi.fn(async () => responses[i++]),
    },
  };
}

import { runAgentLoop } from "../agent-loop";

const summary: QuerySummary = { source: "Districts" };

describe("runAgentLoop", () => {
  it("terminates on text-only response (clarifying question)", async () => {
    const anthropic = makeScriptedAnthropic([
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Do you mean bookings or pipeline?" }],
      },
    ]);
    const result = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "show me wins",
      priorTurns: [],
      userId: "u1",
    });
    expect(result.kind).toBe("clarifying");
    if (result.kind === "clarifying") {
      expect(result.text).toMatch(/bookings/);
    }
  });

  it("terminates on run_sql tool call", async () => {
    const anthropic = makeScriptedAnthropic([
      {
        stop_reason: "tool_use",
        usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "run_sql",
            input: { sql: "SELECT a FROM districts WHERE state='Texas' LIMIT 100", summary },
          },
        ],
      },
    ]);
    const result = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "Texas districts",
      priorTurns: [],
      userId: "u1",
    });
    expect(result.kind).toBe("result");
  });

  it("captures token usage and events on a result turn", async () => {
    const anthropic = makeScriptedAnthropic([
      {
        stop_reason: "tool_use",
        usage: {
          input_tokens: 1200,
          output_tokens: 300,
          cache_creation_input_tokens: 8000,
          cache_read_input_tokens: 0,
        },
        content: [
          { type: "text", text: "Looking up Texas." },
          {
            type: "tool_use",
            id: "t1",
            name: "run_sql",
            input: { sql: "SELECT a FROM districts WHERE state='Texas' LIMIT 100", summary },
          },
        ],
      },
    ]);
    const result = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "Texas districts",
      priorTurns: [],
      userId: "u1",
    });
    expect(result.kind).toBe("result");
    expect(result.usage.inputTokens).toBe(1200);
    expect(result.usage.outputTokens).toBe(300);
    expect(result.usage.cacheCreationInputTokens).toBe(8000);
    expect(result.usage.cacheReadInputTokens).toBe(0);
    // 1 model_call + 1 tool_result for the run_sql ok path
    expect(result.events.length).toBe(2);
    expect(result.events[0]!.kind).toBe("model_call");
    expect(result.events[1]!.kind).toBe("tool_result");
  });

  it("sums token usage across multiple iterations", async () => {
    const runSqlMod = await import("@/features/reports/lib/tools/run-sql");
    vi.mocked(runSqlMod.handleRunSql).mockResolvedValue({
      kind: "ok",
      sql: "SELECT a FROM districts LIMIT 100",
      summary,
      columns: ["a"],
      rows: [{ a: 1 }],
      rowCount: 1,
      executionTimeMs: 5,
    });
    const anthropic = makeScriptedAnthropic([
      {
        stop_reason: "tool_use",
        usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        content: [{ type: "tool_use", id: "e1", name: "list_tables", input: {} }],
      },
      {
        stop_reason: "tool_use",
        usage: { input_tokens: 200, output_tokens: 60, cache_creation_input_tokens: 0, cache_read_input_tokens: 100 },
        content: [
          { type: "tool_use", id: "e2", name: "run_sql", input: { sql: "SELECT a FROM districts LIMIT 100", summary } },
        ],
      },
    ]);
    const result = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "Districts",
      priorTurns: [],
      userId: "u1",
    });
    expect(result.kind).toBe("result");
    expect(result.usage.inputTokens).toBe(300);
    expect(result.usage.outputTokens).toBe(110);
    expect(result.usage.cacheReadInputTokens).toBe(100);
  });

  it("retries up to 2x on run_sql error, then surrenders", async () => {
    const runSqlMod = await import("@/features/reports/lib/tools/run-sql");
    const handleSpy = vi.mocked(runSqlMod.handleRunSql);
    handleSpy.mockResolvedValue({ kind: "error", message: 'column "x" does not exist' });

    const toolUseMsg = {
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "t1",
          name: "run_sql",
          input: { sql: "SELECT x FROM districts LIMIT 100", summary },
        },
      ],
    };
    const anthropic = makeScriptedAnthropic([
      toolUseMsg,
      toolUseMsg,
      toolUseMsg,
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "I'm having trouble with this query. Can you rephrase?" }],
      },
    ]);
    const result = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "busted",
      priorTurns: [],
      userId: "u1",
    });
    expect(result.kind).toBe("surrender");
  });

  it("validation_error feedback is surfaced distinctly and retry succeeds", async () => {
    const runSqlMod = await import("@/features/reports/lib/tools/run-sql");
    vi.mocked(runSqlMod.handleRunSql)
      .mockResolvedValueOnce({
        kind: "validation_error",
        errors: ["SQL is missing a LIMIT clause."],
      })
      .mockResolvedValueOnce({
        kind: "ok",
        sql: "SELECT a FROM districts LIMIT 100",
        summary,
        columns: ["a"],
        rows: [{ a: 1 }],
        rowCount: 1,
        executionTimeMs: 5,
      });

    const toolUseMsg = {
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "t2",
          name: "run_sql",
          input: { sql: "SELECT a FROM districts LIMIT 100", summary },
        },
      ],
    };
    const anthropic = makeScriptedAnthropic([toolUseMsg, toolUseMsg]);
    const result = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "districts",
      priorTurns: [],
      userId: "u1",
    });

    expect(result.kind).toBe("result");
    expect(runSqlMod.handleRunSql).toHaveBeenCalledTimes(2);

    const secondCallMessages = (anthropic.messages.create as ReturnType<typeof vi.fn>).mock.calls[1][0].messages as Array<{ role: string; content: unknown }>;
    const toolResultMsg = secondCallMessages.find(
      (m) => m.role === "user" && Array.isArray(m.content),
    ) as { role: string; content: Array<{ type: string; is_error?: boolean; content?: string }> } | undefined;
    expect(toolResultMsg).toBeDefined();
    const toolResultBlock = toolResultMsg!.content.find((b) => b.type === "tool_result");
    expect(toolResultBlock).toBeDefined();
    expect(toolResultBlock!.is_error).toBe(true);
    expect(toolResultBlock!.content).toMatch(/validation failed/);
  });

  it("exploratory-then-run_sql happy path", async () => {
    const runSqlMod = await import("@/features/reports/lib/tools/run-sql");
    vi.mocked(runSqlMod.handleRunSql).mockResolvedValue({
      kind: "ok",
      sql: "SELECT a FROM districts LIMIT 100",
      summary,
      columns: ["a"],
      rows: [{ a: 1 }],
      rowCount: 1,
      executionTimeMs: 5,
    });

    const listTablesMod = await import("@/features/reports/lib/tools/list-tables");
    const describeTableMod = await import("@/features/reports/lib/tools/describe-table");

    const anthropic = makeScriptedAnthropic([
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "e1", name: "list_tables", input: {} }],
      },
      {
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "e2", name: "describe_table", input: { table: "districts" } },
        ],
      },
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "e3",
            name: "run_sql",
            input: { sql: "SELECT a FROM districts LIMIT 100", summary },
          },
        ],
      },
    ]);

    const result = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "show me districts",
      priorTurns: [],
      userId: "u1",
    });

    expect(result.kind).toBe("result");
    expect(listTablesMod.handleListTables).toHaveBeenCalledTimes(1);
    expect(describeTableMod.handleDescribeTable).toHaveBeenCalledTimes(1);
    expect(describeTableMod.handleDescribeTable).toHaveBeenCalledWith("districts");
    expect(runSqlMod.handleRunSql).toHaveBeenCalledTimes(1);
    expect(anthropic.messages.create).toHaveBeenCalledTimes(3);
  });

  it("exploratory call cap surrenders after MAX_EXPLORATORY_CALLS_PER_TURN", async () => {
    const responses = Array.from({ length: 21 }, () => ({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "t", name: "list_tables", input: {} }],
    }));

    const anthropic = makeScriptedAnthropic(responses);
    const listTablesMod = await import("@/features/reports/lib/tools/list-tables");

    const result = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "show me everything",
      priorTurns: [],
      userId: "u1",
    });

    expect(result.kind).toBe("surrender");
    if (result.kind === "surrender") {
      expect(result.text).toMatch(/narrowing this down/);
    }
    expect(listTablesMod.handleListTables).toHaveBeenCalledTimes(20);
  });

  it("mixed text+tool_use in one response is handled correctly", async () => {
    const runSqlMod = await import("@/features/reports/lib/tools/run-sql");
    vi.mocked(runSqlMod.handleRunSql).mockResolvedValue({
      kind: "ok",
      sql: "SELECT a FROM districts WHERE state='Texas' LIMIT 100",
      summary,
      columns: ["a"],
      rows: [{ a: 1 }],
      rowCount: 1,
      executionTimeMs: 5,
    });

    const anthropic = makeScriptedAnthropic([
      {
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "Looking up Texas districts now." },
          {
            type: "tool_use",
            id: "t1",
            name: "run_sql",
            input: {
              sql: "SELECT a FROM districts WHERE state='Texas' LIMIT 100",
              summary,
            },
          },
        ],
      },
    ]);

    const result = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "Texas districts",
      priorTurns: [],
      userId: "u1",
    });

    expect(result.kind).toBe("result");
    if (result.kind === "result") {
      expect(result.assistantText).toMatch(/Looking up Texas districts now\./);
    }
    expect(runSqlMod.handleRunSql).toHaveBeenCalledTimes(1);
  });

  describe("ghost-report retry", () => {
    it("retries once when the model returns SQL in text but no tool_use", async () => {
      const runSqlMod = await import("@/features/reports/lib/tools/run-sql");
      vi.mocked(runSqlMod.handleRunSql).mockResolvedValueOnce({
        kind: "ok",
        sql: "SELECT name FROM districts LIMIT 100",
        summary: { source: "Districts" },
        columns: ["name"],
        rows: [{ name: "Test ISD" }],
        rowCount: 1,
        executionTimeMs: 10,
      });

      const anthropic = makeScriptedAnthropic([
        {
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
          content: [
            {
              type: "text",
              text: "Here's the updated query:\n\n```sql\nSELECT name FROM districts LIMIT 100\n```\n\nThis pulls the names.",
            },
          ],
        },
        {
          stop_reason: "tool_use",
          usage: { input_tokens: 12, output_tokens: 8 },
          content: [
            { type: "text", text: "Pulling districts." },
            {
              type: "tool_use",
              id: "t1",
              name: "run_sql",
              input: { sql: "SELECT name FROM districts LIMIT 100", summary: { source: "Districts" } },
            },
          ],
        },
      ]);

      const result = await runAgentLoop({
        anthropic: anthropic as never,
        userMessage: "show me districts",
        priorTurns: [],
        userId: "u1",
      });

      expect(anthropic.messages.create).toHaveBeenCalledTimes(2);
      expect(result.kind).toBe("result");
      // Telemetry: an event marking the corrective injection
      const correctiveEvent = result.events.find(
        (e) => e.kind === "tool_result" && e.toolName === "ghost_report_retry",
      );
      expect(correctiveEvent).toBeDefined();
      // Verify the second API call's messages include the corrective user turn.
      // Note: messages is a shared mutable array, so we check via the corrective
      // event's content rather than positional indexing.
      const secondCallArgs = (anthropic.messages.create as ReturnType<typeof vi.fn>).mock.calls[1][0];
      const allMessages = secondCallArgs.messages as Array<{ role: string; content: unknown }>;
      const correctiveUserMsg = allMessages.find(
        (m) => m.role === "user" && typeof m.content === "string" && (m.content as string).includes("run_sql"),
      );
      expect(correctiveUserMsg).toBeDefined();
    });

    it("surrenders after the corrective retry also fails to invoke run_sql", async () => {
      const anthropic = makeScriptedAnthropic([
        {
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
          content: [
            {
              type: "text",
              text: "```sql\nSELECT * FROM districts\n```",
            },
          ],
        },
        {
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
          content: [
            {
              type: "text",
              text: "```sql\nSELECT * FROM districts\n```",
            },
          ],
        },
      ]);

      const result = await runAgentLoop({
        anthropic: anthropic as never,
        userMessage: "show me districts",
        priorTurns: [],
        userId: "u1",
      });

      expect(anthropic.messages.create).toHaveBeenCalledTimes(2); // initial + 1 corrective retry, then surrender
      expect(result.kind).toBe("surrender"); // ghost-retry exhausted — real failure, not a clarifying turn
    });

    it("does NOT retry when text contains no SQL fence (true clarifying turn)", async () => {
      const anthropic = makeScriptedAnthropic([
        {
          stop_reason: "end_turn",
          usage: { input_tokens: 5, output_tokens: 3 },
          content: [{ type: "text", text: "Did you mean closed-won or all stages?" }],
        },
      ]);

      const result = await runAgentLoop({
        anthropic: anthropic as never,
        userMessage: "show me deals",
        priorTurns: [],
        userId: "u1",
      });

      expect(anthropic.messages.create).toHaveBeenCalledTimes(1);
      expect(result.kind).toBe("clarifying");
    });
  });
});
