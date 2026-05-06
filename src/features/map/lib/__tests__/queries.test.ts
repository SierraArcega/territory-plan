import { describe, it, expect } from "vitest";
import { buildMapPlansTileUrl } from "../queries";

describe("buildMapPlansTileUrl", () => {
  it("returns the bare tile URL pattern when no filters are set", () => {
    const url = buildMapPlansTileUrl({});
    expect(url).toBe("/api/map/plans/{z}/{x}/{y}.mvt");
  });

  it("appends status filter as a comma-joined query param", () => {
    const url = buildMapPlansTileUrl({ status: ["working", "planning"] });
    expect(url).toBe("/api/map/plans/{z}/{x}/{y}.mvt?status=working%2Cplanning");
  });

  it("appends ownerIds, planIds, and fiscalYear", () => {
    const url = buildMapPlansTileUrl({
      ownerIds: ["u1", "u2"],
      planIds: ["p1"],
      fiscalYear: 2026,
    });
    expect(url).toContain("ownerIds=u1%2Cu2");
    expect(url).toContain("planIds=p1");
    expect(url).toContain("fiscalYear=2026");
  });

  it("omits empty arrays and undefined values", () => {
    const url = buildMapPlansTileUrl({ status: [], ownerIds: undefined });
    expect(url).toBe("/api/map/plans/{z}/{x}/{y}.mvt");
  });
});

describe("buildMapPlansTileUrl + origin concatenation", () => {
  it("preserves literal {z}/{x}/{y} placeholders when prefixed with an origin", () => {
    const origin = "http://localhost:3005";
    const url = `${origin}${buildMapPlansTileUrl({})}`;
    expect(url).toBe("http://localhost:3005/api/map/plans/{z}/{x}/{y}.mvt");
    // Sanity guard: ensure curly braces survived (they would be %7B / %7D if encoded).
    expect(url).not.toContain("%7B");
    expect(url).not.toContain("%7D");
  });
});
