import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db-readonly", () => ({
  readonlyPool: {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("BOOM")) throw new Error('column "BOOM" does not exist');
      return {
        fields: [{ name: "name" }, { name: "bookings" }],
        rows: [
          { name: "A", bookings: 100 },
          { name: "B", bookings: 200 },
        ],
      };
    }),
  },
}));

import { handleRunSql } from "../run-sql";
import type { QuerySummary } from "../../agent/types";

const summary: QuerySummary = { source: "Texas districts with FY26 bookings" };

describe("handleRunSql", () => {
  it("returns rows on success", async () => {
    const res = await handleRunSql(
      "SELECT name, bookings FROM districts WHERE state = 'Texas' LIMIT 100",
      summary,
    );
    expect(res.kind).toBe("ok");
    if (res.kind === "ok") {
      expect(res.rows.length).toBe(2);
      expect(res.columns).toEqual(["name", "bookings"]);
    }
  });

  it("surfaces pg errors as 'error' result", async () => {
    const res = await handleRunSql(
      "SELECT BOOM, other FROM districts WHERE state = 'Texas' LIMIT 100",
      summary,
    );
    expect(res.kind).toBe("error");
  });

  it("rejects SQL without LIMIT", async () => {
    const res = await handleRunSql(
      "SELECT name FROM districts WHERE state = 'Texas'",
      summary,
    );
    expect(res.kind).toBe("validation_error");
    if (res.kind === "validation_error") {
      expect(res.errors[0]).toMatch(/LIMIT/);
    }
  });

  it("rejects SQL with LIMIT > MAX_LIMIT (500)", async () => {
    const res = await handleRunSql(
      "SELECT name FROM districts WHERE state = 'Texas' LIMIT 1000",
      summary,
    );
    expect(res.kind).toBe("validation_error");
    if (res.kind === "validation_error") {
      expect(res.errors[0]).toMatch(/exceeds MAX_LIMIT/);
    }
  });

  it("rejects empty summary.source when no fallback is provided", async () => {
    const res = await handleRunSql(
      "SELECT name FROM districts WHERE state = 'Texas' LIMIT 100",
      { source: "" },
    );
    expect(res.kind).toBe("validation_error");
    if (res.kind === "validation_error") {
      expect(res.errors[0]).toMatch(/summary\.source/);
    }
  });

  it("auto-fills empty summary.source from the fallback (user question)", async () => {
    const res = await handleRunSql(
      "SELECT name FROM districts WHERE state = 'Texas' LIMIT 100",
      { source: "" },
      "show me Texas districts",
    );
    expect(res.kind).toBe("ok");
    if (res.kind === "ok") {
      expect(res.summary.source).toBe("show me Texas districts");
    }
  });

  it("auto-fills missing summary entirely from the fallback", async () => {
    const res = await handleRunSql(
      "SELECT name FROM districts WHERE state = 'Texas' LIMIT 100",
      undefined as unknown as QuerySummary,
      "show me Texas districts",
    );
    expect(res.kind).toBe("ok");
    if (res.kind === "ok") {
      expect(res.summary.source).toBe("show me Texas districts");
    }
  });

  it("trims and truncates very long fallback sources to 200 chars", async () => {
    const long = "a".repeat(500);
    const res = await handleRunSql(
      "SELECT name FROM districts WHERE state = 'Texas' LIMIT 100",
      { source: "" },
      `   ${long}   `,
    );
    expect(res.kind).toBe("ok");
    if (res.kind === "ok") {
      expect(res.summary.source.length).toBe(200);
    }
  });

  it("rejects non-SELECT statements", async () => {
    const res = await handleRunSql(
      "UPDATE districts SET name = 'x' WHERE state = 'Texas'",
      summary,
    );
    expect(res.kind).toBe("validation_error");
  });

  it("rejects SQL with semicolons", async () => {
    const res = await handleRunSql(
      "SELECT name FROM districts LIMIT 100; DROP TABLE districts",
      summary,
    );
    expect(res.kind).toBe("validation_error");
  });
});
