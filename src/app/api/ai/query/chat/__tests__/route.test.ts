// src/app/api/ai/query/chat/__tests__/route.test.ts
import { describe, it, expect, vi } from "vitest";

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
  runAgentLoop: vi.fn(async () => ({
    kind: "result",
    sql: "SELECT 1 LIMIT 100",
    summary: { source: "x", filters: [], columns: [{ id: "c1", label: "a" }], sort: null, limit: 100 },
    columns: ["a"],
    rows: [{ a: 1 }],
    rowCount: 1,
    executionTimeMs: 5,
    assistantText: "",
  })),
}));

import { POST } from "../route";
import { NextRequest } from "next/server";

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/query/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/ai/query/chat", () => {
  it("rejects missing message", async () => {
    const res = await POST(req({ message: "" }));
    expect(res.status).toBe(400);
  });

  it("returns conversationId + result on success", async () => {
    const res = await POST(req({ message: "show me districts" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.conversationId).toBeTruthy();
    expect(json.result.rows).toBeDefined();
  });
});
