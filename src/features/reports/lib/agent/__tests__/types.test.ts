import { describe, it, expect, expectTypeOf } from "vitest";
import type { ChatRequest, QuerySummary } from "../types";
import { MAX_LIMIT, MAX_SQL_RETRIES, DEFAULT_LIMIT } from "../types";

describe("agent types", () => {
  it("MAX_LIMIT matches spec cap (500)", () => {
    expect(MAX_LIMIT).toBe(500);
  });

  it("DEFAULT_LIMIT is 100", () => {
    expect(DEFAULT_LIMIT).toBe(100);
  });

  it("MAX_SQL_RETRIES is 2 per D5", () => {
    expect(MAX_SQL_RETRIES).toBe(2);
  });

  it("QuerySummary has just a source field", () => {
    const s: QuerySummary = { source: "Texas districts" };
    expectTypeOf(s).toMatchTypeOf<QuerySummary>();
  });

  it("ChatRequest accepts message + optional conversationId", () => {
    const r: ChatRequest = { message: "hi" };
    const r2: ChatRequest = { message: "hi", conversationId: "c1" };
    expectTypeOf(r).toMatchTypeOf<ChatRequest>();
    expectTypeOf(r2).toMatchTypeOf<ChatRequest>();
  });
});
