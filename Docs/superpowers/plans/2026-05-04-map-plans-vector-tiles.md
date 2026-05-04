# Map Plans Vector Tiles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/api/map/plans` GeoJSON endpoint (60 s on the unfiltered "all 58 plans" case) with per-tile MVT, so plan polygon rendering scales with viewport size, not plan/district row count.

**Architecture:** Mirror the existing `/api/tiles/[z]/[x]/[y]/route.ts` pattern using PostGIS MVT helpers over the `district_map_features` view's `render_geometry` column. Filters travel in the query string (matches the existing tile pattern). Roll out across **three sequential PRs**: backend → client cutover → cleanup.

**Tech Stack:** Next.js 16 App Router · PostgreSQL/PostGIS (`ST_AsMVT`, `ST_AsMVTGeom`, `ST_TileEnvelope`, `ST_Simplify`) · MapLibre GL JS vector source · TanStack Query · TypeScript · Vitest.

---

## Spec deviation — read before starting

The spec (`Docs/superpowers/specs/2026-05-01-map-plans-vector-tiles-design.md`) describes the cutover as `useMapPlans` becoming a tile-URL builder. **It does not address two non-map consumers** of the GeoJSON, both of which only need `properties` (no geometry):

1. **`useCrossFilter`** in `src/features/map/lib/useCrossFilter.ts:37` — calls `extractLeaids(plansGeoJSON)` to filter contacts/vacancies/activities by the active plan-district set, and to drive the Districts Tab via `overlayDerivedLeaids`.
2. **`PlansTabContainer`** + **`PlansTab`** + **`SearchResults/index.tsx tabCounts`** — render a sidebar list grouped by `planId` and badge counts.

MVT is binary and viewport-scoped, so neither consumer can read it as React data. **This plan therefore introduces a companion lightweight list endpoint at `/api/map/plans/list`** that returns a flat array of plan-district properties (no geometry). PR 1 ships both endpoints. PR 2 wires the map to MVT and the non-map consumers to `/list`. PR 3 deletes the old GeoJSON endpoint.

If you (the engineer or reviewer) prefer instead to slim down the existing `/api/map/plans` endpoint in place rather than add `/list`, stop and discuss with the spec owner before changing the plan — both are defensible, but the "add then delete" path is what's planned below because it keeps the old endpoint untouched as a one-line revert path during PR 2's smoke window.

---

## File map

| Action | Path | Purpose |
|---|---|---|
| Create | `src/app/api/map/plans/[z]/[x]/[y]/route.ts` | New MVT tile endpoint. Mirrors `src/app/api/tiles/[z]/[x]/[y]/route.ts`. |
| Create | `src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts` | Unit tests for the MVT endpoint (mock pool, assert SQL shape + filter handling + cache headers + 204/400/500 paths). |
| Create | `src/app/api/map/plans/list/route.ts` | New lightweight JSON endpoint — flat array of plan-district properties, no geometry. Reuses the existing endpoint's filter parsing. |
| Create | `src/app/api/map/plans/list/__tests__/route.test.ts` | Unit tests mirroring the existing `/api/map/plans` test patterns minus the geometry assertions. |
| Modify | `src/features/map/lib/queries.ts` (~line 320–346) | `useMapPlans` swaps from GeoJSON URL to `/api/map/plans/list`, returns `PlanFeatureRow[]`. Add `buildMapPlansTileUrl(filters)` helper for MapLibre. |
| Modify | `src/features/map/lib/filter-utils.ts:41` | `extractLeaids` becomes shape-tolerant (accepts either a `FeatureCollection` or `PlanFeatureRow[]`) so existing call sites keep working. |
| Modify | `src/features/map/lib/useCrossFilter.ts` | Update the `OverlayData.plansGeoJSON` field type and downstream uses to take the new flat-array shape. |
| Modify | `src/features/map/components/MapV2Container.tsx` (line 244–247, 308–318, 847) | Subscribe to plan filters for the tile URL; replace the GeoJSON source with a `vector` source; call `setTiles([newUrl])` when filters change. |
| Modify | `src/features/map/lib/pin-layers.ts:242–266` (`getPlanLayers`) | Add `'source-layer': 'plans'` to fill + outline specs; keep paint expressions as-is. |
| Modify | `src/features/map/components/SearchResults/PlansTabContainer.tsx` | Pass the new flat-array shape to `PlansTab` and into `setOverlayGeoJSON`. |
| Modify | `src/features/map/components/SearchResults/PlansTab.tsx:9–49` | Replace `FeatureCollection<Geometry>` typing with `PlanFeatureRow[]`; update `uniquePlans` reducer accordingly. |
| Modify | `src/features/map/components/SearchResults/PlanCard.tsx:22` | Take a `PlanFeatureRow` instead of a `Feature`. |
| Modify | `src/features/map/components/SearchResults/index.tsx:462–468` | Update the `tabCounts` `for (const f of overlayGeoJSON.plans.features)` loop to iterate the new flat array. |
| Modify | `src/features/map/lib/store.ts:286, 450, 604, 1211–1213` | Change `overlayGeoJSON.plans` type from `FeatureCollection | null` to `PlanFeatureRow[] | null` (other overlays stay GeoJSON). |
| Delete (PR 3) | `src/app/api/map/plans/route.ts` | Old GeoJSON endpoint. |

A new shared type `PlanFeatureRow` (single row, no geometry) is defined once in `src/features/map/lib/queries.ts` and imported elsewhere.

---

## PR-by-PR rollout

- **PR 1 — Backend:** new MVT endpoint + new `/list` endpoint, both behind tests. Old `/api/map/plans` untouched. Branch off `main` as `feat/map-plans-mvt-backend`.
- **PR 2 — Client cutover:** map source → MVT vector; non-map consumers → `/list`. Branch off `main` as `feat/map-plans-mvt-client` (created **after PR 1 merges**).
- **PR 3 — Cleanup:** delete `src/app/api/map/plans/route.ts`. Branch off `main` as `chore/map-plans-mvt-remove-legacy` (created **after PR 2 has soaked in production for ~1 week**).

Each PR ships independently and can be reverted independently. The plan tasks below are grouped by PR — finish PR 1 (merge + green CI) before starting PR 2 tasks, etc.

---

# PR 1 — Backend: MVT endpoint + lightweight list endpoint

> Branch: `feat/map-plans-mvt-backend` (off latest `main`). All tasks in this section commit on that branch.

## Task 1: Set up the PR 1 branch

**Files:** none (git operations only).

- [ ] **Step 1: Sync main and create the branch**

```bash
git fetch origin
git checkout main
git pull origin main
git checkout -b feat/map-plans-mvt-backend
```

- [ ] **Step 2: Confirm baseline tests pass**

Run: `npm test -- --run`
Expected: existing pre-existing DB-integration failures only (1788 passing, ~19 failing on Prisma/DB env). No new failures.

---

## Task 2: Add the MVT route file with a failing test for parameter validation

**Files:**
- Create: `src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts`
- Create: `src/app/api/map/plans/[z]/[x]/[y]/route.ts` (stubbed in this task; filled out in Tasks 3–8)

- [ ] **Step 1: Write the first failing test (param validation)**

Create `src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockQuery = vi.fn();
const mockRelease = vi.fn();
vi.mock("@/lib/db", () => ({
  default: {
    connect: vi.fn(() =>
      Promise.resolve({ query: mockQuery, release: mockRelease })
    ),
  },
}));

import { GET } from "../route";
import pool from "@/lib/db";

function buildRequest(
  z: string,
  x: string,
  y: string,
  searchParams?: Record<string, string>
) {
  const url = new URL(`http://localhost/api/map/plans/${z}/${x}/${y}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url);
}

async function callGET(
  z: string,
  x: string,
  y: string,
  searchParams?: Record<string, string>
) {
  const request = buildRequest(z, x, y, searchParams);
  return GET(request, { params: Promise.resolve({ z, x, y }) });
}

