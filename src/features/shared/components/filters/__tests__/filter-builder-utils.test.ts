import { describe, it, expect } from "vitest";
import {
  OPERATORS_BY_TYPE,
  buildComparator,
  buildFilterPredicate,
  filterValueLabel,
  operatorLabel,
  operatorNeedsValue,
  type ActiveFilter,
  type FilterColumn,
} from "../filter-builder-utils";

interface Lead {
  name: string;
  org: string | null;
  score: number | null;
  createdAt: string | null;
  status: string;
  hasOpp: boolean;
  statusOrder?: number;
}

const COLUMNS: FilterColumn<Lead>[] = [
  { key: "name", label: "Name", type: "text" },
  { key: "org", label: "District", type: "text" },
  { key: "score", label: "Score", type: "number" },
  { key: "createdAt", label: "Created", type: "date" },
  {
    key: "status",
    label: "Status",
    type: "enum",
    options: [
      { value: "new", label: "New" },
      { value: "working", label: "Working" },
    ],
  },
  { key: "hasOpp", label: "Has opportunity", type: "boolean" },
];

const row = (overrides: Partial<Lead> = {}): Lead => ({
  name: "Dana Ortiz",
  org: "Springfield USD",
  score: 80,
  createdAt: "2026-06-01",
  status: "new",
  hasOpp: false,
  ...overrides,
});

const filter = (
  column: string,
  op: ActiveFilter["op"],
  value?: ActiveFilter["value"],
): ActiveFilter => ({ id: "t1", column, op, value });

function matches(f: ActiveFilter, r: Lead): boolean {
  return buildFilterPredicate([f], COLUMNS)(r);
}

// ===========================================================================
// buildFilterPredicate — text
// ===========================================================================

describe("buildFilterPredicate · text", () => {
  it("eq matches the exact string", () => {
    expect(matches(filter("name", "eq", "Dana Ortiz"), row())).toBe(true);
    expect(matches(filter("name", "eq", "dana ortiz"), row())).toBe(false);
    expect(matches(filter("name", "eq", "Sam"), row())).toBe(false);
  });

  it("neq excludes the exact string (null counts as not-equal)", () => {
    expect(matches(filter("name", "neq", "Sam"), row())).toBe(true);
    expect(matches(filter("name", "neq", "Dana Ortiz"), row())).toBe(false);
    expect(matches(filter("org", "neq", "Springfield USD"), row({ org: null }))).toBe(true);
  });

  it("contains is case-insensitive", () => {
    expect(matches(filter("name", "contains", "ortiz"), row())).toBe(true);
    expect(matches(filter("name", "contains", "ORTIZ"), row())).toBe(true);
    expect(matches(filter("name", "contains", "smith"), row())).toBe(false);
    expect(matches(filter("org", "contains", "usd"), row({ org: null }))).toBe(false);
  });

  it("not_contains inverts contains", () => {
    expect(matches(filter("name", "not_contains", "smith"), row())).toBe(true);
    expect(matches(filter("name", "not_contains", "ortiz"), row())).toBe(false);
  });

  it("is_empty / is_not_empty treat null and empty string as empty", () => {
    expect(matches(filter("org", "is_empty"), row({ org: null }))).toBe(true);
    expect(matches(filter("org", "is_empty"), row({ org: "" }))).toBe(true);
    expect(matches(filter("org", "is_empty"), row())).toBe(false);
    expect(matches(filter("org", "is_not_empty"), row())).toBe(true);
    expect(matches(filter("org", "is_not_empty"), row({ org: null }))).toBe(false);
  });
});

// ===========================================================================
// buildFilterPredicate — number
// ===========================================================================

