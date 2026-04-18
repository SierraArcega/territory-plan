import { describe, expect, it } from "vitest";
import { compileParams } from "../params-to-sql";
import { validateParams } from "../params-validator";

function compile(params: Parameters<typeof compileParams>[0]) {
  const v = validateParams(params);
  if (!v.valid) throw new Error(`params invalid: ${v.errors.join(", ")}`);
  return compileParams(v.normalized);
}

describe("compileParams", () => {
  it("produces a SELECT with default columns when none specified", () => {
    const { sql, values } = compile({ table: "districts" });
    expect(sql).toMatch(/^SELECT/);
    expect(sql).toMatch(/FROM "districts"/);
    expect(sql).toMatch(/LIMIT 100/);
    expect(values).toEqual([]);
  });

  it("quotes identifiers", () => {
    const { sql } = compile({
      table: "districts",
      columns: ["leaid", "name"],
    });
    expect(sql).toMatch(/"leaid"/);
    expect(sql).toMatch(/"name"/);
    expect(sql).toMatch(/"districts"/);
  });

  it("parameterizes filter values", () => {
    const { sql, values } = compile({
      table: "districts",
      columns: ["leaid"],
      filters: [{ column: "state_abbrev", op: "eq", value: "CA" }],
    });
    expect(sql).toMatch(/WHERE "state_abbrev" = \$1/);
    expect(values).toEqual(["CA"]);
  });

  it("supports IN via ANY(array) parameterization", () => {
    const { sql, values } = compile({
      table: "districts",
      columns: ["leaid"],
      filters: [{ column: "state_abbrev", op: "in", value: ["CA", "OR"] }],
    });
    expect(sql).toMatch(/WHERE "state_abbrev" = ANY\(\$1\)/);
    expect(values).toEqual([["CA", "OR"]]);
  });

  it("compiles COUNT(*) with alias", () => {
    const { sql } = compile({
      table: "districts",
      aggregations: [{ column: "*", fn: "count", alias: "total" }],
    });
    expect(sql).toMatch(/COUNT\(\*\) AS "total"/);
  });

  it("compiles aggregation with group by", () => {
    const { sql } = compile({
      table: "district_opportunity_actuals",
      columns: ["sales_rep_email"],
      aggregations: [{ column: "bookings", fn: "sum" }],
      groupBy: ["sales_rep_email"],
      orderBy: [{ column: "sum_bookings", direction: "desc" }],
      limit: 10,
    });
    expect(sql).toMatch(/SUM\("bookings"\) AS "sum_bookings"/);
    expect(sql).toMatch(/GROUP BY "sales_rep_email"/);
    expect(sql).toMatch(/ORDER BY "sum_bookings" DESC/);
    expect(sql).toMatch(/LIMIT 10/);
  });

  it("qualifies columns when joins are present", () => {
    const { sql } = compile({
      table: "districts",
      columns: ["districts.leaid", "opportunities.id"],
      joins: [{ toTable: "opportunities" }],
    });
    expect(sql).toMatch(/"districts"\."leaid"/);
    expect(sql).toMatch(/"opportunities"\."id"/);
    expect(sql).toMatch(/LEFT JOIN "opportunities" ON/);
  });

  it("handles isNull / isNotNull without binding", () => {
    const { sql, values } = compile({
      table: "districts",
      columns: ["leaid"],
      filters: [
        { column: "owner_id", op: "isNull" },
        { column: "enrollment", op: "isNotNull" },
      ],
    });
    expect(sql).toMatch(/"owner_id" IS NULL/);
    expect(sql).toMatch(/"enrollment" IS NOT NULL/);
    expect(values).toEqual([]);
  });

  it("chains multiple filters with AND", () => {
    const { sql } = compile({
      table: "district_opportunity_actuals",
      columns: ["district_lea_id"],
      filters: [
        { column: "school_yr", op: "eq", value: "2025-26" },
        { column: "bookings", op: "gt", value: 100000 },
      ],
    });
    expect(sql).toMatch(/WHERE "school_yr" = \$1 AND "bookings" > \$2/);
  });

  it("compiles aliased self-joins via joinStatements", () => {
    const { sql } = compile({
      table: "district_financials",
      columns: [
        "district_financials.leaid",
        "df_same_district_fy.vendor",
      ],
      joins: [{ toTable: "df_same_district_fy" }],
    });
    expect(sql).toMatch(/"district_financials"\."leaid"/);
    expect(sql).toMatch(/"df_same_district_fy"\."vendor"/);
    expect(sql).toMatch(
      /LEFT JOIN district_financials AS df_same_district_fy ON/,
    );
  });

  it("compiles multi-hop joinStatements in order", () => {
    const { sql } = compile({
      table: "user_goals",
      columns: ["user_goals.fiscal_year"],
      joins: [{ toTable: "district_opportunity_actuals" }],
    });
    const joinIdx = sql.indexOf("LEFT JOIN user_profiles");
    const doaIdx = sql.indexOf("LEFT JOIN district_opportunity_actuals");
    expect(joinIdx).toBeGreaterThan(-1);
    expect(doaIdx).toBeGreaterThan(joinIdx);
  });
});
