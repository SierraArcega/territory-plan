import { describe, it, expect } from "vitest";
import {
  createListBodySchema,
  filterNodeSchema,
  listSpecSchema,
  previewBodySchema,
  updateListBodySchema,
} from "../schema";
import { FILTER_TREE_SCHEMA_VERSION } from "../filter-tree";

describe("filterNodeSchema", () => {
  it("accepts a single rule", () => {
    const result = filterNodeSchema.safeParse({
      kind: "rule",
      fieldId: "state",
      op: "is",
      value: "NY",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an `any` node with string values", () => {
    const result = filterNodeSchema.safeParse({
      kind: "any",
      fieldId: "state",
      op: "is any of",
      values: ["NY", "NJ", "CT"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a nested AND tree", () => {
    const result = filterNodeSchema.safeParse({
      kind: "and",
      children: [
        { kind: "rule", fieldId: "state", op: "is", value: "NY" },
        {
          kind: "and",
          children: [
            { kind: "rule", fieldId: "enrollment", op: ">", value: 5000 },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown kind", () => {
    const result = filterNodeSchema.safeParse({
      kind: "or",
      children: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a rule without a fieldId", () => {
    const result = filterNodeSchema.safeParse({
      kind: "rule",
      op: "is",
      value: "NY",
    });
    expect(result.success).toBe(false);
  });
});

describe("listSpecSchema", () => {
  it("accepts a full spec with schemaVersion 1", () => {
    const result = listSpecSchema.safeParse({
      schemaVersion: FILTER_TREE_SCHEMA_VERSION,
      source: "districts",
      filterTree: {
        kind: "and",
        children: [
          { kind: "rule", fieldId: "state", op: "is", value: "NY" },
        ],
      },
      scope: { mode: "none" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown source", () => {
    const result = listSpecSchema.safeParse({
      schemaVersion: FILTER_TREE_SCHEMA_VERSION,
      source: "schools",
      filterTree: { kind: "and", children: [] },
      scope: { mode: "none" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a wrong schemaVersion", () => {
    const result = listSpecSchema.safeParse({
      schemaVersion: 2,
      source: "districts",
      filterTree: { kind: "and", children: [] },
      scope: { mode: "none" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts scope mode = rules", () => {
    const result = listSpecSchema.safeParse({
      schemaVersion: FILTER_TREE_SCHEMA_VERSION,
      source: "opps",
      filterTree: { kind: "and", children: [] },
      scope: {
        mode: "rules",
        filterTree: {
          kind: "and",
          children: [
            { kind: "rule", fieldId: "state", op: "is", value: "NY" },
          ],
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts scope mode = reference (plan)", () => {
    const result = listSpecSchema.safeParse({
      schemaVersion: FILTER_TREE_SCHEMA_VERSION,
      source: "contacts",
      filterTree: { kind: "and", children: [] },
      scope: {
        mode: "reference",
        kind: "plan",
        id: "plan-uuid-here",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects scope reference with an invalid kind", () => {
    const result = listSpecSchema.safeParse({
      schemaVersion: FILTER_TREE_SCHEMA_VERSION,
      source: "contacts",
      filterTree: { kind: "and", children: [] },
      scope: {
        mode: "reference",
        kind: "team",
        id: "x",
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("createListBodySchema", () => {
  it("accepts a minimal valid body", () => {
    const result = createListBodySchema.safeParse({
      name: "  NY Customers  ",
      source: "districts",
      filterTree: { kind: "and", children: [] },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // name is trimmed
      expect(result.data.name).toBe("NY Customers");
      // scopeMode defaults to "none"
      expect(result.data.scopeMode).toBe("none");
      expect(result.data.shared).toBe(false);
    }
  });

  it("rejects an empty name", () => {
    const result = createListBodySchema.safeParse({
      name: "  ",
      source: "districts",
      filterTree: { kind: "and", children: [] },
    });
    expect(result.success).toBe(false);
  });
});

describe("updateListBodySchema", () => {
  it("accepts an empty object (partial update)", () => {
    const result = updateListBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a single field update", () => {
    const result = updateListBodySchema.safeParse({ shared: true });
    expect(result.success).toBe(true);
  });
});

describe("previewBodySchema", () => {
  it("accepts a minimal preview body", () => {
    const result = previewBodySchema.safeParse({
      source: "vacancies",
      filterTree: {
        kind: "and",
        children: [
          { kind: "rule", fieldId: "status", op: "is", value: "open" },
        ],
      },
    });
    expect(result.success).toBe(true);
  });
});