describe("buildFilterPredicate · number", () => {
  it("eq / neq compare numerically", () => {
    expect(matches(filter("score", "eq", "80"), row())).toBe(true);
    expect(matches(filter("score", "eq", "81"), row())).toBe(false);
    expect(matches(filter("score", "neq", "81"), row())).toBe(true);
    expect(matches(filter("score", "neq", "80"), row())).toBe(false);
  });

  it("eq never matches a null value; neq does", () => {
    expect(matches(filter("score", "eq", "80"), row({ score: null }))).toBe(false);
    expect(matches(filter("score", "neq", "80"), row({ score: null }))).toBe(true);
  });

  it("gt / lt are strict and skip null values", () => {
    expect(matches(filter("score", "gt", "79"), row())).toBe(true);
    expect(matches(filter("score", "gt", "80"), row())).toBe(false);
    expect(matches(filter("score", "lt", "81"), row())).toBe(true);
    expect(matches(filter("score", "lt", "80"), row())).toBe(false);
    expect(matches(filter("score", "gt", "0"), row({ score: null }))).toBe(false);
    expect(matches(filter("score", "lt", "999"), row({ score: null }))).toBe(false);
  });

  it("between is inclusive at both ends", () => {
    expect(matches(filter("score", "between", ["80", "100"]), row())).toBe(true);
    expect(matches(filter("score", "between", ["60", "80"]), row())).toBe(true);
    expect(matches(filter("score", "between", ["81", "100"]), row())).toBe(false);
    expect(matches(filter("score", "between", ["0", "79"]), row())).toBe(false);
    expect(matches(filter("score", "between", ["0", "100"]), row({ score: null }))).toBe(false);
  });
});

// ===========================================================================
// buildFilterPredicate — date (day-level semantics)
// ===========================================================================

describe("buildFilterPredicate · date", () => {
  it("after excludes the named day itself", () => {
    const f = filter("createdAt", "after", "2026-06-01");
    expect(matches(f, row({ createdAt: "2026-06-01" }))).toBe(false);
    expect(matches(f, row({ createdAt: "2026-06-02" }))).toBe(true);
    expect(matches(f, row({ createdAt: "2026-05-31" }))).toBe(false);
  });

  it("before excludes the named day itself", () => {
    const f = filter("createdAt", "before", "2026-06-01");
    expect(matches(f, row({ createdAt: "2026-06-01" }))).toBe(false);
    expect(matches(f, row({ createdAt: "2026-05-31" }))).toBe(true);
    expect(matches(f, row({ createdAt: "2026-06-02" }))).toBe(false);
  });

  it("between includes both endpoint days", () => {
    const f = filter("createdAt", "between", ["2026-06-01", "2026-06-10"]);
    expect(matches(f, row({ createdAt: "2026-06-01" }))).toBe(true);
    expect(matches(f, row({ createdAt: "2026-06-10" }))).toBe(true);
    expect(matches(f, row({ createdAt: "2026-06-05" }))).toBe(true);
    expect(matches(f, row({ createdAt: "2026-05-31" }))).toBe(false);
    expect(matches(f, row({ createdAt: "2026-06-11" }))).toBe(false);
  });

  it("treats UTC-midnight ISO strings as calendar dates (no day shift)", () => {
    const f = filter("createdAt", "between", ["2026-06-01", "2026-06-01"]);
    expect(matches(f, row({ createdAt: "2026-06-01T00:00:00.000Z" }))).toBe(true);
  });

  it("null dates never match after/before/between but match is_empty", () => {
    const r = row({ createdAt: null });
    expect(matches(filter("createdAt", "after", "2020-01-01"), r)).toBe(false);
    expect(matches(filter("createdAt", "before", "2030-01-01"), r)).toBe(false);
    expect(matches(filter("createdAt", "between", ["2020-01-01", "2030-01-01"]), r)).toBe(false);
    expect(matches(filter("createdAt", "is_empty"), r)).toBe(true);
    expect(matches(filter("createdAt", "is_empty"), row())).toBe(false);
  });
});

// ===========================================================================
// buildFilterPredicate — enum + boolean
// ===========================================================================

