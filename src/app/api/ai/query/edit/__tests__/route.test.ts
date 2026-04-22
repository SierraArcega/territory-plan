// src/app/api/ai/query/edit/__tests__/route.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn(async () => ({ id: "user-1" })),
}));
vi.mock("@/features/reports/lib/claude-client", () => ({
  getAnthropic: vi.fn(() => ({})),
}));
vi.mock("@/features/reports/lib/agent/conversation", () => ({
  loadPriorTurns: vi.fn(async () => [{ question: "base", sql: "SELECT 1", summary: null, createdAt: new Date() }]),
  saveTurn: vi.fn(async () => 1),
}));
vi.mock("@/features/reports/lib/agent/agent-loop", () => ({
  runAgentLoop: vi.fn(async () => ({
    kind: "result",
    sql: "SELECT 1 LIMIT 100",
    summary: { source: "s", filters: [], columns: [{ id: "c", label: "a" }], sort: null, limit: 100 },
    columns: ["a"],
    rows: [],
    rowCount: 0,
    executionTimeMs: 1,
    assistantText: "",
  })),
}));

import { POST } from "../route";
import { NextRequest } from "next/server";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/ai/query/edit", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/ai/query/edit", () => {
  it("requires a conversationId", async () => {
    const res = await POST(req({ action: { type: "remove_sort" } }));
    expect(res.status).toBe(400);
  });

  it("translates remove_filter and calls agent loop", async () => {
    const res = await POST(
      req({
        conversationId: "c1",
        action: { type: "remove_filter", chipId: "f1", label: "State: Texas" },
      }),
    );
    expect(res.status).toBe(200);
  });
});
