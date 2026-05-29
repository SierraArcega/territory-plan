import { describe, it, expect } from "vitest";
import { buildOrderBy } from "../sql-compiler";

describe("buildOrderBy", () => {
  it("returns empty string for empty sort", () => {
    expect(buildOrderBy([], "districts")).toBe("");
  });

  it("compiles a single asc sort to ORDER BY with NULLS LAST and leaid tie-breaker", () => {
    const sql = buildOrderBy([{ id: "enrollment", dir: "asc" }], "districts");
    expect(sql).toBe(`ORDER BY t."enrollment" ASC NULLS LAST, t."leaid" ASC`);
  });

  it("compiles desc with NULLS LAST and leaid tie-breaker", () => {
    const sql = buildOrderBy([{ id: "enrollment", dir: "desc" }], "districts");
    expect(sql).toBe(`ORDER BY t."enrollment" DESC NULLS LAST, t."leaid" ASC`);
  });

  it("compiles multi-sort in order with leaid tie-breaker", () => {
    const sql = buildOrderBy(
      [{ id: "state", dir: "asc" }, { id: "enrollment", dir: "desc" }],
      "districts",
    );
    expect(sql).toBe(
      `ORDER BY t."state_abbrev" ASC NULLS LAST, t."enrollment" DESC NULLS LAST, t."leaid" ASC`,
    );
  });

  it("does not duplicate leaid tie-breaker when multi-sort already covers multiple columns", () => {
    // Even with multiple user sorts, the single leaid tie-breaker is appended once
    const sql = buildOrderBy(
      [{ id: "state", dir: "asc" }, { id: "enrollment", dir: "asc" }],
      "districts",
    );
    const leaidMatches = (sql.match(/"leaid"/g) ?? []).length;
    expect(leaidMatches).toBe(1);
  });

  it("throws on unknown field", () => {
    expect(() => buildOrderBy([{ id: "ghost", dir: "asc" }], "districts")).toThrow(/ghost/);
  });
});
