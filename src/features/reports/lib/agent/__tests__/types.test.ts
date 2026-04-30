import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  ChipEditAction,
  ChatMessage,
  QuerySummary,
} from "../types";
import { MAX_LIMIT, MAX_SQL_RETRIES } from "../types";

describe("agent types", () => {
  it("MAX_LIMIT matches spec cap (500)", () => {
    expect(MAX_LIMIT).toBe(500);
  });

  it("MAX_SQL_RETRIES is 2 per D5", () => {
    expect(MAX_SQL_RETRIES).toBe(2);
  });

  it("ChipEditAction is a discriminated union", () => {
    const a: ChipEditAction = { type: "remove_filter", chipId: "f1", label: "State" };
    expectTypeOf(a).toMatchTypeOf<ChipEditAction>();
  });

  it("ChatMessage includes result variant with rows", () => {
    const m: ChatMessage = {
      role: "result",
      turnId: "t1",
      sql: "",
      summary: {
        source: "",
        filters: [],
        columns: [],
        sort: null,
        limit: 100,
      },
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
    };
    expectTypeOf(m).toMatchTypeOf<ChatMessage>();
  });
});
