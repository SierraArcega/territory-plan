import { describe, it, expect } from "vitest";
import {
  SOURCE_FIELDS,
  SOURCE_TABLES,
  lookupField,
  validateFieldOp,
} from "../source-fields";
import { SAVED_LIST_SOURCES } from "../filter-tree";

describe("SOURCE_FIELDS", () => {
  it("has an entry for every SavedList source", () => {
    for (const src of SAVED_LIST_SOURCES) {
      expect(SOURCE_FIELDS[src]).toBeDefined();
      expect(SOURCE_FIELDS[src].length).toBeGreaterThan(0);
    }
  });

  it("has unique field ids per source", () => {
    for (const src of SAVED_LIST_SOURCES) {
      const ids = SOURCE_FIELDS[src].map((f) => f.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    }
  });
});

describe("SOURCE_TABLES", () => {
  it("has an entry for every SavedList source", () => {
    for (const src of SAVED_LIST_SOURCES) {
      expect(SOURCE_TABLES[src]).toBeDefined();
      expect(SOURCE_TABLES[src].table).toBeTruthy();
      expect(SOURCE_TABLES[src].primaryKey).toBeTruthy();
    }
  });
});

describe("lookupField", () => {
  it("returns a known field", () => {
    const f = lookupField("districts", "state");
    expect(f).not.toBeNull();
    expect(f?.column).toBe("state_abbrev");
  });

  it("returns null for unknown field", () => {
    expect(lookupField("districts", "no_such_field")).toBeNull();
  });
});

describe("validateFieldOp", () => {
  it("accepts a known (field, op) pair", () => {
    expect(validateFieldOp("districts", "state", "is")).toBeNull();
    expect(validateFieldOp("districts", "enrollment", ">")).toBeNull();
  });

  it("rejects unknown field", () => {
    expect(validateFieldOp("districts", "foo", "is")).toMatch(/Unknown field/);
  });

  it("rejects disallowed op for a known field", () => {
    // enrollment doesn't allow "contains"
    expect(validateFieldOp("districts", "enrollment", "contains")).toMatch(
      /not allowed/,
    );
  });
});