describe("GET /api/map/plans/[z]/[x]/[y]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parameter validation", () => {
    it("returns 400 for invalid z coordinate", async () => {
      const res = await callGET("abc", "1", "2.mvt");
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid tile coordinates");
    });

    it("returns 400 for invalid x coordinate", async () => {
      const res = await callGET("5", "xyz", "2.mvt");
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid y coordinate", async () => {
      const res = await callGET("5", "1", "abc.mvt");
      expect(res.status).toBe(400);
    });

    it("strips .mvt suffix from y parameter", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: Buffer.from("tile") }] });
      await callGET("7", "10", "20.mvt");
      const [, queryParams] = mockQuery.mock.calls[0];
      expect(queryParams[0]).toBe(7);
      expect(queryParams[1]).toBe(10);
      expect(queryParams[2]).toBe(20);
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'` or similar (route does not exist yet).

- [ ] **Step 3: Stub the route to make param-validation tests pass**

Create `src/app/api/map/plans/[z]/[x]/[y]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  try {
    const { z, x, y } = await params;
    const zoom = parseInt(z);
    const tileX = parseInt(x);
    const tileY = parseInt(y.replace(".mvt", ""));

    if (isNaN(zoom) || isNaN(tileX) || isNaN(tileY)) {
      return NextResponse.json(
        { error: "Invalid tile coordinates" },
        { status: 400 }
      );
    }

    // TODO: filter parsing + SQL — added in subsequent tasks.
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT NULL::bytea AS mvt", []);
      const mvt = result.rows[0]?.mvt;
      if (!mvt || mvt.length === 0) {
        return new NextResponse(null, {
          status: 204,
          headers: {
            "Content-Type": "application/vnd.mapbox-vector-tile",
            "Cache-Control": "public, max-age=300",
          },
        });
      }
      return new NextResponse(mvt, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.mapbox-vector-tile",
          "Cache-Control": "public, max-age=300",
          "Content-Length": mvt.length.toString(),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error generating plans tile:", error);
    return NextResponse.json(
      { error: "Failed to generate tile" },
      { status: 500 }
    );
  }
}
```

Note: the stub query (`SELECT NULL::bytea AS mvt`) is a placeholder that lets the param-validation tests work without doing real geometry work; it gets replaced in Task 3.

- [ ] **Step 4: Re-run the tests; verify they pass**

Run: `npx vitest run src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts`
Expected: PASS — 4 of 4 in the `parameter validation` describe.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/map/plans/\[z\]/\[x\]/\[y\]/route.ts src/app/api/map/plans/\[z\]/\[x\]/\[y\]/__tests__/route.test.ts
git commit -m "feat(map-plans): scaffold MVT tile route with param validation"
```

---

## Task 3: Implement the SQL with zoom-aware simplification + tile envelope filter (no plan filters yet)

**Files:**
- Modify: `src/app/api/map/plans/[z]/[x]/[y]/route.ts`
- Modify: `src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts`

- [ ] **Step 1: Add failing tests for zoom-tolerance buckets and SQL shape**

Append the following describes to `__tests__/route.test.ts`:

```ts
  describe("geometry simplification", () => {
    it("uses tolerance 0.01 for zoom < 7", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("3", "1", "1");
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("ST_Simplify(d.render_geometry, 0.01)");
    });

    it("uses tolerance 0.005 for zoom 7-10", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("8", "10", "10");
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("ST_Simplify(d.render_geometry, 0.005)");
    });

    it("uses tolerance 0.001 for zoom >= 11", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("12", "10", "10");
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("ST_Simplify(d.render_geometry, 0.001)");
    });
  });

  describe("SQL shape", () => {
    it("uses ST_AsMVT with the 'plans' layer name", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20");
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("ST_AsMVT(tile_data, 'plans', 4096, 'geom')");
    });

    it("joins territory_plans → territory_plan_districts → district_map_features", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20");
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("FROM territory_plans tp");
      expect(sql).toContain("INNER JOIN territory_plan_districts tpd");
      expect(sql).toContain("INNER JOIN district_map_features d");
    });

    it("filters by tile envelope using GIST-friendly &&", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20");
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("d.render_geometry && (SELECT envelope_4326 FROM tile_bounds)");
    });

    it("passes z/x/y as the first three SQL parameters", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20");
      const [, queryParams] = mockQuery.mock.calls[0];
      expect(queryParams.slice(0, 3)).toEqual([7, 10, 20]);
    });
  });
```

- [ ] **Step 2: Run; verify the new tests fail**

Run: `npx vitest run src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts`
Expected: 4 PASS (param-validation from Task 2), all new ones FAIL.

- [ ] **Step 3: Replace the stub SQL with the real query (no plan filters yet)**

Replace the body of `GET` after the param-validation block in `src/app/api/map/plans/[z]/[x]/[y]/route.ts`:

```ts
    // Zoom-aware simplification (matches /api/tiles)
    const simplifyTolerance = zoom < 7 ? 0.01 : zoom < 11 ? 0.005 : 0.001;

    // Plan filter parsing — added in Task 4.
    const planFilters = "";
    const filterParams: (string | number)[] = [];

    const query = `
      WITH tile_bounds AS (
        SELECT
          ST_TileEnvelope($1, $2, $3) AS envelope,
          ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS envelope_4326
      ),
      tile_data AS (
        SELECT
          tp.id AS "planId",
          tp.name AS "planName",
          tp.color AS "planColor",
          tp.status AS "planStatus",
          d.name AS "districtName",
          d.leaid,
          tpd.renewal_target AS "renewalTarget",
          tpd.expansion_target AS "expansionTarget",
          ST_AsMVTGeom(
            ST_Transform(
              ST_Simplify(d.render_geometry, ${simplifyTolerance}),
              3857
            ),
            (SELECT envelope FROM tile_bounds),
            4096,
            64,
            true
          ) AS geom
        FROM territory_plans tp
        INNER JOIN territory_plan_districts tpd ON tp.id = tpd.plan_id
        INNER JOIN district_map_features d ON tpd.district_leaid = d.leaid
        WHERE d.render_geometry IS NOT NULL
          AND d.render_geometry && (SELECT envelope_4326 FROM tile_bounds)
          ${planFilters}
      )
      SELECT ST_AsMVT(tile_data, 'plans', 4096, 'geom') AS mvt
      FROM tile_data
      WHERE geom IS NOT NULL
    `;

    const queryParams: (string | number)[] = [zoom, tileX, tileY, ...filterParams];

    const client = await pool.connect();
    try {
      const result = await client.query(query, queryParams);
      const mvt = result.rows[0]?.mvt;
      if (!mvt || mvt.length === 0) {
        return new NextResponse(null, {
          status: 204,
          headers: {
            "Content-Type": "application/vnd.mapbox-vector-tile",
            "Cache-Control": "public, max-age=300",
          },
        });
      }
      return new NextResponse(mvt, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.mapbox-vector-tile",
          "Cache-Control": "public, max-age=300",
          "Content-Length": mvt.length.toString(),
        },
      });
    } finally {
      client.release();
    }
```

(Replace the entire body that currently sits between the param-validation `if`-block and the catch — including the `// TODO` placeholder query.)

- [ ] **Step 4: Re-run; verify all SQL/zoom tests pass**