describe("buildFilterPredicate · enum + boolean", () => {
  it("enum eq / neq compare the option value", () => {
    expect(matches(filter("status", "eq", "new"), row())).toBe(true);
    expect(matches(filter("status", "eq", "working"), row())).toBe(false);
    expect(matches(filter("status", "neq", "working"), row())).toBe(true);
    expect(matches(filter("status", "neq", "new"), row())).toBe(false);
  });

  it("is_true / is_false require actual booleans", () => {
    expect(matches(filter("hasOpp", "is_true"), row({ hasOpp: true }))).toBe(true);
    expect(matches(filter("hasOpp", "is_true"), row({ hasOpp: false }))).toBe(false);
    expect(matches(filter("hasOpp", "is_false"), row({ hasOpp: false }))).toBe(true);
    expect(matches(filter("hasOpp", "is_false"), row({ hasOpp: true }))).toBe(false);
  });
});

// ===========================================================================
// buildFilterPredicate — composition + accessor
// ===========================================================================

describe("buildFilterPredicate · composition", () => {
  it("ANDs multiple filters together", () => {
    const predicate = buildFilterPredicate(
      [
        filter("score", "gt", "50"),
        { id: "t2", column: "status", op: "eq", value: "new" },
      ],
      COLUMNS,
    );
    expect(predicate(row())).toBe(true);
    expect(predicate(row({ score: 40 }))).toBe(false);
    expect(predicate(row({ status: "working" }))).toBe(false);
  });

  it("ignores filters on unknown columns", () => {
    const predicate = buildFilterPredicate(
      [filter("nope", "eq", "x")],
      COLUMNS,
    );
    expect(predicate(row())).toBe(true);
  });

  it("returns true for everything when no filters are active", () => {
    expect(buildFilterPredicate([], COLUMNS)(row())).toBe(true);
  });

  it("uses a custom accessor when provided", () => {
    const cols: FilterColumn<Lead>[] = [
      {
        key: "fullName",
        label: "Name",
        type: "text",
        accessor: (l) => l.name.toUpperCase(),
      },
    ];
    const predicate = buildFilterPredicate(
      [filter("fullName", "eq", "DANA ORTIZ")],
      cols,
    );
    expect(predicate(row())).toBe(true);
  });
});

// ===========================================================================
// buildComparator
// ===========================================================================

