import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: { queryLog: { create: vi.fn().mockResolvedValue({}) } },
}));

vi.mock("@/features/reports/lib/claude-client", () => ({
  getAnthropic: () => ({
    messages: { create: (...args: unknown[]) => mockCreate(...args) },
  }),
}));

import { POST as suggest } from "../suggest/route";

const USER = { id: "00000000-0000-0000-0000-000000000001", email: "u@x" };

function req(body: unknown) {
  return new NextRequest(new URL("/api/ai/query/suggest", "http://localhost"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue(USER);
});

describe("POST /api/ai/query/suggest", () => {
  it("401 without user", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await suggest(req({ question: "x" }));
    expect(res.status).toBe(401);
  });

  it("returns kind=params when Claude calls run_query", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "run_query",
          id: "tu_1",
          input: {
            table: "districts",
            columns: ["leaid"],
            explanation: "All districts.",
          },
        },
      ],
    });
    const res = await suggest(req({ question: "list districts" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("params");
    expect(body.params.table).toBe("districts");
    expect(body.explanation).toBe("All districts.");
  });

  it("returns kind=clarify when Claude only emits text", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Which fiscal year did you mean?" }],
    });
    const res = await suggest(req({ question: "show me the numbers" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("clarify");
    expect(body.question).toBe("Which fiscal year did you mean?");
  });

  it("appends <CURRENT_BUILDER> block to the last user message when currentParams given", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "run_query",
          id: "tu_2",
          input: { table: "districts", explanation: "ok" },
        },
      ],
    });
    await suggest(
      req({
        question: "add name",
        currentParams: { table: "districts", columns: ["leaid"] },
      }),
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    const lastMsg = callArgs.messages[callArgs.messages.length - 1];
    expect(lastMsg.role).toBe("user");
    expect(lastMsg.content).toContain("<CURRENT_BUILDER>");
    expect(lastMsg.content).toContain('"table": "districts"');
    expect(lastMsg.content).toContain('"leaid"');
  });

  it("omits <CURRENT_BUILDER> when currentParams is absent", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "run_query",
          id: "tu_3",
          input: { table: "districts", explanation: "ok" },
        },
      ],
    });
    await suggest(req({ question: "list districts" }));
    const callArgs = mockCreate.mock.calls[0][0];
    const lastMsg = callArgs.messages[callArgs.messages.length - 1];
    expect(lastMsg.content).not.toContain("<CURRENT_BUILDER>");
  });

  it("forwards chatHistory as prior messages in order", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "run_query",
          id: "tu_4",
          input: { table: "districts", explanation: "ok" },
        },
      ],
    });
    await suggest(
      req({
        question: "add name",
        chatHistory: [
          { role: "user", content: "list districts" },
          { role: "assistant", content: "Here are the districts." },
        ],
      }),
    );
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(3);
    expect(callArgs.messages[0]).toEqual({ role: "user", content: "list districts" });
    expect(callArgs.messages[1]).toEqual({
      role: "assistant",
      content: "Here are the districts.",
    });
    expect(callArgs.messages[2].role).toBe("user");
    expect(callArgs.messages[2].content).toContain("add name");
  });

  it("uses tool_choice auto (not forced)", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Clarify?" }],
    });
    await suggest(req({ question: "x" }));
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.tool_choice).toEqual({ type: "auto" });
  });

  it("422 when Claude params fail validation", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "run_query",
          id: "tu_5",
          input: { table: "NOT_REGISTERED", explanation: "bad" },
        },
      ],
    });
    const res = await suggest(req({ question: "x" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/invalid params/i);
  });
});
