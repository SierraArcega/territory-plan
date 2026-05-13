import { describe, it, expect } from "vitest";
import {
  defaultRule,
  defaultDistrictsRule,
  isAnyOp,
  isAnyRow,
  pruneRulesForSource,
  replaceRowField,
  changeRowOp,
  rulesToTree,
  totalLeafCount,
  isValidField,
  SOURCE_META,
  SOURCE_DEFAULT_VIEW,
} from "../builder-utils";
import { SOURCE_FIELDS } from "@/lib/saved-views/source-fields";

describe("builder-utils", () => {
  describe("defaultRule", () => {
    it("returns a rule pointing at the first field for a source", () => {
      const rule = defaultRule("districts");
      expect(rule.kind).toBe("rule");
      expect(rule.fieldId).toBe(SOURCE_FIELDS.districts[0].id);
      expect(rule.op).toBe(SOURCE_FIELDS.districts[0].ops[0]);
    });

    it("uses the first enumValue when available", () => {
      // vacancies' first field 'status' has enumValues.
      const rule = defaultRule("vacancies");
      const field = SOURCE_FIELDS.vacancies.find((f) => f.id === rule.fieldId);
      expect(field?.enumValues?.[0]).toBe(rule.value);
    });
  });

  describe("defaultDistrictsRule", () => {
    it("targets the districts source", () => {
      const rule = defaultDistrictsRule();
      expect(rule.fieldId).toBe(SOURCE_FIELDS.districts[0].id);
    });
  });

  describe("isAnyOp", () => {
    it("recognizes 'is any of' and 'is not any of'", () => {
      expect(isAnyOp("is any of")).toBe(true);
      expect(isAnyOp("is not any of")).toBe(true);
    });
    it("rejects single-value ops", () => {
      expect(isAnyOp("is")).toBe(false);
      expect(isAnyOp("contains")).toBe(false);
      expect(isAnyOp(">")).toBe(false);
    });
  });

  describe("isAnyRow", () => {
    it("narrows to FilterAny when kind === 'any'", () => {
      expect(
        isAnyRow({ kind: "any", fieldId: "state", op: "is any of", values: ["NY"] }),
      ).toBe(true);
      expect(
        isAnyRow({ kind: "rule", fieldId: "state", op: "is", value: "NY" }),
      ).toBe(false);
    });
  });

  describe("replaceRowField", () => {
    it("returns a rule pointing at the new field with valid op + value", () => {
      const next = replaceRowField("districts", "enrollment");
      expect(next.fieldId).toBe("enrollment");
      expect(next.kind).toBe("rule");
      expect(SOURCE_FIELDS.districts.find((f) => f.id === "enrollment")?.ops).toContain(
        next.op,
      );
    });

    it("falls back to the first field if id unknown", () => {
      const next = replaceRowField("districts", "totally-not-a-field");
      expect(next.fieldId).toBe(SOURCE_FIELDS.districts[0].id);
    });
  });

  describe("changeRowOp", () => {
    const stateField = SOURCE_FIELDS.districts.find((f) => f.id === "state")!;

    it("promotes a rule to 'any' when switching to 'is any of'", () => {
      const row = changeRowOp(
        { kind: "rule", fieldId: "state", op: "is", value: "NY" },
        "is any of",
        stateField,
      );
      expect(row.kind).toBe("any");
      if (row.kind === "any") {
        expect(row.values).toEqual(["NY"]);
      }
    });

    it("collapses 'any' back to a single rule when leaving 'is any of'", () => {
      const row = changeRowOp(
        { kind: "any", fieldId: "state", op: "is any of", values: ["NY", "NJ"] },
        "is",
        stateField,
      );
      expect(row.kind).toBe("rule");
      if (row.kind === "rule") {
        expect(row.value).toBe("NY");
      }
    });

    it("preserves the same op when switching across kinds with same op family", () => {
      const row = changeRowOp(
        { kind: "any", fieldId: "state", op: "is any of", values: ["NY"] },
        "is not any of",
        stateField,
      );
      expect(row.kind).toBe("any");
      expect(row.op).toBe("is not any of");
    });
  });

  describe("rulesToTree", () => {
    it("wraps a flat rules list into an AND tree", () => {
      const tree = rulesToTree([
        { kind: "rule", fieldId: "state", op: "is", value: "NY" },
      ]);
      expect(tree.kind).toBe("and");
      expect(tree.children).toHaveLength(1);
    });

    it("returns an empty AND for no rules", () => {
      const tree = rulesToTree([]);
      expect(tree.children).toEqual([]);
    });
  });

  describe("pruneRulesForSource", () => {
    it("keeps rules whose fieldId exists in the target source", () => {
      const rules = [
        { kind: "rule" as const, fieldId: "state", op: "is", value: "NY" },
      ];
      const pruned = pruneRulesForSource(rules, "opps");
      expect(pruned).toHaveLength(1);
    });

    it("drops rules whose fieldId doesn't exist in the target source", () => {
      const rules = [
        { kind: "rule" as const, fieldId: "enrollment", op: ">", value: 1000 },
      ];
      const pruned = pruneRulesForSource(rules, "opps");
      expect(pruned).toHaveLength(0);
    });
  });

  describe("totalLeafCount", () => {
    it("counts only source rules when scope=none", () => {
      expect(
        totalLeafCount(
          [{ kind: "rule", fieldId: "x", op: "is", value: 1 }],
          "none",
          [],
        ),
      ).toBe(1);
    });
    it("adds scope rules when scope=rules", () => {
      expect(
        totalLeafCount(
          [{ kind: "rule", fieldId: "x", op: "is", value: 1 }],
          "rules",
          [
            { kind: "rule", fieldId: "y", op: "is", value: 2 },
            { kind: "rule", fieldId: "z", op: "is", value: 3 },
          ],
        ),
      ).toBe(3);
    });
    it("adds 1 when scope=reference", () => {
      expect(
        totalLeafCount(
          [{ kind: "rule", fieldId: "x", op: "is", value: 1 }],
          "reference",
          [],
        ),
      ).toBe(2);
    });
  });

  describe("SOURCE_META + SOURCE_DEFAULT_VIEW", () => {
    it("has 6 sources", () => {
      expect(SOURCE_META).toHaveLength(6);
    });
    it("provides a default view per source", () => {
      for (const m of SOURCE_META) {
        expect(typeof SOURCE_DEFAULT_VIEW[m.id]).toBe("string");
      }
    });
  });

  describe("isValidField", () => {
    it("returns true for known field", () => {
      expect(isValidField("districts", "state")).toBe(true);
    });
    it("returns false for unknown field", () => {
      expect(isValidField("districts", "no-such-field")).toBe(false);
    });
  });
});