describe("buildComparator", () => {
  const rows: Lead[] = [
    row({ name: "Cara", score: 50, createdAt: "2026-06-03", status: "working" }),
    row({ name: "Abel", score: 90, createdAt: "2026-06-01", status: "new" }),
    row({ name: "Bea", score: 50, createdAt: "2026-06-02", status: "new" }),
  ];

  it("sorts by a single text column asc / desc", () => {
    const asc = [...rows].sort(buildComparator([{ key: "name", dir: "asc" }], COLUMNS));
    expect(asc.map((r) => r.name)).toEqual(["Abel", "Bea", "Cara"]);
    const desc = [...rows].sort(buildComparator([{ key: "name", dir: "desc" }], COLUMNS));
    expect(desc.map((r) => r.name)).toEqual(["Cara", "Bea", "Abel"]);
  });

  it("sorts numbers numerically and dates chronologically", () => {
    const byScore = [...rows].sort(buildComparator([{ key: "score", dir: "desc" }], COLUMNS));
    expect(byScore[0].name).toBe("Abel");
    const byDate = [...rows].sort(buildComparator([{ key: "createdAt", dir: "asc" }], COLUMNS));
    expect(byDate.map((r) => r.name)).toEqual(["Abel", "Bea", "Cara"]);
  });

  it("applies multi-column priority in order", () => {
    // score asc first (ties Cara/Bea at 50), then name desc breaks the tie
    const sorted = [...rows].sort(
      buildComparator(
        [
          { key: "score", dir: "asc" },
          { key: "name", dir: "desc" },
        ],
        COLUMNS,
      ),
    );
    expect(sorted.map((r) => r.name)).toEqual(["Cara", "Bea", "Abel"]);
  });

  it("reordering priorities changes the result", () => {
    const sorted = [...rows].sort(
      buildComparator(
        [
          { key: "name", dir: "desc" },
          { key: "score", dir: "asc" },
        ],
        COLUMNS,
      ),
    );
    expect(sorted.map((r) => r.name)).toEqual(["Cara", "Bea", "Abel"].sort().reverse());
  });

  it("puts empty values last regardless of direction", () => {
    const withNull = [...rows, row({ name: "Zed", score: null })];
    const asc = [...withNull].sort(buildComparator([{ key: "score", dir: "asc" }], COLUMNS));
    expect(asc[asc.length - 1].name).toBe("Zed");
    const desc = [...withNull].sort(buildComparator([{ key: "score", dir: "desc" }], COLUMNS));
    expect(desc[desc.length - 1].name).toBe("Zed");
  });

  it("uses sortAccessor over the display value", () => {
    const cols: FilterColumn<Lead>[] = [
      {
        key: "status",
        label: "Status",
        type: "enum",
        sortAccessor: (l) => (l.status === "new" ? 0 : 1),
      },
    ];
    const sorted = [...rows].sort(buildComparator([{ key: "status", dir: "asc" }], cols));
    expect(sorted[sorted.length - 1].status).toBe("working");
  });

  it("ignores unknown sort keys and is stable with no sorts", () => {
    const sorted = [...rows].sort(buildComparator([{ key: "nope", dir: "asc" }], COLUMNS));
    expect(sorted.map((r) => r.name)).toEqual(rows.map((r) => r.name));
  });
});

// ===========================================================================
// Operator metadata + pill labels
// ===========================================================================

describe("operator metadata", () => {
  it("exposes the handoff operator sets per type", () => {
    expect(OPERATORS_BY_TYPE.text).toEqual([
      "eq", "neq", "contains", "not_contains", "is_empty", "is_not_empty",
    ]);
    expect(OPERATORS_BY_TYPE.number).toEqual(["eq", "neq", "gt", "lt", "between"]);
    expect(OPERATORS_BY_TYPE.date).toEqual(["after", "before", "between", "is_empty"]);
    expect(OPERATORS_BY_TYPE.enum).toEqual(["eq", "neq"]);
    expect(OPERATORS_BY_TYPE.boolean).toEqual(["is_true", "is_false"]);
  });

  it("labels eq/neq as symbols for numbers and words elsewhere", () => {
    expect(operatorLabel("number", "eq")).toBe("=");
    expect(operatorLabel("number", "neq")).toBe("≠");
    expect(operatorLabel("text", "eq")).toBe("is");
    expect(operatorLabel("text", "not_contains")).toBe("does not contain");
    expect(operatorLabel("date", "after")).toBe("after");
  });

  it("knows which operators need a value", () => {
    expect(operatorNeedsValue("contains")).toBe(true);
    expect(operatorNeedsValue("between")).toBe(true);
    expect(operatorNeedsValue("is_empty")).toBe(false);
    expect(operatorNeedsValue("is_true")).toBe(false);
  });
});

describe("filterValueLabel", () => {
  it("returns null for no-value operators", () => {
    expect(filterValueLabel(filter("org", "is_empty"), COLUMNS[1])).toBeNull();
  });

  it("renders between as a range", () => {
    expect(
      filterValueLabel(filter("score", "between", ["10", "20"]), COLUMNS[2]),
    ).toBe("10–20");
  });

  it("maps enum values to their labels", () => {
    expect(filterValueLabel(filter("status", "eq", "working"), COLUMNS[4])).toBe(
      "Working",
    );
  });

  it("formats date values with fmtDate", () => {
    const label = filterValueLabel(
      filter("createdAt", "after", "2025-12-31"),
      COLUMNS[3],
    );
    expect(label).toBe("Dec 31, 2025");
  });
});
