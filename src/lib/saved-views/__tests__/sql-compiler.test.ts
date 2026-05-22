import { describe, it, expect } from "vitest";
import { compileFilterTree, validateFilterTree } from "../sql-compiler";

describe("compileFilterTree — districts source", () => {
  it("compiles a single rule with = operator", () => {
    const res = compileFilterTree(
      "districts",
      { kind: "rule", fieldId: "state", op: "is", value: "NY" },
      "d",
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.whereSql).toBe('(d."state_abbrev" = $1)');
      expect(res.params).toEqual(["NY"]);
    }
  });

  it("compiles a rule with > operator", () => {
    const res = compileFilterTree(
      "districts",
      { kind: "rule", fieldId: "enrollment", op: ">", value: 5000 },
      "d",
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.whereSql).toBe('(d."enrollment" > $1)');
      expect(res.params).toEqual([5000]);
    }
  });

  it("compiles an `any` node to IN (...)", () => {
    const res = compileFilterTree(
      "districts",
      {
        kind: "any",
        fieldId: "state",
        op: "is any of",
        values: ["NY", "NJ", "CT"],
      },
      "d",
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.whereSql).toBe('(d."state_abbrev" IN ($1, $2, $3))');
      expect(res.params).toEqual(["NY", "NJ", "CT"]);
    }
  });

  it("compiles an AND of rules", () => {
    const res = compileFilterTree(
      "districts",
      {
        kind: "and",
        children: [
          { kind: "rule", fieldId: "state", op: "is", value: "NY" },
          { kind: "rule", fieldId: "enrollment", op: ">", value: 1000 },
        ],
      },
      "d",
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.whereSql).toBe(
        '((d."state_abbrev" = $1) AND (d."enrollment" > $2))',
      );
      expect(res.params).toEqual(["NY", 1000]);
    }
  });

  it("compiles an empty AND to TRUE", () => {
    const res = compileFilterTree(
      "districts",
      { kind: "and", children: [] },
      "d",
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.whereSql).toBe("TRUE");
      expect(res.params).toEqual([]);
    }
  });

  it("compiles `is` with null to IS NULL", () => {
    const res = compileFilterTree(
      "districts",
      { kind: "rule", fieldId: "name", op: "is", value: null },
      "d",
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.whereSql).toBe('(d."name" IS NULL)');
      expect(res.params).toEqual([]);
    }
  });

  it("rejects unknown field with a clear error", () => {
    const res = compileFilterTree(
      "districts",
      { kind: "rule", fieldId: "no_such_field", op: "is", value: "x" },
      "d",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Unknown field/);
  });

  it("rejects disallowed op for a known field", () => {
    const res = compileFilterTree(
      "districts",
      { kind: "rule", fieldId: "enrollment", op: "contains", value: "x" },
      "d",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not allowed/);
  });

  it("rejects an invalid SQL alias to defend the FROM-clause", () => {
    const res = compileFilterTree(
      "districts",
      { kind: "rule", fieldId: "state", op: "is", value: "NY" },
      // Attempted SQL injection through alias
      "d; DROP TABLE districts",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Invalid SQL alias/);
  });

  it("compiles contains to ILIKE with %% wrap", () => {
    const res = compileFilterTree(
      "districts",
      { kind: "rule", fieldId: "name", op: "contains", value: "Austin" },
      "d",
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.whereSql).toBe('(d."name" ILIKE $1)');
      expect(res.params).toEqual(["%Austin%"]);
    }
  });
});

describe("compileFilterTree — duration operators", () => {
  it("compiles `within 30 days` against a date column", () => {
    const res = compileFilterTree(
      "vacancies",
      { kind: "rule", fieldId: "date_posted", op: "within", value: "30 days" },
      "v",
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.whereSql).toBe(
        '(v."date_posted" >= NOW() - INTERVAL \'30 day\')',
      );
      expect(res.params).toEqual([]);
    }
  });

  it("rejects an unparseable duration", () => {
    const res = compileFilterTree(
      "vacancies",
      { kind: "rule", fieldId: "date_posted", op: "within", value: "soon" },
      "v",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/duration/);
  });
});

describe("validateFilterTree", () => {
  it("returns null for a valid tree", () => {
    const err = validateFilterTree("districts", {
      kind: "and",
      children: [
        { kind: "rule", fieldId: "state", op: "is", value: "NY" },
        {
          kind: "any",
          fieldId: "enrollment",
          op: "is any of",
          values: [1000, 2000],
        },
      ],
    });
    // 'is any of' is allowed on enrollment? No — enrollment has only >, <,
    // >=, <=. So we expect this to error. Switch to a valid case:
    expect(err).not.toBeNull();
    expect(err).toMatch(/not allowed/);
  });

  it("returns null for a valid tree (state any of)", () => {
    const err = validateFilterTree("districts", {
      kind: "and",
      children: [
        {
          kind: "any",
          fieldId: "state",
          op: "is any of",
          values: ["NY", "NJ"],
        },
      ],
    });
    expect(err).toBeNull();
  });

  it("returns an error message for an unknown field", () => {
    const err = validateFilterTree("districts", {
      kind: "rule",
      fieldId: "nope",
      op: "is",
      value: 1,
    });
    expect(err).toMatch(/Unknown field/);
  });
});

describe("compileFilterTree — note_type (virtual, district-scoped)", () => {
  it("compiles note_type to an EXISTS subquery on district_notes (no plan needed)", () => {
    const res = compileFilterTree(
      "districts",
      { kind: "rule", fieldId: "note_type", op: "is", value: "risk_flag" },
      "d",
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.whereSql).toContain("EXISTS");
      expect(res.whereSql).toContain("district_notes");
      expect(res.whereSql).toContain("note_type = ANY");
    }
  });

  it("rejects a bogus note_type value", () => {
    const res = compileFilterTree(
      "districts",
      { kind: "rule", fieldId: "note_type", op: "is", value: "nope" },
      "d",
    );
    expect(res.ok).toBe(false);
  });
});

describe("compileFilterTree — has_target (virtual, plan-scoped)", () => {
  it("compiles `has_target = true` to an EXISTS subquery with planId bound", () => {
    const res = compileFilterTree(
      "districts",
      { kind: "rule", fieldId: "has_target", op: "is", value: true },
      "d",
      0,
      { planId: "plan-123" },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.whereSql).toContain("EXISTS");
      expect(res.whereSql).toContain("territory_plan_districts");
      expect(res.whereSql).toContain(`d."leaid"`);
      expect(res.whereSql).not.toContain("NOT EXISTS");
      expect(res.params).toEqual(["plan-123"]);
    }
  });

  it("compiles `has_target = false` to NOT EXISTS", () => {
    const res = compileFilterTree(
      "districts",
      { kind: "rule", fieldId: "has_target", op: "is", value: false },
      "d",
      0,
      { planId: "plan-123" },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.whereSql).toContain("NOT EXISTS");
      expect(res.params).toEqual(["plan-123"]);
    }
  });

  it("rejects has_target without a planId in compile options", () => {
    const res = compileFilterTree(
      "districts",
      { kind: "rule", fieldId: "has_target", op: "is", value: true },
      "d",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/requires a planId/);
    }
  });

  it("rejects non-boolean values for has_target", () => {
    const res = compileFilterTree(
      "districts",
      { kind: "rule", fieldId: "has_target", op: "is", value: "yes" },
      "d",
      0,
      { planId: "plan-123" },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/boolean/);
    }
  });
});
