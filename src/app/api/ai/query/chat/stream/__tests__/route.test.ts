// src/app/api/ai/query/chat/stream/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TurnEvent } from "@/features/reports/lib/agent/types";

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
  return new NextRequest("http://localhost/api/ai/query/chat/stream", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

interface ParsedEvent {
  event: string;
  data: unknown;
}

// Minimal SSE parser — splits the raw stream on the standard `\n\n` event
// terminator, then per-chunk reads `event: <name>` and `data: <json>` lines.
// This intentionally mirrors the on-the-wire format the client hook will parse.
function parseSse(raw: string): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  for (const chunk of raw.split("\n\n")) {
    if (!chunk.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    let hasField = false;
    for (const line of chunk.split("\n")) {
      // SSE comment lines start with ":" — skip entirely (no event emitted).
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
        hasField = true;
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
        hasField = true;
      }
    }
    // Comment-only frame (e.g. the immediate-flush "stream-open") — skip.
    if (!hasField) continue;
    const dataStr = dataLines.join("\n");
    out.push({ event, data: dataStr ? JSON.parse(dataStr) : null });
  }
  return out;
}

async function readStreamToString(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
  }
  buf += decoder.decode();
  return buf;
}

beforeEach(() => {
  mockSaveTurn.mockClear();
  mockRunAgentLoop.mockReset();
});

describe("POST /api/ai/query/chat/stream", () => {
  it("rejects missing message with 400", async () => {
    const res = await POST(req({ message: "" }));
    expect(res.status).toBe(400);
  });

  it("emits turn_event per agent event then a terminal result event", async () => {
    // Mock the agent loop to invoke onEvent synchronously for a known sequence,
    // then return the final result. Mirrors the real loop's invariant.
    const fixtureEvents: TurnEvent[] = [
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
        content: "found 3 hits",
      },
      {
        kind: "model_call",
        iteration: 2,
        stopReason: "tool_use",
        usage: ZERO_USAGE,
        assistantText: "Looking up Texas.",
        toolUses: [{ id: "t2", name: "run_sql", input: { sql: "SELECT 1" } }],
      },
      {
        kind: "tool_result",
        toolUseId: "t2",
        toolName: "run_sql",
        isError: false,
        content: "run_sql ok — 1 row(s) in 4ms",
      },
    ];

    mockRunAgentLoop.mockImplementationOnce(async ({ onEvent }) => {
      for (const e of fixtureEvents) onEvent?.(e);
      return {
        kind: "result",
        sql: "SELECT 1 LIMIT 100",
        summary: { source: "Test stream" },
        columns: ["a"],
        rows: [{ a: 1 }],
        rowCount: 1,
        executionTimeMs: 4,
        assistantText: "Looking up Texas.",
        events: fixtureEvents,
        usage: ZERO_USAGE,
      };
    });

    const res = await POST(req({ message: "show me texas" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);

    const raw = await readStreamToString(res);
    const events = parseSse(raw);
    // 4 turn_events + 1 result = 5
    expect(events.length).toBe(5);
    expect(events.slice(0, 4).map((e) => e.event)).toEqual([
      "turn_event",
      "turn_event",
      "turn_event",
      "turn_event",
    ]);
    expect(events[4]!.event).toBe("result");

    // Order + payload integrity
    const streamedEvents = events.slice(0, 4).map((e) => e.data) as TurnEvent[];
    streamedEvents.forEach((e, i) => {
      expect(e.kind).toBe(fixtureEvents[i]!.kind);
      if (e.kind === "tool_result" && fixtureEvents[i]!.kind === "tool_result") {
        expect(e.toolName).toBe((fixtureEvents[i] as Extract<TurnEvent, { kind: "tool_result" }>).toolName);
      }
    });

    const final = events[4]!.data as {
      conversationId: string;
      assistantText: string;
      result: { rowCount: number; summary: { source: string } } | null;
    };
    expect(final.conversationId).toBeTruthy();
    expect(final.result?.rowCount).toBe(1);
    expect(final.result?.summary.source).toBe("Test stream");
    expect(final.assistantText).toBe("Looking up Texas.");

    // Persistence still happens — saveTurn fired once.
    expect(mockSaveTurn).toHaveBeenCalledTimes(1);
  });

  it("emits a result event with null result on clarifying turns", async () => {
    mockRunAgentLoop.mockImplementationOnce(async ({ onEvent }) => {
      onEvent?.({
        kind: "model_call",
        iteration: 1,
        stopReason: "end_turn",
        usage: ZERO_USAGE,
        assistantText: "Did you mean closed-won?",
        toolUses: [],
      });
      return {
        kind: "clarifying",
        text: "Did you mean closed-won?",
        events: [],
        usage: ZERO_USAGE,
      };
    });

    const res = await POST(req({ message: "show wins" }));
    const raw = await readStreamToString(res);
    const events = parseSse(raw);
    expect(events.at(-1)!.event).toBe("result");
    const final = events.at(-1)!.data as { assistantText: string; result: unknown };
    expect(final.assistantText).toBe("Did you mean closed-won?");
    expect(final.result).toBeNull();
  });

  it("emits an error event when the agent loop throws", async () => {
    mockRunAgentLoop.mockImplementationOnce(async () => {
      throw new Error("boom");
    });

    const res = await POST(req({ message: "anything" }));
    const raw = await readStreamToString(res);
    const events = parseSse(raw);
    const errorEvent = events.find((e) => e.event === "error");
    expect(errorEvent).toBeDefined();
    expect((errorEvent!.data as { error: string }).error).toMatch(/boom/);
  });

  it("still emits the terminal result event when saveTurn rejects", async () => {
    mockSaveTurn.mockRejectedValueOnce(new Error("db down"));
    mockRunAgentLoop.mockImplementationOnce(async () => ({
      kind: "result",
      sql: "SELECT 1 LIMIT 100",
      summary: { source: "x" },
      columns: ["a"],
      rows: [{ a: 1 }],
      rowCount: 1,
      executionTimeMs: 1,
      assistantText: "",
      events: [],
      usage: ZERO_USAGE,
    }));

    const res = await POST(req({ message: "anything" }));
    const raw = await readStreamToString(res);
    const events = parseSse(raw);
    expect(events.at(-1)!.event).toBe("result");
  });
});