Run: `npx vitest run src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts`
Expected: PASS — param-validation (4) + simplification (3) + SQL shape (4) = 11 of 11.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/map/plans/\[z\]/\[x\]/\[y\]/route.ts src/app/api/map/plans/\[z\]/\[x\]/\[y\]/__tests__/route.test.ts
git commit -m "feat(map-plans): add tile-envelope-filtered MVT query with zoom-aware simplification"
```

---

## Task 4: Add filter parsing for `status` / `fiscalYear` / `planIds` / `ownerIds` / `planId`

**Files:**
- Modify: `src/app/api/map/plans/[z]/[x]/[y]/route.ts`
- Modify: `src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts`

> Note: the existing `/api/map/plans/route.ts` accepts a singular `planId` param in addition to `planIds` (see line 25). Mirror that here so client wiring stays simple.

- [ ] **Step 1: Add failing filter-handling tests**

Append to `__tests__/route.test.ts`:

```ts
  describe("filter handling", () => {
    it("emits no extra WHERE clause when no filters are present", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20");
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(queryParams).toEqual([7, 10, 20]);
      expect(sql).not.toContain("tp.status");
      expect(sql).not.toContain("tp.fiscal_year");
      expect(sql).not.toContain("tp.id");
      expect(sql).not.toContain("tp.owner_id");
    });

    it("filters by single status", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20", { status: "working" });
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(sql).toContain("AND tp.status = $4");
      expect(queryParams).toEqual([7, 10, 20, "working"]);
    });

    it("filters by multiple statuses with IN clause", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20", { status: "working,planning" });
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/AND tp\.status IN \(\$4,\$5\)/);
      expect(queryParams).toEqual([7, 10, 20, "working", "planning"]);
    });

    it("returns 400 for non-numeric fiscalYear", async () => {
      const res = await callGET("7", "10", "20", { fiscalYear: "abc" });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid fiscalYear format");
    });

    it("filters by integer fiscalYear", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20", { fiscalYear: "2026" });
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(sql).toContain("AND tp.fiscal_year = $4");
      expect(queryParams).toEqual([7, 10, 20, 2026]);
    });

    it("filters by single planId param (legacy compat)", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20", { planId: "plan-uuid-1" });
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(sql).toContain("AND tp.id = $4");
      expect(queryParams).toEqual([7, 10, 20, "plan-uuid-1"]);
    });

    it("filters by planIds list with IN clause", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20", { planIds: "p1,p2,p3" });
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/AND tp\.id IN \(\$4,\$5,\$6\)/);
      expect(queryParams).toEqual([7, 10, 20, "p1", "p2", "p3"]);
    });

    it("filters by ownerIds list with IN clause", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20", { ownerIds: "u1,u2" });
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/AND tp\.owner_id IN \(\$4,\$5\)/);
      expect(queryParams).toEqual([7, 10, 20, "u1", "u2"]);
    });

    it("combines multiple filters with AND", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20", {
        status: "working",
        fiscalYear: "2026",
        ownerIds: "u1",
      });
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(sql).toContain("AND tp.status = $4");
      expect(sql).toContain("AND tp.fiscal_year = $5");
      expect(sql).toContain("AND tp.owner_id IN ($6)");
      expect(queryParams).toEqual([7, 10, 20, "working", 2026, "u1"]);
    });
  });
```

- [ ] **Step 2: Run; verify they fail**

Run: `npx vitest run src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts`
Expected: 11 PASS, 9 FAIL.

- [ ] **Step 3: Wire up filter parsing in the route**

Replace the two stub lines from Task 3 (`const planFilters = "";` and `const filterParams: (string | number)[] = [];`) with the block below. Insert it just before the `const query = ` line.

The placeholder-numbering trick: `placeholderFor(val)` pushes the value AND returns the matching `$N`, so call sites stay readable and you can't desync the index from the array.

```ts
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const fiscalYearRaw = searchParams.get("fiscalYear");
    const planId = searchParams.get("planId");
    const planIdsParam = searchParams.get("planIds");
    const ownerIdsParam = searchParams.get("ownerIds");

    const conditions: string[] = [];
    const filterParams: (string | number)[] = [];
    // z/x/y consume $1/$2/$3, so filter placeholders start at $4.
    const placeholderFor = (val: string | number) => {
      filterParams.push(val);
      return `$${3 + filterParams.length}`;
    };

    if (status) {
      const statuses = status.split(",").filter(Boolean);
      if (statuses.length === 1) {
        conditions.push(`tp.status = ${placeholderFor(statuses[0])}`);
      } else if (statuses.length > 1) {
        const ph = statuses.map((s) => placeholderFor(s)).join(",");
        conditions.push(`tp.status IN (${ph})`);
      }
    }

    if (fiscalYearRaw) {
      const fy = parseInt(fiscalYearRaw, 10);
      if (isNaN(fy)) {
        return NextResponse.json(
          { error: "Invalid fiscalYear format" },
          { status: 400 }
        );
      }
      conditions.push(`tp.fiscal_year = ${placeholderFor(fy)}`);
    }

    if (planId) {
      conditions.push(`tp.id = ${placeholderFor(planId)}`);
    }

    if (planIdsParam) {
      const ids = planIdsParam.split(",").filter(Boolean);
      if (ids.length > 0) {
        const ph = ids.map((id) => placeholderFor(id)).join(",");
        conditions.push(`tp.id IN (${ph})`);
      }
    }

    if (ownerIdsParam) {
      const ids = ownerIdsParam.split(",").filter(Boolean);
      if (ids.length > 0) {
        const ph = ids.map((id) => placeholderFor(id)).join(",");
        conditions.push(`tp.owner_id IN (${ph})`);
      }
    }

    const planFilters = conditions.length > 0
      ? "AND " + conditions.join(" AND ")
      : "";
```

- [ ] **Step 4: Run; verify all 20 tests now pass**

Run: `npx vitest run src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts`
Expected: 20 of 20 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/map/plans/\[z\]/\[x\]/\[y\]/route.ts src/app/api/map/plans/\[z\]/\[x\]/\[y\]/__tests__/route.test.ts
git commit -m "feat(map-plans): add status/fy/plan/owner filter parsing to MVT route"
```

---

## Task 5: Add response-handling and error tests for the MVT route

**Files:**
- Modify: `src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts`

> The route already returns 204/200/500 correctly — these tests lock that behavior in.

- [ ] **Step 1: Append response-handling tests**

```ts
  describe("response handling", () => {
    it("returns 204 with vector-tile content type when MVT is null", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      const res = await callGET("7", "10", "20");
      expect(res.status).toBe(204);
      expect(res.headers.get("Content-Type")).toBe("application/vnd.mapbox-vector-tile");
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    });

    it("returns 204 when MVT buffer is empty", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: Buffer.alloc(0) }] });
      const res = await callGET("7", "10", "20");
      expect(res.status).toBe(204);
    });

    it("returns 204 when rows are empty", async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const res = await callGET("7", "10", "20");
      expect(res.status).toBe(204);
    });

    it("returns 200 with binary MVT and correct headers", async () => {
      const tileData = Buffer.from("mock-tile-data");
      mockQuery.mockResolvedValue({ rows: [{ mvt: tileData }] });
      const res = await callGET("7", "10", "20");
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/vnd.mapbox-vector-tile");
      expect(res.headers.get("Content-Length")).toBe(String(tileData.length));
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    });
  });

  describe("error handling", () => {
    it("returns 500 on database query error", async () => {
      mockQuery.mockRejectedValue(new Error("DB connection failed"));
      const res = await callGET("7", "10", "20");
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Failed to generate tile");
    });

    it("returns 500 on pool.connect error", async () => {
      vi.mocked(pool.connect).mockRejectedValueOnce(new Error("Pool exhausted"));
      const res = await callGET("7", "10", "20");
      expect(res.status).toBe(500);
    });
  });

  describe("connection management", () => {
    it("releases client after successful query", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: Buffer.from("tile") }] });
      await callGET("7", "10", "20");
      expect(mockRelease).toHaveBeenCalledOnce();
    });

    it("releases client after empty result (204)", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20");
      expect(mockRelease).toHaveBeenCalledOnce();
    });

    it("releases client even when query throws", async () => {
      mockQuery.mockRejectedValue(new Error("query failed"));
      await callGET("7", "10", "20");
      expect(mockRelease).toHaveBeenCalledOnce();
    });
  });
```

- [ ] **Step 2: Run; verify all pass with no route changes needed**

