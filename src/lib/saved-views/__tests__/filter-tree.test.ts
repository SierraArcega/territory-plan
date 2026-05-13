import { describe, it, expect } from "vitest";
import {
  emptyAndTree,
  flattenForUi,
  isEmptyTree,
  type FilterAnd,
  type FilterAny,
  type FilterRule,
} from "../filter-tree";

describe("flattenForUi", () => {
  it("returns a single rule unchanged", () => {
    const rule: FilterRule = {
      kind: "rule",
      fieldId: "state",
      op: "is",
      value: "NY",
    };
    const result = flattenForUi(rule);
    expect(result.rules).toEqual([rule]);
    expect(result.warnings).toEqual([]);
  });

  it("returns an `any` node unchanged", () => {
    const any: FilterAny = {
      kind: "any",
      fieldId: "state",
      op: "is any of",
      values: ["NY", "NJ", "CT"],
    };
    const result = flattenForUi(any);
    expect(result.rules).toEqual([any]);
    expect(result.warnings).toEqual([]);
  });

  it("unwraps a flat AND of rules", () => {
    const tree: FilterAnd = {
      kind: "and",
      children: [
        { kind: "rule", fieldId: "state", op: "is", value: "NY" },
        { kind: "rule", fieldId: "enrollment", op: ">", value: 5000 },
      ],
    };
    const result = flattenForUi(tree);
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0]).toMatchObject({ fieldId: "state" });
    expect(result.rules[1]).toMatchObject({ fieldId: "enrollment" });
    expect(result.warnings).toEqual([]);
  });

  it("recursively unwraps nested AND nodes", () => {
    const tree: FilterAnd = {
      kind: "and",
      children: [
        { kind: "rule", fieldId: "state", op: "is", value: "NY" },
        {
          kind: "and",
          children: [
            { kind: "rule", fieldId: "enrollment", op: ">", value: 5000 },
            {
              kind: "any",
              fieldId: "stage",
              op: "is any of",
              values: ["Proposal", "Negotiation"],
            },
          ],
        },
      ],
    };
    const result = flattenForUi(tree);
    expect(result.rules).toHaveLength(3);
    expect(result.rules.map((r) => r.fieldId)).toEqual([
      "state",
      "enrollment",
      "stage",
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("returns empty rules + no warnings for an empty AND", () => {
    const result = flattenForUi(emptyAndTree());
    expect(result.rules).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("preserves `any` nodes embedded in a nested AND", () => {
    const tree: FilterAnd = {
      kind: "and",
      children: [
        {
          kind: "any",
          fieldId: "state",
          op: "is any of",
          values: ["NY", "NJ"],
        },
        { kind: "rule", fieldId: "enrollment", op: ">", value: 1000 },
      ],
    };
    const result = flattenForUi(tree);
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0]).toMatchObject({ kind: "any" });
    expect(result.rules[1]).toMatchObject({ kind: "rule" });
  });
});

describe("isEmptyTree", () => {
  it("returns true for an empty AND", () => {
    expect(isEmptyTree(emptyAndTree())).toBe(true);
  });

  it("returns true for nested empty ANDs", () => {
    const tree: FilterAnd = {
      kind: "and",
      children: [emptyAndTree(), emptyAndTree()],
    };
    expect(isEmptyTree(tree)).toBe(true);
  });

  it("returns false when a rule is present", () => {
    const tree: FilterAnd = {
      kind: "and",
      children: [
        { kind: "rule", fieldId: "state", op: "is", value: "NY" },
      ],
    };
    expect(isEmptyTree(tree)).toBe(false);
  });

  it("returns false when an `any` is present", () => {
    const tree: FilterAnd = {
      kind: "and",
      children: [
        {
          kind: "any",
          fieldId: "state",
          op: "is any of",
          values: ["NY"],
        },
      ],
    };
    expect(isEmptyTree(tree)).toBe(false);
  });
});
