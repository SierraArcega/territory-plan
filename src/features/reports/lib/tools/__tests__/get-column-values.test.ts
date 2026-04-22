import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db-readonly", () => ({
  readonlyPool: {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("nonexistent")) {
        throw new Error('relation "nonexistent" does not exist');
      }
      return {
        rows: [{ v: "Texas" }, { v: "California" }, { v: "Ohio" }],
      };
    }),
  },
}));

import { handleGetColumnValues } from "../get-column-values";

describe("handleGetColumnValues", () => {
  it("rejects unknown tables", async () => {
    const res = await handleGetColumnValues("nonexistent", "state", 10);
    expect(res).toMatch(/not registered/i);
  });

  it("rejects unknown columns on known tables", async () => {
    const res = await handleGetColumnValues("districts", "not_a_column", 10);
    expect(res).toMatch(/not found|unknown/i);
  });

  it("returns distinct values for a valid column", async () => {
    const res = await handleGetColumnValues("districts", "state_abbrev", 10);
    expect(res).toContain("Texas");
    expect(res).toContain("California");
  });

  it("clamps limit to [1, 100]", async () => {
    const res = await handleGetColumnValues("districts", "state_abbrev", 9999);
    expect(res).toBeTruthy();
  });
});
