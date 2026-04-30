import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db-readonly", () => ({
  readonlyPool: {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("BOOM")) throw new Error("parse error");
      return {
        fields: [{ name: "name" }, { name: "state" }],
        rows: [
          { name: "Houston ISD", state: "TX" },
          { name: "LAUSD", state: "CA" },
        ],
      };
    }),
  },
}));

import { handleSampleRows } from "../sample-rows";

describe("handleSampleRows", () => {
  it("rejects SQL without a LIMIT clause", async () => {
    const res = await handleSampleRows("SELECT * FROM districts");
    expect(res.toLowerCase()).toContain("limit");
  });

  it("rejects LIMIT > 20", async () => {
    const res = await handleSampleRows("SELECT * FROM districts LIMIT 50");
    expect(res.toLowerCase()).toMatch(/limit.*20/);
  });

  it("rejects non-SELECT statements", async () => {
    const res = await handleSampleRows("UPDATE districts SET name = 'x' LIMIT 5");
    expect(res.toLowerCase()).toMatch(/select/);
  });

  it("returns rows for valid SELECT with LIMIT", async () => {
    const res = await handleSampleRows("SELECT name, state FROM districts LIMIT 5");
    expect(res).toContain("Houston ISD");
    expect(res).toContain("LAUSD");
  });

  it("surfaces SQL errors", async () => {
    const res = await handleSampleRows("SELECT BOOM FROM districts LIMIT 5");
    expect(res.toLowerCase()).toContain("error");
  });
});
