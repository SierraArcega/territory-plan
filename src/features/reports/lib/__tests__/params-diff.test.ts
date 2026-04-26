import { describe, expect, it } from "vitest";
import { diffParams, type ReceiptAction } from "../params-diff";
import type { QueryParams } from "../types";

const base: QueryParams = { table: "districts", limit: 100 };

describe("diffParams", () => {
  it("returns empty array for identical params", () => {
    expect(diffParams(base, base)).toEqual([]);
  });

  it("null prev → add action for table", () => {
    const actions = diffParams(null, base);
    expect(actions).toContainEqual<ReceiptAction>({
      kind: "add",
      field: "table",
      label: "districts",
    });
  });

  it("table change → mod action", () => {
    const next: QueryParams = { ...base, table: "opportunities" };
    const actions = diffParams(base, next);
    expect(actions).toContainEqual<ReceiptAction>({
      kind: "mod",
      field: "table",
      label: "opportunities",
      detail: "districts → opportunities",
    });
  });

  it("added column → add action", () => {
    const prev: QueryParams = { ...base, columns: ["leaid"] };
    const next: QueryParams = { ...base, columns: ["leaid", "name"] };
    expect(diffParams(prev, next)).toEqual<ReceiptAction[]>([
      { kind: "add", field: "column", label: "name" },
    ]);
  });

  it("removed column → rem action", () => {
    const prev: QueryParams = { ...base, columns: ["leaid", "name"] };
    const next: QueryParams = { ...base, columns: ["leaid"] };
    expect(diffParams(prev, next)).toEqual<ReceiptAction[]>([
      { kind: "rem", field: "column", label: "name" },
    ]);
  });

  it("reordered columns → no actions", () => {
    const prev: QueryParams = { ...base, columns: ["a", "b"] };
    const next: QueryParams = { ...base, columns: ["b", "a"] };
    expect(diffParams(prev, next)).toEqual([]);
  });

  it("added join → add action", () => {
    const next: QueryParams = { ...base, joins: [{ toTable: "vacancies" }] };
    expect(diffParams(base, next)).toEqual<ReceiptAction[]>([
      { kind: "add", field: "join", label: "vacancies" },
    ]);
  });

  it("filter added → add action with column = value label", () => {
    const next: QueryParams = {
      ...base,
      filters: [{ column: "status", op: "eq", value: "open" }],
    };
    expect(diffParams(base, next)).toEqual<ReceiptAction[]>([
      { kind: "add", field: "filter", label: "status = open" },
    ]);
  });

  it("filter value change on same column+op → mod action", () => {
    const prev: QueryParams = {
      ...base,
      filters: [{ column: "status", op: "eq", value: "open" }],
    };
    const next: QueryParams = {
      ...base,
      filters: [{ column: "status", op: "eq", value: "closed" }],
    };
    expect(diffParams(prev, next)).toEqual<ReceiptAction[]>([
      {
        kind: "mod",
        field: "filter",
        label: "status = closed",
        detail: "open → closed",
      },
    ]);
  });

  it("filter op change on same column → rem + add, not mod", () => {
    const prev: QueryParams = {
      ...base,
      filters: [{ column: "status", op: "eq", value: "open" }],
    };
    const next: QueryParams = {
      ...base,
      filters: [{ column: "status", op: "neq", value: "open" }],
    };
    const actions = diffParams(prev, next);
    expect(actions).toContainEqual({
      kind: "rem",
      field: "filter",
      label: "status = open",
    });
    expect(actions).toContainEqual({
      kind: "add",
      field: "filter",
      label: "status != open",
    });
  });

  it("aggregation added → add action keyed by alias", () => {
    const next: QueryParams = {
      ...base,
      aggregations: [{ column: "id", fn: "count", alias: "opp_count" }],
    };
    expect(diffParams(base, next)).toEqual<ReceiptAction[]>([
      { kind: "add", field: "aggregation", label: "opp_count" },
    ]);
  });

  it("aggregation fn change → mod action", () => {
    const prev: QueryParams = {
      ...base,
      aggregations: [{ column: "amount", fn: "sum", alias: "total" }],
    };
    const next: QueryParams = {
      ...base,
      aggregations: [{ column: "amount", fn: "avg", alias: "total" }],
    };
    expect(diffParams(prev, next)).toEqual<ReceiptAction[]>([
      {
        kind: "mod",
        field: "aggregation",
        label: "total",
        detail: "sum(amount) → avg(amount)",
      },
    ]);
  });

  it("groupBy add/remove", () => {
    const prev: QueryParams = { ...base, groupBy: ["state"] };
    const next: QueryParams = { ...base, groupBy: ["state", "district"] };
    expect(diffParams(prev, next)).toEqual<ReceiptAction[]>([
      { kind: "add", field: "groupBy", label: "district" },
    ]);
  });

  it("orderBy direction flip → mod action", () => {
    const prev: QueryParams = {
      ...base,
      orderBy: [{ column: "revenue", direction: "asc" }],
    };
    const next: QueryParams = {
      ...base,
      orderBy: [{ column: "revenue", direction: "desc" }],
    };
    expect(diffParams(prev, next)).toEqual<ReceiptAction[]>([
      {
        kind: "mod",
        field: "sort",
        label: "revenue ↓",
        detail: "asc → desc",
      },
    ]);
  });

  it("orderBy column change → rem + add", () => {
    const prev: QueryParams = {
      ...base,
      orderBy: [{ column: "revenue", direction: "desc" }],
    };
    const next: QueryParams = {
      ...base,
      orderBy: [{ column: "take", direction: "desc" }],
    };
    const actions = diffParams(prev, next);
    expect(actions).toContainEqual({
      kind: "rem",
      field: "sort",
      label: "revenue ↓",
    });
    expect(actions).toContainEqual({
      kind: "add",
      field: "sort",
      label: "take ↓",
    });
  });

  it("limit change → mod action", () => {
    const prev: QueryParams = { ...base, limit: 100 };
    const next: QueryParams = { ...base, limit: 40 };
    expect(diffParams(prev, next)).toEqual<ReceiptAction[]>([
      {
        kind: "mod",
        field: "limit",
        label: "40",
        detail: "100 → 40",
      },
    ]);
  });

  it("limit undefined → defined is not an action (default limit)", () => {
    const prev: QueryParams = { table: "districts" };
    const next: QueryParams = { table: "districts", limit: 100 };
    expect(diffParams(prev, next)).toEqual([]);
  });

  it("multi-field turn: add column + mod sort + rem filter", () => {
    const prev: QueryParams = {
      table: "opportunities",
      columns: ["name", "amount"],
      filters: [{ column: "stage", op: "eq", value: "closed_won" }],
      orderBy: [{ column: "revenue", direction: "desc" }],
    };
    const next: QueryParams = {
      table: "opportunities",
      columns: ["name", "amount", "owner_name"],
      orderBy: [{ column: "take", direction: "desc" }],
    };
    const actions = diffParams(prev, next);
    expect(actions).toContainEqual({
      kind: "add",
      field: "column",
      label: "owner_name",
    });
    expect(actions).toContainEqual({
      kind: "rem",
      field: "filter",
      label: "stage = closed_won",
    });
    // sort: column changed → rem + add
    expect(actions).toContainEqual({
      kind: "rem",
      field: "sort",
      label: "revenue ↓",
    });
    expect(actions).toContainEqual({
      kind: "add",
      field: "sort",
      label: "take ↓",
    });
  });
});
