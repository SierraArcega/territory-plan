import { describe, it, expect } from "vitest";
import { buildOrderBy } from "../sql-compiler";

describe("buildOrderBy", () => {
  it("returns empty string for empty sort", () => {
    expect(buildOrderBy([], "districts")).toBe("");
  });

  it("compiles a single asc sort to ORDER BY with NULLS LAST", () => {
    const sql = buildOrderBy([{ id: "enrollment", dir: "asc" }], "districts");
    expect(sql).toBe(`ORDER BY "enrollment" ASC NULLS LAST`);
  });

  it("compiles desc with NULLS LAST", () => {
    const sql = buildOrderBy([{ id: "enrollment", dir: "desc" }], "districts");
    expect(sql).toBe(`ORDER BY "enrollment" DESC NULLS LAST`);
  });

  it("compiles multi-sort in order", () => {
    const sql = buildOrderBy(
      [{ id: "state", dir: "asc" }, { id: "enrollment", dir: "desc" }],
      "districts",
    );
    expect(sql).toBe(`ORDER BY "state_abbrev" ASC NULLS LAST, "enrollment" DESC NULLS LAST`);
  });

  it("throws on unknown field", () => {
    expect(() => buildOrderBy([{ id: "ghost", dir: "asc" }], "districts")).toThrow(/ghost/);
  });
});
