import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db-readonly", () => ({
  readonlyPool: {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("BOOM")) throw new Error("syntax error near BOOM");
      return { rows: [{ c: "42" }] };
    }),
  },
}));

import { handleCountRows } from "../count-rows";

describe("handleCountRows", () => {
  it("returns the count number", async () => {
    const res = await handleCountRows("districts d", "d.state = 'TX'");
    expect(res).toContain("42");
  });

  it("works without a where clause", async () => {
    const res = await handleCountRows("districts d");
    expect(res).toContain("42");
  });

  it("returns a helpful error when SQL fails", async () => {
    const res = await handleCountRows("BOOM", undefined);
    expect(res.toLowerCase()).toContain("error");
  });

  it("rejects DML/DDL in from_sql", async () => {
    const res = await handleCountRows("districts; DROP TABLE x;", undefined);
    expect(res.toLowerCase()).toMatch(/invalid|reject/);
  });
});
