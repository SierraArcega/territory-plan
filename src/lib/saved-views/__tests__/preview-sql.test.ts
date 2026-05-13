import { describe, it, expect } from "vitest";
import { buildPreviewSql } from "../preview-sql";

describe("buildPreviewSql — scope=none", () => {
  it("builds count + sample SQL for districts with one rule", () => {
    const res = buildPreviewSql(
      "districts",
      {
        kind: "and",
        children: [
          { kind: "rule", fieldId: "state", op: "is", value: "NY" },
        ],
      },
      { mode: "none" },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.sql.countSql).toContain('FROM "districts" p');
      expect(res.sql.countSql).toContain('p."state_abbrev" = $1');
      expect(res.sql.sampleSql).toContain('LIMIT 3');
      expect(res.sql.sampleSql).toContain('p."name" AS primary_label');
      expect(res.sql.params).toEqual(["NY"]);
    }
  });

  it("builds SQL for opps with stage + amount", () => {
    const res = buildPreviewSql(
      "opps",
      {
        kind: "and",
        children: [
          { kind: "rule", fieldId: "stage", op: "is", value: "Proposal" },
          { kind: "rule", fieldId: "net_booking_amount", op: ">", value: 10000 },
        ],
      },
      { mode: "none" },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.sql.countSql).toContain('FROM "opportunities" p');
      expect(res.sql.params).toEqual(["Proposal", 10000]);
    }
  });

  it("builds SQL for vacancies", () => {
    const res = buildPreviewSql(
      "vacancies",
      { kind: "rule", fieldId: "status", op: "is", value: "open" },
      { mode: "none" },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.sql.countSql).toContain('FROM "vacancies" p');
      expect(res.sql.countSql).toContain('p."status" = $1');
    }
  });

  it("builds SQL for news", () => {
    const res = buildPreviewSql(
      "news",
      {
        kind: "rule",
        fieldId: "fullmind_relevance",
        op: "is",
        value: "high",
      },
      { mode: "none" },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.sql.countSql).toContain('FROM "news_articles" p');
    }
  });

  it("builds SQL for rfps", () => {
    const res = buildPreviewSql(
      "rfps",
      { kind: "rule", fieldId: "status", op: "is", value: "open" },
      { mode: "none" },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.sql.countSql).toContain('FROM "rfps" p');
    }
  });

  it("builds SQL for contacts", () => {
    const res = buildPreviewSql(
      "contacts",
      { kind: "rule", fieldId: "is_primary", op: "is", value: true },
      { mode: "none" },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.sql.countSql).toContain('FROM "contacts" p');
      expect(res.sql.params).toEqual([true]);
    }
  });
});

describe("buildPreviewSql — scope=rules", () => {
  it("EXISTS-joins a scope filter on districts", () => {
    const res = buildPreviewSql(
      "opps",
      {
        kind: "rule",
        fieldId: "stage",
        op: "is",
        value: "Proposal",
      },
      {
        mode: "rules",
        filterTree: {
          kind: "rule",
          fieldId: "state",
          op: "is",
          value: "NY",
        },
      },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      // Scope SQL appended after primary WHERE
      expect(res.sql.countSql).toMatch(
        /AND EXISTS \(SELECT 1 FROM "districts" scoped WHERE scoped\."leaid" = p\."district_lea_id" AND \(scoped\."state_abbrev" = \$2\)\)/,
      );
      expect(res.sql.params).toEqual(["Proposal", "NY"]);
    }
  });
});

describe("buildPreviewSql — scope=reference (plan)", () => {
  it("restricts to plan-member districts via territory_plan_districts", () => {
    const res = buildPreviewSql(
      "vacancies",
      {
        kind: "rule",
        fieldId: "status",
        op: "is",
        value: "open",
      },
      { mode: "reference", refKind: "plan", refId: "plan-uuid-1" },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.sql.countSql).toMatch(
        /p\."leaid" IN \(SELECT "district_leaid" FROM "territory_plan_districts" WHERE "plan_id" = \$2\)/,
      );
      expect(res.sql.params).toEqual(["open", "plan-uuid-1"]);
    }
  });
});

describe("buildPreviewSql — error cases", () => {
  it("returns an error for an unknown source field", () => {
    const res = buildPreviewSql(
      "districts",
      { kind: "rule", fieldId: "no_such_field", op: "is", value: 1 },
      { mode: "none" },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Unknown field/);
  });

  it("returns an error for news source with scope=rules (no district_join_column)", () => {
    const res = buildPreviewSql(
      "news",
      {
        kind: "rule",
        fieldId: "fullmind_relevance",
        op: "is",
        value: "high",
      },
      {
        mode: "rules",
        filterTree: { kind: "rule", fieldId: "state", op: "is", value: "NY" },
      },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/does not support scope/);
  });

  it("returns an error when scope=rules with no filterTree", () => {
    const res = buildPreviewSql(
      "opps",
      { kind: "and", children: [] },
      { mode: "rules", filterTree: null },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/scope.filterTree/);
  });
});