Run: `npx vitest run src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts`
Expected: PASS — 30 of 30. (Route behavior already covers these via the implementation from Task 3.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/map/plans/\[z\]/\[x\]/\[y\]/__tests__/route.test.ts
git commit -m "test(map-plans): cover MVT response, error, and connection-cleanup paths"
```

---

## Task 6: Manual smoke of the MVT endpoint against local dev

**Files:** none (manual verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Wait until "Ready" prints (port 3005).

- [ ] **Step 2: Hit a tile that should contain plan polygons**

In another terminal:

```bash
curl -sI 'http://localhost:3005/api/map/plans/4/3/6.mvt' | head -5
curl -s 'http://localhost:3005/api/map/plans/4/3/6.mvt' --output /tmp/plans-4-3-6.mvt
wc -c /tmp/plans-4-3-6.mvt
```

Expected:
- `HTTP/1.1 200` (or `204` if no plans intersect this tile)
- `Content-Type: application/vnd.mapbox-vector-tile`
- A non-zero KB-scale byte count for a 200; zero bytes for a 204.

- [ ] **Step 3: Hit a tile with a filter applied**

```bash
curl -sI 'http://localhost:3005/api/map/plans/4/3/6.mvt?status=working' | head -5
```

Expected: `200` or `204` with the same content type. Server logs (in the `npm run dev` window) should show no errors.

- [ ] **Step 4: Hit an obviously empty tile (Pacific Ocean) to confirm 204**

```bash
curl -sI 'http://localhost:3005/api/map/plans/4/0/4.mvt' | head -5
```

Expected: `204 No Content`.

- [ ] **Step 5: Stop the dev server (`Ctrl-C`).**

No commit — manual verification only. If anything failed, return to Task 3/4 and debug rather than proceeding.

---

## Task 7: Add the lightweight `/api/map/plans/list` endpoint with a failing test

**Files:**
- Create: `src/app/api/map/plans/list/__tests__/route.test.ts`
- Create: `src/app/api/map/plans/list/route.ts`

> This is the companion endpoint flagged in the "Spec deviation" section. It returns the same plan-district properties as today's GeoJSON endpoint but without the `geometry` field, dramatically faster because it skips `ST_AsGeoJSON`.

- [ ] **Step 1: Write failing tests for the list endpoint**

Create `src/app/api/map/plans/list/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockQuery = vi.fn();
const mockRelease = vi.fn();
vi.mock("@/lib/db", () => ({
  default: {
    connect: vi.fn(() =>
      Promise.resolve({ query: mockQuery, release: mockRelease })
    ),
  },
}));

import { GET } from "../route";
import pool from "@/lib/db";

function buildRequest(searchParams?: Record<string, string>) {
  const url = new URL("http://localhost/api/map/plans/list");
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url);
}

const sampleRows = [
  {
    planId: "plan-1",
    planName: "Working A",
    planColor: "#7B6BA4",
    planStatus: "working",
    districtName: "Acme USD",
    leaid: "0001234",
    renewalTarget: "12.5",
    expansionTarget: null,
  },
];

