import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();
vi.mock("@/lib/db-readonly", () => ({
  readonlyPool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    queryLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

import { executeQuery } from "../execute-query";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executeQuery", () => {
  it("returns invalid_params when params reference an excluded table", async () => {
    const outcome = await executeQuery({
      params: { table: "query_log" },
      userId: "u1",
    });
    expect(outcome.kind).toBe("invalid_params");
  });

  it("returns ok with columns/rows on a successful query", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ leaid: "0600001" }],
      fields: [{ name: "leaid" }],
    });
    const outcome = await executeQuery({
      params: { table: "districts", columns: ["leaid"], limit: 10 },
      userId: "u1",
    });
    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.result.columns).toEqual(["leaid"]);
      expect(outcome.result.rowCount).toBe(1);
      expect(outcome.result.truncated).toBe(false);
    }
  });

  it("maps statement timeout to 408", async () => {
    mockQuery.mockRejectedValue(new Error("canceling statement due to statement timeout"));
    const outcome = await executeQuery({
      params: { table: "districts" },
      userId: "u1",
    });
    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.status).toBe(408);
    }
  });

  it("maps generic DB error to 500", async () => {
    mockQuery.mockRejectedValue(new Error("connection refused"));
    const outcome = await executeQuery({
      params: { table: "districts" },
      userId: "u1",
    });
    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.status).toBe(500);
    }
  });
});
