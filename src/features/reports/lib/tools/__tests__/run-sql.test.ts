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

const validSummary: QuerySummary = {
  source: "Districts",
  filters: [{ id: "f1", label: "State", value: "Texas" }],
  columns: [
    { id: "c1", label: "name" },
    { id: "c2", label: "bookings" },
  ],
  sort: null,
  limit: 100,
};

describe("handleRunSql", () => {
  it("returns rows on success", async () => {
    const res = await handleRunSql(
      "SELECT name, bookings FROM districts WHERE state = 'Texas' LIMIT 100",
      validSummary,
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
      validSummary,
    );
    expect(res.kind).toBe("error");
  });

  it("fails validation when summary doesn't match SQL", async () => {
    const res = await handleRunSql(
      "SELECT name, bookings FROM districts WHERE state = 'Ohio' LIMIT 100",
      validSummary,
    );
    expect(res.kind).toBe("validation_error");
  });

  it("rejects non-SELECT statements", async () => {
    const res = await handleRunSql(
      "UPDATE districts SET name = 'x' WHERE state = 'Texas'",
      { ...validSummary, columns: [] },
    );
    expect(res.kind).toBe("validation_error");
  });
});
