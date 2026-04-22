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
    expect(result.kind === "clarifying" || result.kind === "surrender").toBe(true);
  });
});
