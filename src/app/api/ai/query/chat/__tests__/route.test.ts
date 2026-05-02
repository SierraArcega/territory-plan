// src/app/api/ai/query/chat/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn(async () => ({ id: "user-1" })),
}));
vi.mock("@/features/reports/lib/claude-client", () => ({
  getAnthropic: vi.fn(() => ({})),
}));
vi.mock("@/features/reports/lib/agent/conversation", () => ({
  loadPriorTurns: vi.fn(async () => []),
  saveTurn: vi.fn(async () => 1),
}));
vi.mock("@/features/reports/lib/agent/agent-loop", () => ({
  runAgentLoop: vi.fn(),
}));

import { POST } from "../route";
import { NextRequest } from "next/server";
import { saveTurn } from "@/features/reports/lib/agent/conversation";
import { runAgentLoop } from "@/features/reports/lib/agent/agent-loop";

const mockSaveTurn = vi.mocked(saveTurn);
const mockRunAgentLoop = vi.mocked(runAgentLoop);

const ZERO_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/query/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  mockSaveTurn.mockClear();
  mockRunAgentLoop.mockReset();
});

describe("POST /api/ai/query/chat", () => {
  it("rejects missing message", async () => {
    const res = await POST(req({ message: "" }));
    expect(res.status).toBe(400);
  });

  it("returns conversationId + result on success", async () => {
    mockRunAgentLoop.mockResolvedValueOnce({
      kind: "result",
      sql: "SELECT 1 LIMIT 100",
      summary: { source: "Test query" },
      columns: ["a"],
      rows: [{ a: 1 }],
      rowCount: 1,
      executionTimeMs: 5,
      assistantText: "",
      events: [],
      usage: { inputTokens: 10, outputTokens: 5, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    });
    const res = await POST(req({ message: "show me districts" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.conversationId).toBeTruthy();
    expect(json.result.rows).toBeDefined();
    expect(json.result.summary.source).toBe("Test query");
  });

  describe("query_log error column", () => {
    it("does not set error for clarifying turns (chat-only responses)", async () => {
      mockRunAgentLoop.mockResolvedValueOnce({
        kind: "clarifying",
        text: "Yep, I'm working! How can I help?",
        events: [
          {
            kind: "model_call",
            iteration: 1,
            stopReason: "end_turn",
            usage: ZERO_USAGE,
            assistantText: "Yep, I'm working!",
            toolUses: [],
          },
        ],
        usage: ZERO_USAGE,
      });

      const res = await POST(req({ message: "do you work" }));
      expect(res.status).toBe(200);
      expect(mockSaveTurn).toHaveBeenCalledTimes(1);
      const args = mockSaveTurn.mock.calls[0][0];
      expect(args.assistantText).toBe("Yep, I'm working! How can I help?");
      expect(args.error).toBeUndefined();
    });

    it("surfaces real SQL error from events on surrender", async () => {
      mockRunAgentLoop.mockResolvedValueOnce({
        kind: "surrender",
        text: "I tried a few times but couldn't run that query.",
        events: [
          {
            kind: "tool_result",
            toolUseId: "t1",
            toolName: "run_sql",
            isError: true,
            content: "run_sql error: column \"sped_pct\" does not exist",
          },
        ],
        usage: ZERO_USAGE,
      });

      const res = await POST(req({ message: "sped percent by district" }));
      expect(res.status).toBe(200);
      expect(mockSaveTurn).toHaveBeenCalledTimes(1);
      const args = mockSaveTurn.mock.calls[0][0];
      expect(args.error).toBe("run_sql error: column \"sped_pct\" does not exist");
      expect(args.assistantText).toBe("I tried a few times but couldn't run that query.");
    });

    it("uses sentinel error when surrender has no SQL error in events", async () => {
      mockRunAgentLoop.mockResolvedValueOnce({
        kind: "surrender",
        text: "I'm having trouble narrowing this down. Could you give me more details?",
        events: [
          {
            kind: "model_call",
            iteration: 1,
            stopReason: "tool_use",
            usage: ZERO_USAGE,
            assistantText: null,
            toolUses: [{ id: "t1", name: "list_tables", input: {} }],
          },
        ],
        usage: ZERO_USAGE,
      });

      const res = await POST(req({ message: "show me stuff" }));
      expect(res.status).toBe(200);
      expect(mockSaveTurn).toHaveBeenCalledTimes(1);
      const args = mockSaveTurn.mock.calls[0][0];
      expect(args.error).toBe("agent_surrender_no_sql_error");
    });

    it("uses last failed tool_result when multiple errors are present", async () => {
      mockRunAgentLoop.mockResolvedValueOnce({
        kind: "surrender",
        text: "I tried a few times but couldn't run that query.",
        events: [
          {
            kind: "tool_result",
            toolUseId: "t1",
            toolName: "run_sql",
            isError: true,
            content: "run_sql error: first failure",
          },
          {
            kind: "tool_result",
            toolUseId: "t2",
            toolName: "run_sql",
            isError: false,
            content: "run_sql ok — 0 row(s) in 5ms",
          },
          {
            kind: "tool_result",
            toolUseId: "t3",
            toolName: "run_sql",
            isError: true,
            content: "run_sql error: second failure",
          },
        ],
        usage: ZERO_USAGE,
      });

      const res = await POST(req({ message: "broken query" }));
      expect(res.status).toBe(200);
      const args = mockSaveTurn.mock.calls[0][0];
      expect(args.error).toBe("run_sql error: second failure");
    });
  });
});
