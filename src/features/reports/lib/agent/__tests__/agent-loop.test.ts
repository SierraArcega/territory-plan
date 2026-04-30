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
    const summary: QuerySummary = {
      source: "Districts",
      filters: [{ id: "f1", label: "State", value: "Texas" }],
      columns: [{ id: "c1", label: "a" }],
      sort: null,
      limit: 100,
    };
    const anthropic = makeScriptedAnthropic([
      {
        stop_reason: "tool_use",
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

  it("retries up to 2x on run_sql error, then surrenders", async () => {
    const badSummary: QuerySummary = {
      source: "Districts",
      filters: [],
      columns: [{ id: "c1", label: "a" }],
      sort: null,
      limit: 100,
    };
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
          input: { sql: "SELECT x FROM districts LIMIT 100", summary: badSummary },
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
    const validSummary: QuerySummary = {
      source: "Districts",
      filters: [],
      columns: [{ id: "c1", label: "a" }],
      sort: null,
      limit: 100,
    };
    const runSqlMod = await import("@/features/reports/lib/tools/run-sql");
    vi.mocked(runSqlMod.handleRunSql)
      .mockResolvedValueOnce({
        kind: "validation_error",
        errors: ["summary.columns has 2 entries but SQL SELECT has 3"],
      })
      .mockResolvedValueOnce({
        kind: "ok",
        sql: "SELECT a FROM districts LIMIT 100",
        summary: validSummary,
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
          input: { sql: "SELECT a FROM districts LIMIT 100", summary: validSummary },
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

    // The second call to anthropic.messages.create should have a tool_result with is_error: true
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
    const validSummary: QuerySummary = {
      source: "Districts",
      filters: [],
      columns: [{ id: "c1", label: "a" }],
      sort: null,
      limit: 100,
    };
    const runSqlMod = await import("@/features/reports/lib/tools/run-sql");
    vi.mocked(runSqlMod.handleRunSql).mockResolvedValue({
      kind: "ok",
      sql: "SELECT a FROM districts LIMIT 100",
      summary: validSummary,
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
            input: { sql: "SELECT a FROM districts LIMIT 100", summary: validSummary },
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
    const validSummary: QuerySummary = {
      source: "Districts",
      filters: [{ id: "f1", label: "State", value: "Texas" }],
      columns: [{ id: "c1", label: "a" }],
      sort: null,
      limit: 100,
    };
    const runSqlMod = await import("@/features/reports/lib/tools/run-sql");
    vi.mocked(runSqlMod.handleRunSql).mockResolvedValue({
      kind: "ok",
      sql: "SELECT a FROM districts WHERE state='Texas' LIMIT 100",
      summary: validSummary,
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
              summary: validSummary,
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
});
