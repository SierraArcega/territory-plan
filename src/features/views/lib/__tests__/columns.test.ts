import { describe, it, expect } from "vitest";
import { SOURCE_COLUMNS } from "../columns";
import { SOURCE_FIELDS } from "@/lib/saved-views/source-fields";

describe("SOURCE_COLUMNS", () => {
  const sources = ["districts","contacts","opps","vacancies","news","rfps"] as const;

  it("covers all 6 sources", () => {
    for (const s of sources) {
      expect(SOURCE_COLUMNS[s]).toBeDefined();
      expect(SOURCE_COLUMNS[s].length).toBeGreaterThan(0);
    }
  });

  it("every filterable column links to a SOURCE_FIELDS entry", () => {
    for (const s of sources) {
      for (const col of SOURCE_COLUMNS[s]) {
        if (col.filterFieldId !== null) {
          const field = SOURCE_FIELDS[s].find(f => f.id === col.filterFieldId);
          expect(field, `${s}.${col.id} → ${col.filterFieldId}`).toBeDefined();
        }
      }
    }
  });

  it("every raw sortable column has a SOURCE_FIELDS column reference", () => {
    for (const s of sources) {
      for (const col of SOURCE_COLUMNS[s]) {
        if (col.kind === "raw" && col.sortable) {
          expect(col.filterFieldId, `${s}.${col.id} sortable but no fieldId`).not.toBeNull();
        }
      }
    }
  });

  it("derived columns are not sortable except for virtual-sort exceptions", () => {
    // Virtual sort fields are derived but sortable — the route compiles them
    // to an inline-CTE join in the main query.
    const SORTABLE_DERIVED_EXCEPTIONS = new Set(["customer_rank", "churn_risk"]);
    for (const s of sources) {
      for (const col of SOURCE_COLUMNS[s]) {
        if (col.kind === "derived" && !SORTABLE_DERIVED_EXCEPTIONS.has(col.id)) {
          expect(col.sortable).toBe(false);
        }
      }
    }
  });

  it("default order is unique within each source", () => {
    for (const s of sources) {
      const orders = SOURCE_COLUMNS[s].map(c => c.defaultOrder);
      expect(new Set(orders).size).toBe(orders.length);
    }
  });
});
