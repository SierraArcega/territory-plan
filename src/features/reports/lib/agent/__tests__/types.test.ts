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

  it("QuerySummary requires source and accepts optional chip-strip fields", () => {
    const minimal: QuerySummary = { source: "Texas districts" };
    expectTypeOf(minimal).toMatchTypeOf<QuerySummary>();

    const full: QuerySummary = {
      source: "Texas open opps stuck > 90 days",
      filters: ["State: Texas", "Days in stage > 90"],
      columns: ["District", "Stage", "Days in stage", "Amount"],
      sort: "Close date ↓",
      versionLabel: "narrowed to Texas",
    };
    expectTypeOf(full).toMatchTypeOf<QuerySummary>();

    const partial: QuerySummary = {
      source: "Pipeline by stage",
      columns: ["Stage", "Count", "Total amount"],
    };
    expectTypeOf(partial).toMatchTypeOf<QuerySummary>();
  });

  it("ChatRequest accepts message + optional conversationId", () => {
    const r: ChatRequest = { message: "hi" };
    const r2: ChatRequest = { message: "hi", conversationId: "c1" };
    expectTypeOf(r).toMatchTypeOf<ChatRequest>();
    expectTypeOf(r2).toMatchTypeOf<ChatRequest>();
  });
});
