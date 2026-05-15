import { describe, it, expect } from "vitest";
import { gridLayoutSchema, viewLayoutsSchema } from "../grid-layout-schema";

describe("gridLayoutSchema", () => {
  const valid = {
    columns: [
      { id: "name",  order: 0, visible: true },
      { id: "state", order: 1, visible: true, width: 100 },
    ],
    sort: [{ id: "state", dir: "asc" as const }],  // "state" is a SOURCE_FIELDS field id for districts
    filters: { kind: "and" as const, children: [] },
  };

  it("accepts a valid layout", () => {
    expect(() => gridLayoutSchema("districts").parse(valid)).not.toThrow();
  });

  it("rejects unknown column ids", () => {
    const bad = { ...valid, columns: [{ id: "fake_column", order: 0, visible: true }] };
    expect(() => gridLayoutSchema("districts").parse(bad)).toThrow(/fake_column/);
  });

  it("rejects sort on derived columns", () => {
    // tier is a derived column in SOURCE_COLUMNS.districts — it is NOT a SOURCE_FIELDS id
    const bad = { ...valid, sort: [{ id: "tier", dir: "asc" as const }] };
    expect(() => gridLayoutSchema("districts").parse(bad)).toThrow();
  });

  it("rejects sort on unknown column ids", () => {
    const bad = { ...valid, sort: [{ id: "ghost", dir: "asc" as const }] };
    expect(() => gridLayoutSchema("districts").parse(bad)).toThrow();
  });
});

describe("viewLayoutsSchema", () => {
  it("accepts each view-type entry validated against its source", () => {
    const layouts = {
      table:    { columns: [{ id: "name", order: 0, visible: true }], sort: [], filters: { kind: "and" as const, children: [] } },
      contacts: { columns: [{ id: "name", order: 0, visible: true }], sort: [], filters: { kind: "and" as const, children: [] } },
    };
    expect(() => viewLayoutsSchema().parse(layouts)).not.toThrow();
  });

  it("null clears layouts", () => {
    expect(() => viewLayoutsSchema().parse(null)).not.toThrow();
  });

  it("accepts mode on news layout", () => {
    const news = {
      columns: [{ id: "title", order: 0, visible: true }],
      sort: [],
      filters: { kind: "and" as const, children: [] },
      mode: "table" as const,
    };
    expect(() => viewLayoutsSchema().parse({ news })).not.toThrow();
  });

  it("rejects unknown mode on news layout", () => {
    const news = {
      columns: [{ id: "title", order: 0, visible: true }],
      sort: [],
      filters: { kind: "and" as const, children: [] },
      mode: "gallery",
    };
    expect(() => viewLayoutsSchema().parse({ news })).toThrow();
  });
});
