/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

// Scripted Anthropic mock — list-builder pipeline returns the same shape as
// the reports agent test harness.
const anthropicMessagesCreate = vi.fn();
vi.mock("@/features/reports/lib/claude-client", () => ({
  getAnthropic: () => ({
    messages: { create: anthropicMessagesCreate },
  }),
}));

// Stub the readonly pool — sample_values tool exercises it but the test
// scripts only the emit_list_spec turn so we shouldn't hit it.
vi.mock("@/lib/db-readonly", () => ({
  readonlyPool: { query: vi.fn() },
}));

import { POST } from "../route";
import { EMIT_LIST_SPEC_TOOL_NAME } from "@/features/views/lib/ai-list-builder/tools";

function makeRequest(body: unknown) {
  return new NextRequest(
    new URL("/api/lists/ai-build", "http://localhost:3000"),
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    } as never,
  );
}

async function readAllSse(res: Response): Promise<string[]> {
  const events: string[] = [];
  const reader = res.body?.getReader();
  if (!reader) return events;
  const decoder = new TextDecoder();
  let buf = "";
  // Read until EOF — the route closes the controller after final event.
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
  }
  buf += decoder.decode();
  // SSE events separated by double-newline. We pass full event blocks back.
  return buf.split("\n\n").filter((s) => s.trim().length > 0);
}

function parseSseEvent(block: string): { event: string | null; data: any | null } {
  let event: string | null = null;
  let data: string | null = null;
  for (const line of block.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7);
    else if (line.startsWith("data: ")) data = line.slice(6);
  }
  return { event, data: data ? JSON.parse(data) : null };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/lists/ai-build", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ prompt: "NY districts" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when prompt is missing", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    const req = new NextRequest(
      new URL("/api/lists/ai-build", "http://localhost:3000"),
      {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      } as never,
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("streams a result event when the model emits a valid list spec", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    // The model calls emit_list_spec on its first iteration.
    anthropicMessagesCreate.mockResolvedValueOnce({
      stop_reason: "tool_use",
      usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      content: [
        { type: "text", text: "Building your list." },
        {
          type: "tool_use",
          id: "t1",
          name: EMIT_LIST_SPEC_TOOL_NAME,
          input: {
            source: "districts",
            filterTree: {
              kind: "and",
              children: [
                { kind: "rule", fieldId: "state", op: "is", value: "NY" },
              ],
            },
            scope: { mode: "none" },
            name: "NY districts",
          },
        },
      ],
    });

    const res = await POST(makeRequest({ prompt: "NY districts" }));
    expect(res.headers.get("content-type")).toBe("text/event-stream");

    const events = await readAllSse(res);
    const parsed = events.map(parseSseEvent);
    const resultEvent = parsed.find((p) => p.event === "result");
    expect(resultEvent).toBeDefined();
    expect(resultEvent?.data?.kind).toBe("ok");
    expect(resultEvent?.data?.listSpec?.source).toBe("districts");
    expect(resultEvent?.data?.name).toBe("NY districts");
    expect(resultEvent?.data?.listSpec?.schemaVersion).toBe(1);
  });

  it("streams a clarifying result when the model asks a question instead of emitting", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    anthropicMessagesCreate.mockResolvedValueOnce({
      stop_reason: "end_turn",
      usage: { input_tokens: 50, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      content: [
        {
          type: "text",
          text: "Did you mean NY-state districts or NYC public schools specifically?",
        },
      ],
    });

    const res = await POST(makeRequest({ prompt: "ny districts" }));
    const events = await readAllSse(res);
    const parsed = events.map(parseSseEvent);
    const resultEvent = parsed.find((p) => p.event === "result");
    expect(resultEvent?.data?.kind).toBe("clarifying");
    expect(resultEvent?.data?.text).toMatch(/NY/);
  });

  it("retries when emit_list_spec input fails validation (bad source)", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    // First call: invalid source. Second call: valid.
    anthropicMessagesCreate
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: EMIT_LIST_SPEC_TOOL_NAME,
            input: {
              source: "schools",
              filterTree: { kind: "and", children: [] },
              scope: { mode: "none" },
              name: "Bad list",
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t2",
            name: EMIT_LIST_SPEC_TOOL_NAME,
            input: {
              source: "districts",
              filterTree: { kind: "and", children: [] },
              scope: { mode: "none" },
              name: "All districts",
            },
          },
        ],
      });

    const res = await POST(makeRequest({ prompt: "everything" }));
    const events = await readAllSse(res);
    const parsed = events.map(parseSseEvent);
    const resultEvent = parsed.find((p) => p.event === "result");
    expect(resultEvent?.data?.kind).toBe("ok");
    expect(resultEvent?.data?.listSpec?.source).toBe("districts");
    expect(anthropicMessagesCreate).toHaveBeenCalledTimes(2);
  });
});