describe("GET /api/map/plans/list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a flat array of rows (no FeatureCollection wrapper, no geometry)", async () => {
    mockQuery.mockResolvedValue({ rows: sampleRows });
    const res = await GET(buildRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({
      planId: "plan-1",
      planName: "Working A",
      leaid: "0001234",
    });
    expect(body[0]).not.toHaveProperty("geometry");
    expect(body[0]).not.toHaveProperty("type");
  });

  it("parses numeric targets to floats and preserves nulls", async () => {
    mockQuery.mockResolvedValue({ rows: sampleRows });
    const res = await GET(buildRequest());
    const body = await res.json();
    expect(body[0].renewalTarget).toBe(12.5);
    expect(body[0].expansionTarget).toBeNull();
  });

  it("does NOT call ST_AsGeoJSON in the SQL", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await GET(buildRequest());
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).not.toContain("ST_AsGeoJSON");
    expect(sql).not.toContain("geometry");
  });

  it("filters by status with $1", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await GET(buildRequest({ status: "working" }));
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("tp.status = $1");
    expect(params).toEqual(["working"]);
  });

  it("filters by ownerIds list", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await GET(buildRequest({ ownerIds: "u1,u2" }));
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/tp\.owner_id IN \(\$1,\$2\)/);
    expect(params).toEqual(["u1", "u2"]);
  });

  it("returns 400 on invalid fiscalYear", async () => {
    const res = await GET(buildRequest({ fiscalYear: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 on database error and releases the client", async () => {
    mockQuery.mockRejectedValue(new Error("db down"));
    const res = await GET(buildRequest());
    expect(res.status).toBe(500);
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("sets a short browser cache header", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await GET(buildRequest());
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=120");
  });
});
```

- [ ] **Step 2: Run; verify they fail (route file doesn't exist)**

Run: `npx vitest run src/app/api/map/plans/list/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Implement the list route**

Create `src/app/api/map/plans/list/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/map/plans/list
 *
 * Lightweight companion to /api/map/plans/[z]/[x]/[y].
 * Returns one row per (plan, district) pair with plan + target metadata,
 * **without** geometry. Used by:
 *   - `useCrossFilter` (extracts leaids to filter other overlays)
 *   - `<PlansTab>` (groups by planId for the sidebar list)
 *   - `SearchResults/index.tsx` tab counts
 *
 * Query params (mirror the legacy /api/map/plans endpoint):
 *   - status: comma-separated plan statuses
 *   - fiscalYear: integer FY
 *   - planId: single-plan mode
 *   - planIds: comma-separated plan UUIDs
 *   - ownerIds: comma-separated owner UUIDs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const fiscalYearRaw = searchParams.get("fiscalYear");
    const planId = searchParams.get("planId");
    const planIdsParam = searchParams.get("planIds");
    const ownerIdsParam = searchParams.get("ownerIds");

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    const placeholderFor = (val: string | number) => {
      params.push(val);
      return `$${params.length}`;
    };

    if (status) {
      const statuses = status.split(",").filter(Boolean);
      if (statuses.length === 1) {
        conditions.push(`tp.status = ${placeholderFor(statuses[0])}`);
      } else if (statuses.length > 1) {
        const ph = statuses.map((s) => placeholderFor(s)).join(",");
        conditions.push(`tp.status IN (${ph})`);
      }
    }

    if (fiscalYearRaw) {
      const fy = parseInt(fiscalYearRaw, 10);
      if (isNaN(fy)) {
        return NextResponse.json(
          { error: "Invalid fiscalYear format" },
          { status: 400 }
        );
      }
      conditions.push(`tp.fiscal_year = ${placeholderFor(fy)}`);
    }

    if (planId) {
      conditions.push(`tp.id = ${placeholderFor(planId)}`);
    }

    if (planIdsParam) {
      const ids = planIdsParam.split(",").filter(Boolean);
      if (ids.length > 0) {
        const ph = ids.map((id) => placeholderFor(id)).join(",");
        conditions.push(`tp.id IN (${ph})`);
      }
    }

    if (ownerIdsParam) {
      const ids = ownerIdsParam.split(",").filter(Boolean);
      if (ids.length > 0) {
        const ph = ids.map((id) => placeholderFor(id)).join(",");
        conditions.push(`tp.owner_id IN (${ph})`);
      }
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT
          tp.id AS "planId",
          tp.name AS "planName",
          tp.color AS "planColor",
          tp.status AS "planStatus",
          d.name AS "districtName",
          d.leaid,
          tpd.renewal_target AS "renewalTarget",
          tpd.expansion_target AS "expansionTarget"
        FROM territory_plans tp
        INNER JOIN territory_plan_districts tpd ON tp.id = tpd.plan_id
        INNER JOIN districts d ON tpd.district_leaid = d.leaid
        ${whereClause}
        `,
        params
      );

      const rows = result.rows.map((r) => ({
        planId: r.planId,
        planName: r.planName,
        planColor: r.planColor,
        planStatus: r.planStatus,
        districtName: r.districtName,
        leaid: r.leaid,
        renewalTarget: r.renewalTarget != null ? parseFloat(r.renewalTarget) : null,
        expansionTarget: r.expansionTarget != null ? parseFloat(r.expansionTarget) : null,
      }));

      return NextResponse.json(rows, {
        headers: { "Cache-Control": "public, max-age=120" },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching plan list:", error);
    return NextResponse.json(
      { error: "Failed to fetch plan list" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run; verify the list-route tests pass**

Run: `npx vitest run src/app/api/map/plans/list/__tests__/route.test.ts`
Expected: 8 of 8 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/map/plans/list/route.ts src/app/api/map/plans/list/__tests__/route.test.ts
git commit -m "feat(map-plans): add /api/map/plans/list lightweight (no-geometry) endpoint"
```

---

## Task 8: Manual smoke of the list endpoint and ship PR 1

**Files:** none (manual verification + PR creation).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Hit the list endpoint**

```bash
curl -s 'http://localhost:3005/api/map/plans/list' | jq 'length, .[0]'
```

Expected: a number and a single sample row with `planId`, `leaid`, etc. — no `geometry` field anywhere.

- [ ] **Step 3: Compare row count to the legacy endpoint**

```bash
curl -s 'http://localhost:3005/api/map/plans' | jq '.features | length'
curl -s 'http://localhost:3005/api/map/plans/list' | jq 'length'
```

Expected: identical numbers.

- [ ] **Step 4: Stop dev (`Ctrl-C`).**

- [ ] **Step 5: Final test pass on PR 1 scope**

Run: `npx vitest run src/app/api/map/plans`
Expected: ~38 PASS (tile route 30 + list route 8), 0 fail.

- [ ] **Step 6: Push and open PR 1**

```bash
git push -u origin feat/map-plans-mvt-backend
gh pr create --base main --title "feat(map-plans): add MVT tile endpoint + lightweight /list endpoint" --body "$(cat <<'EOF'
## Summary
- Adds `/api/map/plans/[z]/[x]/[y]` returning binary MVT (per design spec).
- Adds `/api/map/plans/list` returning a flat JSON array of plan-district rows without geometry — required for the cross-filter and PlansTab consumers identified during planning.
- Old `/api/map/plans` GeoJSON endpoint is left untouched and still serves the existing client; cutover happens in a separate PR.

## Spec
Docs/superpowers/specs/2026-05-01-map-plans-vector-tiles-design.md
Docs/superpowers/plans/2026-05-04-map-plans-vector-tiles.md

## Test plan
- [ ] Backend unit tests pass (`npx vitest run src/app/api/map/plans`)
- [ ] Manual: `curl /api/map/plans/4/3/6.mvt` returns `application/vnd.mapbox-vector-tile`
- [ ] Manual: `curl /api/map/plans/list | jq length` matches `/api/map/plans` row count
- [ ] No client code changed in this PR — production traffic still uses the old endpoint

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Stop here. Do not start PR 2 until PR 1 has merged to `main` and CI is green.**

---

# PR 2 — Client cutover: MVT for the map, `/list` for everyone else

> Branch: `feat/map-plans-mvt-client` (off latest `main`, **after PR 1 has merged**). All tasks in this section commit on that branch.

## Task 9: Set up the PR 2 branch

**Files:** none.

- [ ] **Step 1: Sync main and create the branch**

```bash
git fetch origin
git checkout main
git pull origin main
git checkout -b feat/map-plans-mvt-client
```

- [ ] **Step 2: Confirm baseline tests pass**

Run: `npm test -- --run`
Expected: same pre-existing baseline as PR 1 — no new failures.

---

## Task 10: Introduce `PlanFeatureRow` type and shape-tolerant `extractLeaids`

**Files:**
- Modify: `src/features/map/lib/queries.ts` (export `PlanFeatureRow`)
- Modify: `src/features/map/lib/filter-utils.ts:41` (accept either shape)
- Modify: `src/features/map/lib/__tests__/filter-utils.test.ts` (extend coverage)

> Goal: define the new row type and let `extractLeaids` accept it. We're keeping `extractLeaids` shape-tolerant rather than splitting into two functions because there's only one call site that matters and forcing a rename here ripples into useCrossFilter for no benefit.

- [ ] **Step 1: Write a failing test for the new flat-array shape**

Append to `src/features/map/lib/__tests__/filter-utils.test.ts`:

```ts
import { extractLeaids } from "../filter-utils";

describe("extractLeaids — flat-array shape", () => {
  it("extracts leaids from a flat array of plan-row objects", () => {
    const rows = [
      { leaid: "001", planId: "p1" },
      { leaid: "002", planId: "p1" },
      { leaid: "001", planId: "p2" }, // duplicate leaid across plans → still 2 unique
      { leaid: undefined, planId: "p3" }, // missing leaid → ignored
    ];
    const result = extractLeaids(rows);
    expect(result).toEqual(new Set(["001", "002"]));
  });

  it("returns an empty Set for null/undefined input", () => {
    expect(extractLeaids(null)).toEqual(new Set());
    expect(extractLeaids(undefined)).toEqual(new Set());
  });
});
```

- [ ] **Step 2: Run; verify the new tests fail**

Run: `npx vitest run src/features/map/lib/__tests__/filter-utils.test.ts`
Expected: existing tests PASS, new flat-array test FAILs because `extractLeaids` checks `geojson?.features` first.

- [ ] **Step 3: Make `extractLeaids` shape-tolerant**

Edit `src/features/map/lib/filter-utils.ts:40-49` to:

```ts
/**
 * Extract unique leaids from either:
 *   - a GeoJSON FeatureCollection (one feature per district)
 *   - a flat array of plan-row objects ({ leaid, ... })
 * Both shapes occur in this codebase: the contacts/vacancies/activities
 * overlays still use FeatureCollection, while plans switched to a flat
 * array after the MVT cutover.
 */
export function extractLeaids(input: any): Set<string> {
  const leaids = new Set<string>();
  if (!input) return leaids;

  // FeatureCollection shape
  if (Array.isArray(input.features)) {
    for (const f of input.features) {
      const id = f.properties?.leaid;
      if (id) leaids.add(id);
    }
    return leaids;
  }

  // Flat array of plan rows
  if (Array.isArray(input)) {
    for (const row of input) {
      if (row?.leaid) leaids.add(row.leaid);
    }
    return leaids;
  }

  return leaids;
}
```

- [ ] **Step 4: Add `PlanFeatureRow` type to `queries.ts`**

Open `src/features/map/lib/queries.ts` and add the following just above the `useMapPlans` definition (around line 320):

```ts
/**
 * A single (plan × district) row returned by `/api/map/plans/list` and shown
 * in the PlansTab sidebar. Replaces the GeoJSON `Feature<Geometry>` shape that
 * `useMapPlans` returned before the MVT cutover.
 */
export interface PlanFeatureRow {
  planId: string;
  planName: string;
  planColor: string;
  planStatus: string;
  districtName: string;
  leaid: string;
  renewalTarget: number | null;
  expansionTarget: number | null;
}
```

- [ ] **Step 5: Run; verify everything passes**

Run: `npx vitest run src/features/map/lib`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/map/lib/filter-utils.ts src/features/map/lib/__tests__/filter-utils.test.ts src/features/map/lib/queries.ts
git commit -m "feat(map-plans): add PlanFeatureRow type + shape-tolerant extractLeaids"
```

---

## Task 11: Rewire `useMapPlans` to call `/list` and add a tile-URL builder

**Files:**
- Modify: `src/features/map/lib/queries.ts:325-346`
- Modify (or create): `src/features/map/lib/__tests__/queries.test.ts`

> The current hook returns `FeatureCollection<Geometry>`. It now returns `PlanFeatureRow[]`. We also export a pure helper `buildMapPlansTileUrl(filters)` that the map can hand to MapLibre.

- [ ] **Step 1: Find or create the queries test file**

Run: `ls src/features/map/lib/__tests__/queries.test.ts 2>/dev/null && echo EXISTS || echo MISSING`

If missing, create `src/features/map/lib/__tests__/queries.test.ts` with the imports below; if it exists, append the new describes.

- [ ] **Step 2: Write failing tests**

```ts
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
```

- [ ] **Step 3: Run; verify they fail**

Run: `npx vitest run src/features/map/lib/__tests__/queries.test.ts`
Expected: FAIL — `buildMapPlansTileUrl` not exported.

- [ ] **Step 4: Replace `useMapPlans` and add `buildMapPlansTileUrl`**

In `src/features/map/lib/queries.ts`, replace lines 320–346 (the JSDoc + `useMapPlans` body) with:

```ts
/**
 * Stable URL pattern for the MapLibre vector source. Filters are baked into
 * the query string so MapLibre can keep its tile cache stable across pans/zooms.
 * The `{z}/{x}/{y}` placeholders are filled in by MapLibre at fetch time.
 */
export function buildMapPlansTileUrl(filters: PlanLayerFilter): string {
  const params = new URLSearchParams();
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (filters.fiscalYear) params.set("fiscalYear", String(filters.fiscalYear));
  if (filters.planIds?.length) params.set("planIds", filters.planIds.join(","));
  if (filters.ownerIds?.length) params.set("ownerIds", filters.ownerIds.join(","));
  const qs = params.toString();
  return qs
    ? `/api/map/plans/{z}/{x}/{y}.mvt?${qs}`
    : `/api/map/plans/{z}/{x}/{y}.mvt`;
}

/**
 * Fetches the lightweight plan-district list (no geometry) used by the
 * PlansTab sidebar and the cross-filter. The map itself uses MVT vector
 * tiles via `buildMapPlansTileUrl` — not this hook.
 */
export function useMapPlans(
  filters: PlanLayerFilter,
  enabled: boolean,
) {
  const params = new URLSearchParams();
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (filters.fiscalYear) params.set("fiscalYear", String(filters.fiscalYear));
  if (filters.planIds?.length) params.set("planIds", filters.planIds.join(","));
  if (filters.ownerIds?.length) params.set("ownerIds", filters.ownerIds.join(","));
  const qs = params.toString();
  const queryString = qs ? `?${qs}` : "";

  return useQuery({
    queryKey: ["mapPlans", queryString],
    queryFn: () =>
      fetchJson<PlanFeatureRow[]>(`${API_BASE}/map/plans/list${queryString}`),
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
```

(`PlanFeatureRow` was added in Task 10. `fetchJson` and `API_BASE` already exist higher in the file — reuse them.)

- [ ] **Step 5: Run; verify all `queries.ts` tests pass**

Run: `npx vitest run src/features/map/lib/__tests__/queries.test.ts`
Expected: PASS — all 4 builder tests.

- [ ] **Step 6: Commit**

```bash
git add src/features/map/lib/queries.ts src/features/map/lib/__tests__/queries.test.ts
git commit -m "feat(map-plans): rewire useMapPlans to /list, export tile-URL builder"
```

---

## Task 12: Update store typing for `overlayGeoJSON.plans`

**Files:**
- Modify: `src/features/map/lib/store.ts:286, 450, 604, 1211–1213`

> The store still types `overlayGeoJSON.plans` as `FeatureCollection | null`. Change it to `PlanFeatureRow[] | null` so `setOverlayGeoJSON("plans", rows)` typechecks. Other overlays (contacts/vacancies/activities) stay GeoJSON.

- [ ] **Step 1: Find the existing `overlayGeoJSON` shape**

Run: `grep -n "overlayGeoJSON" src/features/map/lib/store.ts`
Expected: lines around 286, 450, 604, 1211 (per file map).

- [ ] **Step 2: Update the type definition (around line 286)**

Look for the declaration like:

```ts
overlayGeoJSON: {
  contacts: FeatureCollection | null;
  vacancies: FeatureCollection | null;
  activities: FeatureCollection | null;
  plans: FeatureCollection | null;
};
```

Change `plans` to `PlanFeatureRow[] | null`. Add `import type { PlanFeatureRow } from "./queries";` at the top of `store.ts` if not already imported.

- [ ] **Step 3: Update the `setOverlayGeoJSON` setter signature (around line 450)**

Find:

```ts
setOverlayGeoJSON: (
  layer: keyof MapV2State["overlayGeoJSON"],
  data: FeatureCollection | null,
) => void;
```

Change to:

```ts
setOverlayGeoJSON: <K extends keyof MapV2State["overlayGeoJSON"]>(
  layer: K,
  data: MapV2State["overlayGeoJSON"][K],
) => void;
```

This generic preserves per-layer type discrimination: `setOverlayGeoJSON("plans", x)` requires `x: PlanFeatureRow[] | null`, while the others require `FeatureCollection | null`.

- [ ] **Step 4: Update the implementation around line 1211**

The implementation body:

```ts
setOverlayGeoJSON: (layer, data) =>
  set((s) => ({
    overlayGeoJSON: { ...s.overlayGeoJSON, [layer]: data },
  })),
```

does not need to change at runtime — just confirm it still compiles against the new generic.

- [ ] **Step 5: Update the initial state around line 604**

Find:

```ts
overlayGeoJSON: {
  contacts: null,
  vacancies: null,
  activities: null,
  plans: null,
},
```

No value change needed — `null` satisfies both old and new types.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: any errors flagged here are downstream consumers (PlansTabContainer, useCrossFilter, SearchResults/index.tsx) that will be fixed in Tasks 13–15. Note them but proceed.

- [ ] **Step 7: Commit**

```bash
git add src/features/map/lib/store.ts
git commit -m "refactor(map-plans): retype overlayGeoJSON.plans as PlanFeatureRow[]"
```

---

## Task 13: Update `useCrossFilter` to consume the new shape

**Files:**
- Modify: `src/features/map/lib/useCrossFilter.ts:15-39`

- [ ] **Step 1: Loosen the `OverlayData.plansGeoJSON` type**

In `src/features/map/lib/useCrossFilter.ts`, change the interface (around line 15):

```ts
import type { PlanFeatureRow } from "./queries";

interface OverlayData {
  plansGeoJSON: PlanFeatureRow[] | null;
  contactsGeoJSON: any;
  vacanciesGeoJSON: any;
  activitiesGeoJSON: any;
}
```

The variable name `plansGeoJSON` is now mildly inaccurate but renaming ripples too far for this PR — leave it.

- [ ] **Step 2: Verify `extractLeaids(data.plansGeoJSON)` still works**

The shape-tolerant `extractLeaids` from Task 10 already handles arrays. No change needed at line 37.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors at this hook's call sites in `MapV2Container.tsx` (and possibly `SearchResults/index.tsx`) — fixed in the next two tasks.

- [ ] **Step 4: Commit**

```bash
git add src/features/map/lib/useCrossFilter.ts
git commit -m "refactor(map-plans): retype useCrossFilter plansGeoJSON as PlanFeatureRow[]"
```

---

## Task 14: Update `PlansTabContainer`, `PlansTab`, and `PlanCard`

**Files:**
- Modify: `src/features/map/components/SearchResults/PlansTabContainer.tsx`
- Modify: `src/features/map/components/SearchResults/PlansTab.tsx`
- Modify: `src/features/map/components/SearchResults/PlanCard.tsx`

- [ ] **Step 1: Update `PlansTabContainer.tsx`**

Replace the file contents with:

```tsx
"use client";

import { useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useMapPlans } from "@/features/map/lib/queries";
import PlansTab from "./PlansTab";

export default function PlansTabContainer() {
  const filters = useMapV2Store((s) => s.layerFilters.plans);
  const setOverlayGeoJSON = useMapV2Store((s) => s.setOverlayGeoJSON);

  const { data, isLoading } = useMapPlans(filters, true);

  // Report rows to store for cross-filtering; clear on unmount.
  useEffect(() => {
    setOverlayGeoJSON("plans", data ?? null);
    return () => setOverlayGeoJSON("plans", null);
  }, [data, setOverlayGeoJSON]);

  return <PlansTab data={data} isLoading={isLoading} />;
}
```

(Removed the `FeatureCollection<Geometry>` import — no longer needed.)

- [ ] **Step 2: Update `PlansTab.tsx`**

Replace the typing block at the top (lines 1–49 approximately) with:

```tsx
"use client";

import { useState, useMemo, useCallback } from "react";

import type { PlanFeatureRow } from "@/features/map/lib/queries";
import PlanCard from "./PlanCard";
import PlanDetailModal from "./PlanDetailModal";

interface PlansTabProps {
  data: PlanFeatureRow[] | undefined;
  isLoading: boolean;
}

/** Skeleton placeholder cards shown during loading. */
function SkeletonCards() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-[#E2DEEC] animate-pulse">
          <div className="space-y-2">
            <div className="h-3.5 bg-[#f0edf5] rounded w-3/4" />
            <div className="h-2.5 bg-[#f0edf5] rounded w-1/2" />
            <div className="flex gap-2">
              <div className="h-2.5 bg-[#f0edf5] rounded w-20" />
              <div className="h-2.5 bg-[#f0edf5] rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PlansTab({ data, isLoading }: PlansTabProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Group rows by planId; show one card per unique plan.
  const uniquePlans = useMemo<PlanFeatureRow[]>(() => {
    if (!data?.length) return [];
    const seen = new Map<string, PlanFeatureRow>();
    for (const row of data) {
      if (row.planId && !seen.has(row.planId)) {
        seen.set(row.planId, row);
      }
    }
    return [...seen.values()];
  }, [data]);

  const planIds = useMemo(() => uniquePlans.map((r) => r.planId), [uniquePlans]);
  const currentIndex = selectedPlanId ? planIds.indexOf(selectedPlanId) : -1;

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setSelectedPlanId(planIds[currentIndex - 1]);
  }, [currentIndex, planIds]);

  const handleNext = useCallback(() => {
    if (currentIndex < planIds.length - 1) setSelectedPlanId(planIds[currentIndex + 1]);
  }, [currentIndex, planIds]);
```

The rest of the component (the early returns + the JSX) only needs:

- the `uniquePlans.map(...)` block to pass `row` (was `feature`) into `<PlanCard row={row} ...>` (key changes from `feature.properties?.planId ?? feature.id` to `row.planId`).
- `<PlanCard onClick={() => setSelectedPlanId(row.planId)}>` (instead of `feature.properties?.planId`).

Apply that JSX update too.

- [ ] **Step 3: Update `PlanCard.tsx`**

Open `src/features/map/components/SearchResults/PlanCard.tsx`. Two changes:

(a) Replace the imports + props block (lines 1–8):

```tsx
"use client";

import type { PlanFeatureRow } from "@/features/map/lib/queries";

interface PlanCardProps {
  row: PlanFeatureRow;
  onClick?: () => void;
}
```

(b) Replace the destructure + body header (lines 21–22):

```tsx
export default function PlanCard({ row, onClick }: PlanCardProps) {
  const p = row;
```

The remaining destructured reads (`p.planName`, `p.planColor`, `p.planStatus`, `p.districtName`, `p.renewalTarget`, `p.expansionTarget` on lines 23–28) keep working unchanged — `PlanFeatureRow` exposes the same fields.

`PlanCard` does not read `feature.geometry` anywhere, so no orphan reads to clean up.

- [ ] **Step 4: Run typecheck and component tests**

Run: `npx tsc --noEmit && npx vitest run src/features/map/components/SearchResults`
Expected: 0 type errors in these three files; any failing component test should be updated to pass `PlanFeatureRow[]` instead of FeatureCollections.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/components/SearchResults/PlansTabContainer.tsx src/features/map/components/SearchResults/PlansTab.tsx src/features/map/components/SearchResults/PlanCard.tsx
git commit -m "refactor(map-plans): switch PlansTab/PlanCard to PlanFeatureRow rows"
```

---

## Task 15: Update `SearchResults/index.tsx` tab counts

**Files:**
- Modify: `src/features/map/components/SearchResults/index.tsx:462-468`

- [ ] **Step 1: Replace the FeatureCollection iteration**

Find the block:

```tsx
if (activeLayers.has("plans") && overlayGeoJSON.plans) {
  const planIds = new Set<string>();
  for (const f of overlayGeoJSON.plans.features) {
    const pid = f.properties?.planId;
    if (pid) planIds.add(pid);
  }
  counts.plans = planIds.size;
}
```

Change to:

```tsx
if (activeLayers.has("plans") && overlayGeoJSON.plans) {
  const planIds = new Set<string>();
  for (const row of overlayGeoJSON.plans) {
    if (row.planId) planIds.add(row.planId);
  }
  counts.plans = planIds.size;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `index.tsx`. The remaining errors should now only live in `MapV2Container.tsx` (Task 16).

- [ ] **Step 3: Commit**

```bash
git add src/features/map/components/SearchResults/index.tsx
git commit -m "refactor(map-plans): iterate flat plan rows for SearchResults tab counts"
```

---

## Task 16: Switch the MapLibre source from GeoJSON to vector tiles

**Files:**
- Modify: `src/features/map/lib/pin-layers.ts:242-266` (`getPlanLayers`)
- Modify: `src/features/map/components/MapV2Container.tsx:847` (source registration) and `:308-318` (the `setData` effect)
- Modify: `src/features/map/components/MapV2Container.tsx:244-247` (replace the `useMapPlans` call with the URL builder for the map source)
- Modify: `src/features/map/lib/__tests__/pin-layers.test.ts` (assert source-layer presence)

- [ ] **Step 1: Add `source-layer: 'plans'` to the layer specs and write a failing test**

In `src/features/map/lib/__tests__/pin-layers.test.ts`, append:

```ts
import { getPlanLayers } from "../pin-layers";

describe("getPlanLayers — vector source-layer", () => {
  it("sets source-layer to 'plans' on both fill and outline specs", () => {
    const layers = getPlanLayers();
    for (const layer of layers) {
      expect((layer as any)["source-layer"]).toBe("plans");
    }
  });
});
```

Run: `npx vitest run src/features/map/lib/__tests__/pin-layers.test.ts`
Expected: FAIL — current specs don't include `source-layer`.

- [ ] **Step 2: Update `getPlanLayers` in `src/features/map/lib/pin-layers.ts`**

Replace the function body with:

```ts
export function getPlanLayers(): LayerSpecification[] {
  return [
    {
      id: PLANS_FILL_LAYER,
      type: "fill",
      source: PLANS_SOURCE,
      "source-layer": "plans",
      paint: {
        "fill-color": ["coalesce", ["get", "planColor"], "#7B6BA4"],
        "fill-opacity": 0.08,
      },
    } satisfies LayerSpecification,
    {
      id: PLANS_OUTLINE_LAYER,
      type: "line",
      source: PLANS_SOURCE,
      "source-layer": "plans",
      paint: {
        "line-color": ["coalesce", ["get", "planColor"], "#7B6BA4"],
        "line-width": 2.5,
        "line-opacity": 0.9,
      },
    } satisfies LayerSpecification,
  ];
}
```

Run: `npx vitest run src/features/map/lib/__tests__/pin-layers.test.ts`
Expected: PASS.

- [ ] **Step 3: Replace the GeoJSON source registration in `MapV2Container.tsx`**

Find line 847:

```tsx
map.current.addSource(PLANS_SOURCE, createGeoJSONSource());
```

Replace with:

```tsx
map.current.addSource(PLANS_SOURCE, {
  type: "vector",
  tiles: [new URL(buildMapPlansTileUrl(layerFilters.plans), window.location.origin).toString()],
  minzoom: 0,
  maxzoom: 22,
});
```

Add the import at the top of the file:

```tsx
import { buildMapPlansTileUrl } from "@/features/map/lib/queries";
```

`layerFilters` is already in scope at this point in the component — verify by looking 30–50 lines above.

- [ ] **Step 4: Replace the `setData` effect with a `setTiles` effect**

Find lines 308–318:

```tsx
// Push overlay plans data to map source
useEffect(() => {
  if (!map.current || !mapReady) return;
  const source = map.current.getSource(PLANS_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (!source) return;
  if (plansGeoJSON && plansEnabled) {
    source.setData(plansGeoJSON);
  } else {
    source.setData({ type: "FeatureCollection", features: [] });
  }
}, [plansGeoJSON, plansEnabled, mapReady]);
```

Replace with:

```tsx
// Update vector tile URL when plan filters change.
const plansTileUrl = useMemo(
  () =>
    new URL(
      buildMapPlansTileUrl(layerFilters.plans),
      window.location.origin,
    ).toString(),
  [layerFilters.plans],
);

useEffect(() => {
  if (!map.current || !mapReady) return;
  const source = map.current.getSource(PLANS_SOURCE) as maplibregl.VectorTileSource | undefined;
  if (!source) return;
  source.setTiles([plansTileUrl]);
}, [plansTileUrl, mapReady]);
```

Add `useMemo` to the React import line at the top of the file if not already imported.

- [ ] **Step 5: Rename the `useMapPlans` data variable for clarity**

The hook now returns `PlanFeatureRow[]`. Rename the destructured variable so reads downstream (cross-filter, etc.) line up with the new shape. Preserve the existing `enabled: plansEnabled` so we don't accidentally widen fetch scope vs. main.

Find:

```tsx
const plansEnabled = activeLayers.has("plans") && mapReady;
const { data: plansGeoJSON, isLoading: plansLoading } = useMapPlans(
  layerFilters.plans, plansEnabled,
);
```

Change to:

```tsx
const plansEnabled = activeLayers.has("plans") && mapReady;
const { data: plansRows, isLoading: plansLoading } = useMapPlans(
  layerFilters.plans, plansEnabled,
);
```

Then update the `useCrossFilter` call (around line 262):

```tsx
const { filterOverlayGeoJSON } = useCrossFilter({
  plansGeoJSON: plansRows ?? null,
  contactsGeoJSON,
  vacanciesGeoJSON,
  activitiesGeoJSON,
});
```

(Note `plansRows ?? null` — the cross-filter now expects `PlanFeatureRow[] | null`.)

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors. If MapLibre's TypeScript types complain about `VectorTileSource`, fall back to `as maplibregl.Source & { setTiles?: (urls: string[]) => void }` and gate the call with `if (typeof source.setTiles === "function")`.

- [ ] **Step 7: Run unit tests**

Run: `npx vitest run src/features/map`
Expected: all PASS (or only pre-existing baseline failures unrelated to this change).

- [ ] **Step 8: Commit**

```bash
git add src/features/map/lib/pin-layers.ts src/features/map/lib/__tests__/pin-layers.test.ts src/features/map/components/MapV2Container.tsx
git commit -m "feat(map-plans): switch plan layer to vector tiles, drive list via /list"
```

---

## Task 17: Manual smoke and ship PR 2

**Files:** none (manual + PR creation).

- [ ] **Step 1: Start dev**

Run: `npm run dev`

- [ ] **Step 2: Open the map and verify plans render**

Visit `http://localhost:3005`. Toggle the Plans layer on. Pan and zoom around the country.

Expected:
- Plan polygons appear progressively as tiles load (no whole-world freeze).
- Network tab shows individual `/api/map/plans/{z}/{x}/{y}.mvt` requests, each KB-scale.
- Network tab also shows a single `/api/map/plans/list` JSON request (drives the sidebar + cross-filter).
- Old `/api/map/plans` is **not** called.

- [ ] **Step 3: Toggle filters**

Change owner, status, and fiscal-year filters. Expected:
- Tile URL updates (look at network tab — filter values appear in the query string).
- Polygons repaint without page hang.
- The PlansTab sidebar updates accordingly.

- [ ] **Step 4: Cross-filter sanity check**

With Plans active and a status filter set, ensure the contacts/vacancies/activities overlays only show points inside the filtered plan-district set.

- [ ] **Step 5: Edge cases**

- Empty filter combos (no plans match): map should clear; sidebar shows "No plans in the current view"; no errors in console.
- Zoom to street level (z 14+): polygon edges should be sharp.
- Zoom out to country (z 4): polygons should still be present, just simplified.

- [ ] **Step 6: Stop dev (`Ctrl-C`).**

- [ ] **Step 7: Final test pass**

Run: `npm test -- --run`
Expected: same baseline as start of PR 2 (no new failures).

- [ ] **Step 8: Push and open PR 2**

```bash
git push -u origin feat/map-plans-mvt-client
gh pr create --base main --title "feat(map-plans): cut client over to MVT vector tiles + /list endpoint" --body "$(cat <<'EOF'
## Summary
- MapLibre plan layer now uses a vector source pointing at `/api/map/plans/{z}/{x}/{y}.mvt`. Filter changes call `source.setTiles(...)` rather than refetching the world.
- `useMapPlans` now hits the lightweight `/api/map/plans/list` and returns `PlanFeatureRow[]`. PlansTab + cross-filter + tab counts all updated for the new shape.
- The legacy `/api/map/plans` GeoJSON endpoint is still in the codebase and is the one-line revert path if anything blows up — it's deleted in a follow-up PR after a soak.

## Spec / Plan
- Docs/superpowers/specs/2026-05-01-map-plans-vector-tiles-design.md
- Docs/superpowers/plans/2026-05-04-map-plans-vector-tiles.md

## Test plan
- [ ] Map: pan/zoom shows progressive tile load, no full-world freeze
- [ ] Network: tile responses are KB-scale; one JSON list call drives sidebar
- [ ] Filters: owner/status/fiscal-year all change tile URL and repaint
- [ ] Cross-filter: contacts/vacancies/activities respect plan filter
- [ ] Empty filter combo: clean clear, no errors
- [ ] `/api/map/plans` (legacy) NOT called from the page

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Stop here. Do not start PR 3 until PR 2 has merged and has soaked in production for ~1 week with no issues.**

---

# PR 3 — Cleanup: delete the legacy GeoJSON endpoint

> Branch: `chore/map-plans-mvt-remove-legacy` (off latest `main`, **at least one week after PR 2 merged**, with confirmation from production telemetry that `/api/map/plans` GeoJSON is no longer hit).

## Task 18: Confirm zero traffic to the legacy endpoint

**Files:** none (manual check).

- [ ] **Step 1: Check production logs / Vercel analytics for `/api/map/plans` (without the `/[z]/[x]/[y]` or `/list` suffix) over the last 7 days.**

Expected: zero hits. If non-zero, identify the caller and stop — don't ship PR 3 until that caller is also off the legacy endpoint.

- [ ] **Step 2: Grep the codebase for any remaining client-side reference to the bare endpoint**

Run: `git grep -n "api/map/plans" -- ':!docs/' ':!src/app/api/map/plans/list' ':!src/app/api/map/plans/\\[z\\]'`
Expected: only the legacy `route.ts` itself (which is what we're deleting).

---

## Task 19: Delete the legacy endpoint

**Files:**
- Delete: `src/app/api/map/plans/route.ts`

- [ ] **Step 1: Sync main and create the branch**

```bash
git fetch origin
git checkout main
git pull origin main
git checkout -b chore/map-plans-mvt-remove-legacy
```

- [ ] **Step 2: Remove the file**

```bash
git rm src/app/api/map/plans/route.ts
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test -- --run`
Expected: same baseline as before. No tests should fail because of the removal — if any do, the test was either testing the legacy endpoint (which should also be deleted) or a stale client reference (which was missed in PR 2 — abort, return to PR 2).

- [ ] **Step 4: Build to confirm Next.js doesn't choke**

Run: `npm run build`
Expected: clean build. The directory `src/app/api/map/plans/` will still contain `list/` and `[z]/[x]/[y]/` — that's fine.

- [ ] **Step 5: Commit, push, open PR**

```bash
git add -A
git commit -m "chore(map-plans): remove legacy GeoJSON /api/map/plans endpoint"
git push -u origin chore/map-plans-mvt-remove-legacy
gh pr create --base main --title "chore(map-plans): remove legacy GeoJSON endpoint" --body "$(cat <<'EOF'
## Summary
- Deletes `src/app/api/map/plans/route.ts`. All callers were migrated in the previous PR; production telemetry confirms zero traffic over the past week.

## Spec / Plan
- Docs/superpowers/specs/2026-05-01-map-plans-vector-tiles-design.md
- Docs/superpowers/plans/2026-05-04-map-plans-vector-tiles.md

## Test plan
- [ ] `npm run build` clean
- [ ] `npm test -- --run` baseline unchanged
- [ ] Production telemetry confirmed zero hits to `/api/map/plans` (bare path) over 7 days

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Done

After PR 3 merges, the design spec's goal is achieved: plan polygon rendering scales with viewport, not row count; cold render time on the unfiltered case drops from ~60 s to <500 ms per visible tile.

Optional follow-ups (each is its own ticket — explicitly **out of scope** per the spec):

- Geometry deduplication: one feature per district with `plan_ids: text[]` instead of one per (plan, district) pair.
- Pool-acquisition latency investigation (~190 ms on every API route).
- Other slow endpoints (`/api/leaderboard 5.6s`, `/api/tasks 5.4s`, etc.).
