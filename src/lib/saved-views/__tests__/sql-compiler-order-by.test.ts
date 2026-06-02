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

  // Grouping by churn risk prepends `churn_risk:asc`. The "No value" group must
  // sort LAST (matching the grid's null-bucket-last convention) so the first
  // page surfaces the real Low/Medium/High/Churned groups instead of being
  // swamped by districts that have no churn risk set. Achieved by mapping only
  // the four known values in the CASE (unmatched → NULL) and keeping NULLS LAST
  // — i.e. NO `ELSE 0`, which would float the empty group to the top.
  it("sorts churn_risk 'No value' last (no ELSE 0, relies on NULLS LAST)", () => {
    const sql = buildOrderBy(
      [{ id: "churn_risk", dir: "asc" }],
      "districts",
      { planId: "1" },
    );
    const norm = sql.replace(/\s+/g, " ").trim();
    expect(norm).toContain(
      "CASE __churn_cte.churn_risk WHEN 'churned' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 END",
    );
    expect(norm).not.toContain("ELSE 0");
    expect(norm).toContain("ASC NULLS LAST");
  });
});
