import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  callClaude,
  findToolUse,
  AnthropicError,
  HAIKU_MODEL,
  SONNET_MODEL,
  type ClaudeContentBlock,
} from "../anthropic";

const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

const ORIG_ENV = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
});

function okJson(content: ClaudeContentBlock[]): Response {
  return new Response(JSON.stringify({ content, stop_reason: "end_turn" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("callClaude", () => {
  it("sends correct headers and body shape", async () => {
    mockFetch.mockResolvedValueOnce(okJson([{ type: "text", text: "ok" }]));

    await callClaude({
      model: HAIKU_MODEL,
      systemPrompt: "sys",
      userMessage: "hello",
      maxTokens: 100,
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(HAIKU_MODEL);
    expect(body.system).toBe("sys");
    expect(body.max_tokens).toBe(100);
    expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
  });

  it("includes tools and tool_choice when provided", async () => {
    mockFetch.mockResolvedValueOnce(okJson([{ type: "text", text: "ok" }]));

    await callClaude({
      model: SONNET_MODEL,
      userMessage: "do a thing",
      tools: [
        {
          name: "t",
          description: "d",
          input_schema: { type: "object", properties: {} },
        },
      ],
      toolChoice: { type: "tool", name: "t" },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.tools).toHaveLength(1);
    expect(body.tool_choice).toEqual({ type: "tool", name: "t" });
  });

  it("returns the content blocks on success", async () => {
    const content: ClaudeContentBlock[] = [
      { type: "text", text: "hi" },
      { type: "tool_use", id: "abc", name: "ret", input: { k: 1 } },
    ];
    mockFetch.mockResolvedValueOnce(okJson(content));

    const result = await callClaude({
      model: HAIKU_MODEL,
      userMessage: "hi",
    });
    expect(result).toEqual(content);
  });

  it("throws AnthropicError with status on 4xx/5xx", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("bad key", { status: 401, statusText: "Unauthorized" })
    );

    await expect(
      callClaude({ model: HAIKU_MODEL, userMessage: "x" })
    ).rejects.toMatchObject({
      name: "AnthropicError",
      status: 401,
    });
  });

  it("throws when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      callClaude({ model: HAIKU_MODEL, userMessage: "x" })
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);
    if (ORIG_ENV !== undefined) process.env.ANTHROPIC_API_KEY = ORIG_ENV;
  });
});

describe("findToolUse", () => {
  it("returns the matching tool_use block", () => {
    const content: ClaudeContentBlock[] = [
      { type: "text", text: "..." },
      { type: "tool_use", id: "1", name: "other", input: {} },
      { type: "tool_use", id: "2", name: "target", input: { x: 1 } },
    ];
    expect(findToolUse(content, "target")?.id).toBe("2");
  });

  it("returns undefined when no match", () => {
    expect(findToolUse([], "none")).toBeUndefined();
  });
});

describe("AnthropicError", () => {
  it("carries status and body", () => {
    const e = new AnthropicError("fail", 500, "oops");
    expect(e.status).toBe(500);
    expect(e.body).toBe("oops");
    expect(e.name).toBe("AnthropicError");
  });
});
