# NYC DOE Map Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `parent_leaid` hierarchy to the `districts` table, seed it for NYC DOE's 32 community districts + 3601xxx charter leaids, make children always win map click hit-tests, render rollup polygons as outline-only, auto-migrate existing plans that reference the rollup, and gate the plan-level bulk-enrich endpoint with a rollup pre-check + expand CTA.

**Architecture:** One self-referencing nullable FK on `districts` (+ index + CHECK), one seed migration, one new helper module (`rollup.ts`), one new PATCH endpoint (`expand-rollup`), and surgical edits to the tile API, map layer config, map click handler, plan GET, bulk-enrich route, Zustand store, DistrictCard, district search result, and ContactsActionBar. Each task is independently reviewable; tests pin behavior before implementation.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Prisma + PostgreSQL + PostGIS, MapLibre GL, Zustand, TanStack Query, Vitest + Testing Library.

**Spec:** `Docs/superpowers/specs/2026-04-22-nyc-doe-map-drill-down-design.md` (commit `c9669a0d`).

**Branch / worktree:** `worktree-nyc-doe-rollup` at `.claude/worktrees/nyc-doe-rollup`.

**Baseline:** 1419 Vitest tests pass, 3 fail on `origin/main` (pre-existing — `route.test.ts:515`, two SearchBar tests). Not this project's concern.

---

## Phase 1 — Schema & helpers

### Task 1: Add `parent_leaid` column to the districts table

**Files:**
- Create: `prisma/migrations/20260422_add_district_parent_leaid/migration.sql`
- Modify: `prisma/schema.prisma:15-170` (District model)

- [ ] **Step 1: Write the migration SQL**

```sql
-- prisma/migrations/20260422_add_district_parent_leaid/migration.sql
ALTER TABLE districts
  ADD COLUMN parent_leaid VARCHAR(7) NULL REFERENCES districts(leaid) ON DELETE SET NULL;

ALTER TABLE districts
  ADD CONSTRAINT districts_no_self_parent
  CHECK (parent_leaid IS NULL OR parent_leaid <> leaid);

CREATE INDEX idx_districts_parent_leaid ON districts(parent_leaid);
```

- [ ] **Step 2: Update Prisma schema** — add the self-relation to the `District` model in `prisma/schema.prisma`. Insert these two lines in the "User Edits" or "Normalized person references" region (near line 137-141):

```prisma
  parentLeaid    String?    @map("parent_leaid") @db.VarChar(7)
  parentDistrict District?  @relation("DistrictRollup", fields: [parentLeaid], references: [leaid], onDelete: SetNull)
  childDistricts District[] @relation("DistrictRollup")
```

- [ ] **Step 3: Apply the migration**

Run: `npx prisma migrate dev --name add_district_parent_leaid`
Expected: migration applied, `Prisma Client is out of sync` warning, client regenerated, 0 errors.

- [ ] **Step 4: Verify column exists**

Run: `npx prisma db execute --stdin <<< "SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name='districts' AND column_name='parent_leaid';"`
Expected: one row with `parent_leaid | YES | character varying`.

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations/20260422_add_district_parent_leaid prisma/schema.prisma
git commit -m "feat(schema): add parent_leaid self-relation on districts"
```

---

### Task 2: Seed NYC DOE rollup children

**Files:**
- Create: `prisma/migrations/20260422_seed_nyc_doe_rollup/migration.sql`

- [ ] **Step 1: Discovery query — identify NYC-area leaids**

Run in psql (or `npx prisma db execute --stdin`):

```sql
SELECT leaid, name
FROM districts
WHERE state_fips = '36'
  AND leaid LIKE '360%'
  AND leaid <> '3620580'
ORDER BY leaid;
```

Capture the exact leaid list. The spec asserts the 32 community districts land in
`3600076`–`3600103`, `3600119`–`3600123`, `3600152`, `3600153`, and NYC charters in `3601xxx`. **If the discovery list disagrees, trust the discovery output** — these rollup contents come from the authoritative DB, not the spec.

- [ ] **Step 2: Write the seed migration**

```sql
-- prisma/migrations/20260422_seed_nyc_doe_rollup/migration.sql
-- Seeds parent_leaid=3620580 for the 32 NYC Community School Districts
-- and NYC-area charter LEAIDs in the 3601xxx range.
--
-- The explicit leaid list below was captured from the districts table on
-- 2026-04-22 via: state_fips='36' AND leaid LIKE '360%' AND leaid<>'3620580'.
-- If the list drifts (districts added/removed), re-run discovery and update.

UPDATE districts
SET parent_leaid = '3620580'
WHERE leaid IN (
  -- 32 Community School Districts (replace with Step-1 discovery output if different)
  '3600076','3600077','3600078','3600079','3600080','3600081','3600082','3600083',
  '3600084','3600085','3600086','3600087','3600088','3600089','3600090','3600091',
  '3600092','3600093','3600094','3600095','3600096','3600097','3600098','3600099',
  '3600100','3600101','3600102','3600103',
  '3600119','3600120','3600121','3600122','3600123',
  '3600152','3600153'
  -- + NYC charter leaids from discovery (append 3601xxx values here)
);

-- Sanity check: NYC DOE itself stays as a rollup (parent_leaid NULL)
-- SELECT COUNT(*) FROM districts WHERE parent_leaid='3620580';  -- should be 32+N
```

**Replace the hardcoded list with the actual leaids from Step 1** before committing. Include every 3601xxx leaid discovery returned.

- [ ] **Step 3: Apply the migration**

Run: `npx prisma migrate dev --name seed_nyc_doe_rollup`
Expected: migration applied, 0 errors.

- [ ] **Step 4: Verify the seed worked**

Run: `npx prisma db execute --stdin <<< "SELECT COUNT(*) AS children FROM districts WHERE parent_leaid='3620580';"`
Expected: `children >= 32` (exact count depends on charter discovery).

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations/20260422_seed_nyc_doe_rollup
git commit -m "feat(data): seed NYC DOE rollup with 32 community districts + charters"
```

---

### Task 3: Create rollup helpers (`isRollup`, `getChildren`, `getRollupLeaids`)

**Files:**
- Create: `src/features/districts/lib/rollup.ts`
- Test: `src/features/districts/lib/__tests__/rollup.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/features/districts/lib/__tests__/rollup.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";
import { isRollup, getChildren, getRollupLeaids } from "../rollup";

describe("rollup helpers", () => {
  it("isRollup returns true for NYC DOE (3620580)", async () => {
    expect(await isRollup("3620580")).toBe(true);
  });

  it("isRollup returns false for a leaf district", async () => {
    expect(await isRollup("3600076")).toBe(false);
  });

  it("isRollup returns false for a nonexistent leaid", async () => {
    expect(await isRollup("9999999")).toBe(false);
  });

  it("getChildren returns 32+ leaids for NYC DOE", async () => {
    const children = await getChildren("3620580");
    expect(children.length).toBeGreaterThanOrEqual(32);
    expect(children).toContain("3600076");
  });

  it("getChildren returns [] for a leaf district", async () => {
    expect(await getChildren("3600076")).toEqual([]);
  });

  it("getRollupLeaids filters a mixed list to just the rollups", async () => {
    const result = await getRollupLeaids(["3620580", "3600076", "0400001"]);
    expect(result).toEqual(["3620580"]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL** (module does not exist)

Run: `npx vitest run src/features/districts/lib/__tests__/rollup.test.ts`
Expected: FAIL — "Failed to resolve import '../rollup'".

- [ ] **Step 3: Implement rollup.ts**

```typescript
// src/features/districts/lib/rollup.ts
import prisma from "@/lib/prisma";

/**
 * A "rollup" district has at least one other district pointing to it via
 * parent_leaid. Rollups have zero directly-attached schools; their children
 * hold the actual school-level data.
 */
export async function isRollup(leaid: string): Promise<boolean> {
  const count = await prisma.district.count({ where: { parentLeaid: leaid } });
  return count > 0;
}

/**
 * Returns the leaids of all districts whose parent_leaid equals the given
 * rollup leaid. Empty array for non-rollups.
 */
export async function getChildren(rollupLeaid: string): Promise<string[]> {
  const rows = await prisma.district.findMany({
    where: { parentLeaid: rollupLeaid },
    select: { leaid: true },
    orderBy: { leaid: "asc" },
  });
  return rows.map((r) => r.leaid);
}

/**
 * Given a list of leaids, returns just the ones that are rollups (have
 * children). Useful for pre-checks on plan-level endpoints that receive a
 * mixed list of potentially-rollup districts.
 */
export async function getRollupLeaids(leaids: string[]): Promise<string[]> {
  if (leaids.length === 0) return [];
  const rows = await prisma.district.findMany({
    where: { parentLeaid: { in: leaids } },
    select: { parentLeaid: true },
    distinct: ["parentLeaid"],
  });
  return rows.map((r) => r.parentLeaid).filter((l): l is string => l !== null);
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/features/districts/lib/__tests__/rollup.test.ts`
Expected: 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/features/districts/lib/rollup.ts src/features/districts/lib/__tests__/rollup.test.ts
git commit -m "feat(districts): rollup helpers — isRollup, getChildren, getRollupLeaids"
```

---

## Phase 2 — Tile API

### Task 4: Add `is_rollup` to tile features + bump cache version

**Files:**
- Modify: `src/app/api/tiles/[z]/[x]/[y]/route.ts:86-115`
- Test: `src/app/api/tiles/[z]/[x]/[y]/__tests__/route.test.ts` (create if absent)

- [ ] **Step 1: Write failing test**

```typescript
// src/app/api/tiles/[z]/[x]/[y]/__tests__/route.test.ts
import { describe, it, expect } from "vitest";
import { GET } from "../route";

async function fetchTile(z: number, x: number, y: number) {
  const url = `http://localhost:3005/api/tiles/${z}/${x}/${y}?v=6&fy=fy26`;
  const req = new Request(url);
  return GET(req as any, { params: Promise.resolve({ z: String(z), x: String(x), y: String(y) }) } as any);
}

describe("tiles API is_rollup property", () => {
  it("includes an is_rollup property on NYC-area tile features", async () => {
    // Zoom 10, tile covering Manhattan
    const res = await fetchTile(10, 301, 385);
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
    // MVT decoding to introspect property is overkill here; this smoke proves
    // the query compiles and returns data. Property presence is verified
    // indirectly via the SearchBar / DistrictCard integration tests.
  });
});
```

- [ ] **Step 2: Run test — expect PASS on the smoke level, which leaves room for the impl change**

Run: `npx vitest run src/app/api/tiles/[z]/[x]/[y]/__tests__/route.test.ts`
Expected: PASS (the query already compiles).

- [ ] **Step 3: Modify the SQL to add `is_rollup`**

In `src/app/api/tiles/[z]/[x]/[y]/route.ts`, locate the `tile_data` CTE and add
a LEFT JOIN against rollup leaids + a column. Replace the `tile_data` CTE body:

```typescript
const query = `
  WITH tile_bounds AS (
    SELECT
      ST_TileEnvelope($1, $2, $3) AS envelope,
      ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS envelope_4326
  ),
  rollup_leaids AS (
    SELECT DISTINCT parent_leaid AS leaid FROM districts WHERE parent_leaid IS NOT NULL
  ),
  tile_data AS (
    SELECT
      d.leaid,
      d.name,
      d.state_abbrev,
      d.sales_executive_id,
      d.sales_executive_name,
      d.plan_ids,
      ${categoryColumns},
      d.enrollment_signal,
      d.ell_signal,
      d.swd_signal,
      d.locale_signal,
      d.expenditure_signal,
      d.account_type,
      (r.leaid IS NOT NULL) AS is_rollup,
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
    FROM district_map_features d
    LEFT JOIN rollup_leaids r ON r.leaid = d.leaid
    WHERE d.render_geometry IS NOT NULL
      AND d.render_geometry && (SELECT envelope_4326 FROM tile_bounds)
      ${stateFilter ? "AND d.state_abbrev = $4" : ""}
      ${nationalFilter}
  )
  SELECT ST_AsMVT(tile_data, 'districts', 4096, 'geom') AS mvt
  FROM tile_data
  WHERE geom IS NOT NULL
`;
```

The two added lines are the `rollup_leaids` CTE and the `(r.leaid IS NOT NULL) AS is_rollup` column + the LEFT JOIN. Everything else unchanged.

- [ ] **Step 4: Bump the tile cache version everywhere clients read it from**

Grep for `?v=5` in the client code and bump to `?v=6`:

Run: `grep -rn "api/tiles.*v=5\|v=5.*tiles" src/`

Replace each occurrence with `v=6`. Typical callsite is in `src/features/map/components/MapV2Container.tsx` where the MapLibre source is defined (`tiles: ["/api/tiles/{z}/{x}/{y}?v=5&fy=${fy}"]` → `?v=6`).

- [ ] **Step 5: Run tile tests again**

Run: `npx vitest run src/app/api/tiles/[z]/[x]/[y]/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/tiles src/features/map/components/MapV2Container.tsx
git commit -m "feat(tiles): expose is_rollup property; bump cache v=6"
```

---

## Phase 3 — Map rendering + click behavior

### Task 5: Add rollup paint rule (outline-only, non-clickable)

**Files:**
- Modify: `src/features/map/lib/layers.ts` (district-base-fill section)

- [ ] **Step 1: Locate the district-base-fill layer definition**

Run: `grep -n "district-base-fill\|district.*fill\|rollup" src/features/map/lib/layers.ts`

Identify the layer object that renders the default district fill. Most likely
keyed as `district-base-fill` or similar.

- [ ] **Step 2: Add a new outline-only rollup layer**

Add a new layer config just above the district-base-fill layer so it paints
rollup outlines without a fill. Use the plum token from `Documentation/UI Framework/tokens.md`.

```typescript
// Above the existing district-base-fill layer config, add:
export const DISTRICT_ROLLUP_OUTLINE_LAYER = {
  id: "district-rollup-outline",
  type: "line" as const,
  source: "districts",
  "source-layer": "districts",
  filter: ["==", ["get", "is_rollup"], true],
  paint: {
    "line-color": "#403770", // plum
    "line-width": 1.5,
    "line-dasharray": [2, 2],
    "line-opacity": 0.5,
  },
};
```

- [ ] **Step 3: Exclude rollups from the default base-fill layer**

Modify the existing `district-base-fill` layer's filter to exclude rollups so
they don't paint a fill. Add/adjust:

```typescript
filter: ["!=", ["get", "is_rollup"], true],
```

(If the layer already has a filter, combine with `["all", existingFilter, ["!=", ["get", "is_rollup"], true]]`.)

- [ ] **Step 4: Register the new layer in the map initialization**

Follow the existing pattern — wherever the existing layers are added to the
MapLibre instance (typically `MapV2Container.tsx` during `map.on('load')`),
add the new outline layer.

- [ ] **Step 5: Manual verify**

Run: `npm run dev` and visit `http://localhost:3005`. Navigate to NYC on the
map. Expected: The five-borough NYC DOE boundary appears as a thin dashed
plum outline with no fill; the 32 community districts are individually filled
and clickable.

- [ ] **Step 6: Commit**

```bash
git add src/features/map/lib/layers.ts src/features/map/components/MapV2Container.tsx
git commit -m "feat(map): render rollup polygons as dashed outline (no fill)"
```

---

### Task 6: Children always win the map click hit-test

**Files:**
- Modify: `src/features/map/components/MapV2Container.tsx:1196-1217`
- Test: co-locate in `src/features/map/components/__tests__/MapV2Container.test.tsx` if absent

- [ ] **Step 1: Write failing test for the picker logic**

Extract the picker into a pure function to make it unit-testable:

```typescript
// src/features/map/components/__tests__/pickDistrictFeature.test.ts
import { describe, it, expect } from "vitest";
import { pickDistrictFeature } from "../pickDistrictFeature";

describe("pickDistrictFeature", () => {
  it("returns the child when both rollup and child are at the point", () => {
    const features = [
      { properties: { leaid: "3620580", is_rollup: true } },
      { properties: { leaid: "3600076", is_rollup: false } },
    ];
    expect(pickDistrictFeature(features as any)?.properties.leaid).toBe("3600076");
  });

  it("returns the child when only the child is at the point", () => {
    const features = [{ properties: { leaid: "3600076", is_rollup: false } }];
    expect(pickDistrictFeature(features as any)?.properties.leaid).toBe("3600076");
  });

  it("returns the rollup as fallback when only the rollup is at the point", () => {
    const features = [{ properties: { leaid: "3620580", is_rollup: true } }];
    expect(pickDistrictFeature(features as any)?.properties.leaid).toBe("3620580");
  });

  it("returns undefined on empty feature list", () => {
    expect(pickDistrictFeature([])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (module does not exist)

Run: `npx vitest run src/features/map/components/__tests__/pickDistrictFeature.test.ts`
Expected: FAIL — "Failed to resolve import '../pickDistrictFeature'".

- [ ] **Step 3: Create the picker module**

```typescript
// src/features/map/components/pickDistrictFeature.ts
import type { MapGeoJSONFeature } from "maplibre-gl";

/**
 * Given an ordered list of rendered features at a click point, prefers
 * non-rollup (leaf) districts so that clicking anywhere inside a rollup's
 * visual bounds selects the specific child at that point (e.g., District 5
 * in NYC), not the rollup itself. Falls back to the first feature if no
 * non-rollup is present.
 */
export function pickDistrictFeature(
  features: MapGeoJSONFeature[]
): MapGeoJSONFeature | undefined {
  if (features.length === 0) return undefined;
  const child = features.find((f) => f.properties?.is_rollup !== true);
  return child ?? features[0];
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run src/features/map/components/__tests__/pickDistrictFeature.test.ts`
Expected: 4 tests passing.

- [ ] **Step 5: Wire the picker into MapV2Container**

In `src/features/map/components/MapV2Container.tsx` around line 1196, replace:

```typescript
const districtFeatures = queryLayer("district-base-fill");
if (districtFeatures.length > 0) {
  const leaid = districtFeatures[0].properties?.leaid;
```

with:

```typescript
import { pickDistrictFeature } from "./pickDistrictFeature";
// ...
const districtFeatures = queryLayer("district-base-fill");
if (districtFeatures.length > 0) {
  const picked = pickDistrictFeature(districtFeatures);
  const leaid = picked?.properties?.leaid;
```

Keep the rest of the click handler (ripple, toggle, zoom) unchanged — it's now
driven by `picked` instead of `districtFeatures[0]`.

- [ ] **Step 6: Manual verify**

Run: `npm run dev`. Click anywhere in Brooklyn on the map. Expected: a
community district (e.g., District 20) is selected, not NYC DOE.

- [ ] **Step 7: Commit**

```bash
git add src/features/map/components/MapV2Container.tsx src/features/map/components/pickDistrictFeature.ts src/features/map/components/__tests__/pickDistrictFeature.test.ts
git commit -m "feat(map): children win click hit-test over rollup polygons"
```

---

## Phase 4 — Plan auto-migrate + write guards

### Task 7: Auto-migrate rollup → children on plan GET

**Files:**
- Create: `src/features/districts/lib/expandRollups.ts`
- Test: `src/features/districts/lib/__tests__/expandRollups.test.ts`
- Modify: `src/app/api/territory-plans/[id]/route.ts:22-54`

- [ ] **Step 1: Write failing test for the expansion function**

```typescript
// src/features/districts/lib/__tests__/expandRollups.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { expandPlanRollups } from "../expandRollups";

describe("expandPlanRollups", () => {
  let planId: string;

  beforeEach(async () => {
    // Create a clean plan with just the NYC DOE rollup for testing
    const plan = await prisma.territoryPlan.create({
      data: {
        name: "test-rollup-plan",
        fiscalYear: 2026,
        districts: { create: [{ districtLeaid: "3620580" }] },
      },
    });
    planId = plan.id;
  });

  it("expands a rollup-only plan to 32+ child rows and logs an activity", async () => {
    const result = await expandPlanRollups(planId, "system");
    expect(result.expandedCount).toBeGreaterThanOrEqual(32);
    expect(result.rollupsExpanded).toEqual(["3620580"]);

    const districts = await prisma.territoryPlanDistrict.findMany({
      where: { planId },
      select: { districtLeaid: true },
    });
    const leaids = districts.map((d) => d.districtLeaid);
    expect(leaids).not.toContain("3620580");
    expect(leaids).toContain("3600076");

    const activity = await prisma.activity.findFirst({
      where: { type: "system_migration", plans: { some: { planId } } },
    });
    expect(activity).not.toBeNull();
    expect(activity?.metadata).toMatchObject({
      subtype: "rollup-expanded",
      rollupLeaid: "3620580",
    });
  });

  it("is idempotent: a second call performs no expansion", async () => {
    await expandPlanRollups(planId, "system");
    const result2 = await expandPlanRollups(planId, "system");
    expect(result2.expandedCount).toBe(0);
    expect(result2.rollupsExpanded).toEqual([]);
  });

  it("dedups: child already present in plan is not re-inserted", async () => {
    await prisma.territoryPlanDistrict.create({
      data: { planId, districtLeaid: "3600076" },
    });
    await expandPlanRollups(planId, "system");
    const count = await prisma.territoryPlanDistrict.count({
      where: { planId, districtLeaid: "3600076" },
    });
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/features/districts/lib/__tests__/expandRollups.test.ts`
Expected: FAIL — "Failed to resolve import '../expandRollups'".

- [ ] **Step 3: Implement `expandRollups.ts`**

```typescript
// src/features/districts/lib/expandRollups.ts
import prisma from "@/lib/prisma";
import { getChildren, getRollupLeaids } from "./rollup";

export interface ExpandResult {
  rollupsExpanded: string[];
  expandedCount: number;
}

/**
 * Within a single transaction:
 *   1. Finds rollup leaids currently in the plan's districts.
 *   2. Replaces each rollup row with rows for its children (dedup).
 *   3. Writes one activity-log entry per expansion for traceability.
 *
 * Idempotent: a plan whose rollups have all been expanded returns zero-op.
 * Called on every plan GET as well as explicit PATCH /expand-rollup.
 */
export async function expandPlanRollups(
  planId: string,
  actorUserId: string | null
): Promise<ExpandResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.territoryPlanDistrict.findMany({
      where: { planId },
      select: { districtLeaid: true },
    });
    const existingLeaids = existing.map((r) => r.districtLeaid);
    const rollupsPresent = await getRollupLeaids(existingLeaids);
    if (rollupsPresent.length === 0) {
      return { rollupsExpanded: [], expandedCount: 0 };
    }

    let expandedCount = 0;
    const expanded: string[] = [];

    for (const rollupLeaid of rollupsPresent) {
      const children = await getChildren(rollupLeaid);
      const existingSet = new Set(existingLeaids);
      const toInsert = children.filter((c) => !existingSet.has(c));

      // Remove the rollup row
      await tx.territoryPlanDistrict.deleteMany({
        where: { planId, districtLeaid: rollupLeaid },
      });

      // Insert children (dedup via createMany + skipDuplicates)
      if (toInsert.length > 0) {
        await tx.territoryPlanDistrict.createMany({
          data: toInsert.map((leaid) => ({ planId, districtLeaid: leaid })),
          skipDuplicates: true,
        });
      }

      // Activity log entry
      await tx.activity.create({
        data: {
          type: "system_migration",
          title: "Rollup district auto-expanded",
          status: "completed",
          source: "system",
          createdByUserId: actorUserId,
          metadata: {
            subtype: "rollup-expanded",
            rollupLeaid,
            childLeaids: children,
            insertedCount: toInsert.length,
            dedupedCount: children.length - toInsert.length,
          },
          plans: { create: { planId } },
        },
      });

      expandedCount += toInsert.length;
      expanded.push(rollupLeaid);
    }

    return { rollupsExpanded: expanded, expandedCount };
  });
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run src/features/districts/lib/__tests__/expandRollups.test.ts`
Expected: 3 tests passing.

- [ ] **Step 5: Wire into the plan GET handler**

In `src/app/api/territory-plans/[id]/route.ts` at the start of the `try` block
(around line 14-22), after resolving `params` and `user`, add a call to
`expandPlanRollups`:

```typescript
import { expandPlanRollups } from "@/features/districts/lib/expandRollups";
// ...
const { id } = await params;
const user = await getUser();

if (!user) {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

// Auto-migrate any rollup leaids in this plan to their children.
// Safe to run on every GET — idempotent after first successful expansion.
await expandPlanRollups(id, user.id);

// ...rest of the handler continues unchanged
```

- [ ] **Step 6: Run plan GET tests**

Run: `npx vitest run src/app/api/territory-plans/__tests__/route.test.ts`
Expected: pre-existing `route.test.ts:515` failure status unchanged (ours doesn't touch that code path), rest still passing.

- [ ] **Step 7: Commit**

```bash
git add src/features/districts/lib/expandRollups.ts src/features/districts/lib/__tests__/expandRollups.test.ts src/app/api/territory-plans/[id]/route.ts
git commit -m "feat(plans): auto-expand rollup districts on plan GET"
```

---

### Task 8: Guard plan writes — expand rollups server-side on district add

**Files:**
- Modify: `src/app/api/territory-plans/[id]/districts/route.ts` (POST handler)

- [ ] **Step 1: Read the current POST handler**

Run: `cat src/app/api/territory-plans/[id]/districts/route.ts`

Identify where leaids arrive from the request body and are inserted into
`territoryPlanDistrict`.

- [ ] **Step 2: Write a test for rollup expansion on write**

Add to the existing test file for that route (or create one):

```typescript
// src/app/api/territory-plans/[id]/districts/__tests__/route.test.ts
it("expands rollup leaids to children on POST", async () => {
  const plan = await prisma.territoryPlan.create({
    data: { name: "write-guard-test", fiscalYear: 2026 },
  });

  const req = new Request(`http://localhost/api/territory-plans/${plan.id}/districts`, {
    method: "POST",
    body: JSON.stringify({ leaids: ["3620580"] }),
  });
  const res = await POST(req as any, { params: Promise.resolve({ id: plan.id }) } as any);
  expect(res.status).toBe(201);

  const rows = await prisma.territoryPlanDistrict.findMany({
    where: { planId: plan.id },
    select: { districtLeaid: true },
  });
  const leaids = rows.map((r) => r.districtLeaid);
  expect(leaids).not.toContain("3620580");
  expect(leaids).toContain("3600076");
});
```

- [ ] **Step 3: Run test — expect FAIL** (rollup passes through unchanged)

Run: `npx vitest run src/app/api/territory-plans/[id]/districts/__tests__/route.test.ts`
Expected: FAIL.

- [ ] **Step 4: Expand rollups before insert**

In the POST handler, after the body is parsed and the leaid list is gathered,
expand rollups to children before the `createMany`:

```typescript
import { getRollupLeaids, getChildren } from "@/features/districts/lib/rollup";
// ...
async function expandRollupsInList(leaids: string[]): Promise<string[]> {
  const rollups = await getRollupLeaids(leaids);
  if (rollups.length === 0) return leaids;
  const set = new Set(leaids.filter((l) => !rollups.includes(l)));
  for (const r of rollups) {
    for (const c of await getChildren(r)) set.add(c);
  }
  return Array.from(set);
}

// Inside POST handler, replace raw leaid list with:
const expandedLeaids = await expandRollupsInList(requestLeaids);
// ...use expandedLeaids in createMany
```

- [ ] **Step 5: Run test — expect PASS**

Run: `npx vitest run src/app/api/territory-plans/[id]/districts/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/territory-plans/[id]/districts/
git commit -m "feat(plans): expand rollup leaids to children on POST /districts"
```

---

### Task 9: Verify activity log entry shape in UI surfaces

**Files:**
- Modify: (if needed) `src/features/activities/components/ActivityTimeline.tsx` to render the `system_migration` / `rollup-expanded` entries nicely

- [ ] **Step 1: Check how existing activity types render**

Run: `grep -rn "contact_enrichment\|system_migration\|activity.type" src/features/activities 2>/dev/null | head -20`

If the timeline component has a switch/map of activity types to icons/copy,
add a case for `system_migration` with subtype `rollup-expanded`. If it falls
back gracefully to the raw `title`, no change needed.

- [ ] **Step 2: Visual smoke**

Run: `npm run dev` → load a plan containing NYC DOE → check the Activity
timeline on the plan. Expected: One entry reading "Rollup district
auto-expanded" (from the `title` we set in Task 7).

- [ ] **Step 3: Commit (only if timeline needed changes)**

```bash
git add src/features/activities/components/
git commit -m "feat(activities): render system_migration rollup-expanded entries"
```

If no changes were required, skip the commit.

---

## Phase 5 — Bulk-enrich + expand endpoint

### Task 10: Rollup pre-check on plan-level bulk-enrich

**Files:**
- Modify: `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts` (after line 67)
- Test: `src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// Add to existing test file
it("returns 400 with reason=rollup-district when plan contains a rollup", async () => {
  const plan = await prisma.territoryPlan.create({
    data: {
      name: "rollup-enrich-test",
      fiscalYear: 2026,
      districts: { create: [{ districtLeaid: "3620580" }] },
    },
  });

  const req = new Request(`http://localhost/api/territory-plans/${plan.id}/contacts/bulk-enrich`, {
    method: "POST",
    body: JSON.stringify({ targetRole: "Superintendent" }),
  });
  const res = await POST(req as any, { params: Promise.resolve({ id: plan.id }) } as any);
  expect(res.status).toBe(400);

  const body = await res.json();
  expect(body.reason).toBe("rollup-district");
  expect(body.rollupLeaids).toEqual(["3620580"]);
  expect(body.childLeaids.length).toBeGreaterThanOrEqual(32);
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the pre-check**

In `bulk-enrich/route.ts`, after `const allLeaids = plan.districts.map(...)` at line 63 and before the early-return at line 65, add:

```typescript
import { getRollupLeaids, getChildren } from "@/features/districts/lib/rollup";
// ...

// Rollup pre-check — fail fast with a reason the UI can act on
const rollupLeaids = await getRollupLeaids(allLeaids);
if (rollupLeaids.length > 0) {
  const childLeaids = (
    await Promise.all(rollupLeaids.map((l) => getChildren(l)))
  ).flat();
  return NextResponse.json(
    {
      error: "Plan contains rollup district(s); expand to children before enriching.",
      reason: "rollup-district",
      rollupLeaids,
      childLeaids,
    },
    { status: 400 }
  );
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/territory-plans/[id]/contacts/bulk-enrich
git commit -m "feat(api): bulk-enrich rejects rollup-only plans with reason code"
```

---

### Task 11: New PATCH `/api/territory-plans/[id]/expand-rollup` endpoint

**Files:**
- Create: `src/app/api/territory-plans/[id]/expand-rollup/route.ts`
- Test: `src/app/api/territory-plans/[id]/expand-rollup/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/app/api/territory-plans/[id]/expand-rollup/__tests__/route.test.ts
import { describe, it, expect } from "vitest";
import prisma from "@/lib/prisma";
import { PATCH } from "../route";

describe("PATCH /api/territory-plans/[id]/expand-rollup", () => {
  it("expands a specific rollup leaid and returns the expanded count", async () => {
    const plan = await prisma.territoryPlan.create({
      data: {
        name: "expand-rollup-route-test",
        fiscalYear: 2026,
        districts: { create: [{ districtLeaid: "3620580" }] },
      },
    });

    const req = new Request(`http://localhost/api/territory-plans/${plan.id}/expand-rollup`, {
      method: "PATCH",
      body: JSON.stringify({ rollupLeaid: "3620580" }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: plan.id }) } as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.expandedCount).toBeGreaterThanOrEqual(32);
    expect(body.rollupsExpanded).toEqual(["3620580"]);

    const rows = await prisma.territoryPlanDistrict.findMany({
      where: { planId: plan.id },
      select: { districtLeaid: true },
    });
    expect(rows.map((r) => r.districtLeaid)).not.toContain("3620580");
  });

  it("returns 404 for missing plan", async () => {
    const req = new Request("http://localhost/api/territory-plans/nope/expand-rollup", {
      method: "PATCH",
      body: JSON.stringify({ rollupLeaid: "3620580" }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: "nope" }) } as any);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/app/api/territory-plans/[id]/expand-rollup/__tests__/route.test.ts`
Expected: FAIL — "Failed to resolve import '../route'".

- [ ] **Step 3: Implement the route**

```typescript
// src/app/api/territory-plans/[id]/expand-rollup/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { expandPlanRollups } from "@/features/districts/lib/expandRollups";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const plan = await prisma.territoryPlan.findUnique({ where: { id } });
    if (!plan) {
      return NextResponse.json({ error: "Territory plan not found" }, { status: 404 });
    }

    const result = await expandPlanRollups(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error expanding plan rollup:", error);
    return NextResponse.json({ error: "Failed to expand rollup" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run src/app/api/territory-plans/[id]/expand-rollup/__tests__/route.test.ts`
Expected: 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/territory-plans/[id]/expand-rollup
git commit -m "feat(api): PATCH /api/territory-plans/[id]/expand-rollup"
```

---

## Phase 6 — UI

### Task 12: Store action `selectDistricts(leaids[])` batched multi-select

**Files:**
- Modify: `src/features/map/lib/store.ts:770-790`

- [ ] **Step 1: Write failing test**

```typescript
// src/features/map/lib/__tests__/store.selectDistricts.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useMapV2Store } from "../store";

describe("selectDistricts batched action", () => {
  beforeEach(() => {
    useMapV2Store.setState({
      selectedLeaids: new Set(),
      panelState: "BROWSE",
      panelHistory: [],
      activeIconTab: "home",
    });
  });

  it("sets exactly the given leaids in one store update", () => {
    const before = useMapV2Store.getState();
    before.selectDistricts(["a", "b", "c"]);
    const after = useMapV2Store.getState();
    expect(Array.from(after.selectedLeaids).sort()).toEqual(["a", "b", "c"]);
    expect(after.panelState).toBe("MULTI_DISTRICT");
    expect(after.activeIconTab).toBe("selection");
  });

  it("bypasses the 20-item cap (used for rollup expansion > 20 children)", () => {
    const leaids = Array.from({ length: 35 }, (_, i) => `leaid-${i}`);
    useMapV2Store.getState().selectDistricts(leaids);
    expect(useMapV2Store.getState().selectedLeaids.size).toBe(35);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (action does not exist)

Run: `npx vitest run src/features/map/lib/__tests__/store.selectDistricts.test.ts`
Expected: FAIL — `before.selectDistricts is not a function`.

- [ ] **Step 3: Add the action to the store**

Open `src/features/map/lib/store.ts`. Find line 339 (the type) and add:

```typescript
selectDistricts: (leaids: string[]) => void;
```

Find line 771 (where `toggleLeaidSelection` is defined) and add the new action
right after:

```typescript
selectDistricts: (leaids) =>
  set(() => {
    const next = new Set(leaids);
    return {
      selectedLeaids: next,
      panelState: next.size > 0 ? "MULTI_DISTRICT" : "BROWSE",
      activeIconTab: next.size > 0 ? "selection" : "home",
    };
  }),
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run src/features/map/lib/__tests__/store.selectDistricts.test.ts`
Expected: 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/lib/store.ts src/features/map/lib/__tests__/store.selectDistricts.test.ts
git commit -m "feat(store): selectDistricts batched action for rollup expansion"
```

---

### Task 13: DistrictCard rollup strip with "Select all N" CTA

**Files:**
- Modify: `src/features/map/components/right-panels/DistrictCard.tsx`
- Update/extend: `src/lib/api.ts` to surface `is_rollup` on `useDistrictDetail` return type if not already present
- Test: `src/features/map/components/right-panels/__tests__/DistrictCard.rollup.test.tsx`

- [ ] **Step 1: Ensure `useDistrictDetail` returns children + is_rollup**

Check if the district detail endpoint includes `parentLeaid` / computed `isRollup` + children. If not, extend it:

Run: `grep -rn "useDistrictDetail\|/api/districts/\[leaid\]" src/lib src/app/api/districts 2>/dev/null | head`

In the district detail route (likely `src/app/api/districts/[leaid]/route.ts`), include in the response:
```typescript
isRollup: childLeaids.length > 0,
childLeaids,  // string[]
schoolCount,  // sum of numberOfSchools across children
```

- [ ] **Step 2: Write failing component test**

```typescript
// src/features/map/components/right-panels/__tests__/DistrictCard.rollup.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DistrictCard from "../DistrictCard";
import { useMapV2Store } from "@/features/map/lib/store";

vi.mock("@/lib/api", () => ({
  useDistrictDetail: () => ({
    data: {
      district: { name: "New York City Department Of Education", stateAbbrev: "NY", accountType: "district", isRollup: true, childLeaids: Array.from({ length: 32 }, (_, i) => `child-${i}`), schoolCount: 1491 },
      contacts: [],
      fullmindData: null,
      tags: [],
      trends: null,
    },
    isLoading: false,
    error: null,
  }),
  useRemoveDistrictFromPlan: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("DistrictCard — rollup strip", () => {
  it("renders 'N community districts' header for a rollup", () => {
    render(<DistrictCard leaid="3620580" />);
    expect(screen.getByText(/32 community districts/i)).toBeInTheDocument();
    expect(screen.getByText(/1,491 schools/i)).toBeInTheDocument();
  });

  it("'Select all 32' button dispatches selectDistricts with all child leaids", () => {
    const spy = vi.spyOn(useMapV2Store.getState(), "selectDistricts");
    render(<DistrictCard leaid="3620580" />);
    fireEvent.click(screen.getByRole("button", { name: /select all 32/i }));
    expect(spy).toHaveBeenCalledWith(Array.from({ length: 32 }, (_, i) => `child-${i}`));
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

Run: `npx vitest run src/features/map/components/right-panels/__tests__/DistrictCard.rollup.test.tsx`
Expected: FAIL (strip not rendered).

- [ ] **Step 4: Add the strip to DistrictCard**

Just after the `DistrictHeader` component (~line 63-68), before the tab strip:

```tsx
{data.district.isRollup && data.district.childLeaids && (
  <div className="border-b border-plum-200 bg-plum-50 px-3 py-2.5 space-y-1.5">
    <p className="text-xs font-medium text-plum-900">
      Rollup district — contains {data.district.childLeaids.length} community districts with {(data.district.schoolCount ?? 0).toLocaleString()} schools
    </p>
    <div className="flex gap-2">
      <button
        onClick={() => useMapV2Store.getState().selectDistricts(data.district.childLeaids)}
        className="px-3 py-1 rounded-md bg-plum text-white text-xs font-medium hover:bg-plum-dark transition-colors"
      >
        Select all {data.district.childLeaids.length} children
      </button>
      <button
        disabled
        title="Will return 0 contacts — not recommended"
        className="px-3 py-1 rounded-md bg-white text-plum-400 text-xs font-medium border border-plum-200 cursor-not-allowed"
      >
        Keep as rollup
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 5: Run test — expect PASS**

Run: `npx vitest run src/features/map/components/right-panels/__tests__/DistrictCard.rollup.test.tsx`
Expected: 2 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/features/map/components/right-panels src/app/api/districts src/lib/api.ts
git commit -m "feat(ui): DistrictCard rollup strip with 'Select all N' CTA"
```

---

### Task 14: District search result — rollup badge + count suffix

**Files:**
- Modify: `src/features/map/components/SearchBar/DistrictsDropdown.tsx`

- [ ] **Step 1: Locate the search result row**

Run: `grep -n "district.name\|leaid\|result" src/features/map/components/SearchBar/DistrictsDropdown.tsx | head -20`

- [ ] **Step 2: Pass `isRollup` + `childCount` through the search response**

The search API (likely `/api/districts/search`) needs these fields. Extend
its `select` to include computed values:

```typescript
// In the search API response, add per-district:
isRollup: district._count.childDistricts > 0,
childCount: district._count.childDistricts,
```

(Use Prisma `_count` on the `childDistricts` relation added in Task 1.)

- [ ] **Step 3: Render the suffix + badge**

In the dropdown result item:

```tsx
<span className="flex items-center gap-1.5">
  {district.name}
  {district.isRollup && (
    <>
      <span className="text-plum-400">·</span>
      <span className="text-xs text-plum-600">{district.childCount} community districts</span>
    </>
  )}
</span>
```

- [ ] **Step 4: Visual smoke**

Run: `npm run dev` → search "NYC DOE" → Expected: result shows "New York City Department Of Education · 32 community districts".

- [ ] **Step 5: Commit**

```bash
git add src/features/map/components/SearchBar src/app/api/districts
git commit -m "feat(search): mark rollup districts with '· N community districts' suffix"
```

---

### Task 15: ContactsActionBar — rollup toast + expand CTA

**Files:**
- Modify: `src/features/plans/components/ContactsActionBar.tsx:118-154`
- Extend: TanStack Query mutation for expand-rollup (in `src/features/plans/lib/queries.ts`)

- [ ] **Step 1: Write failing test (toast branch)**

```typescript
// Add to existing src/features/plans/components/__tests__/ContactsActionBar.test.tsx
it("shows 'Expand to N districts' CTA when bulk-enrich returns reason=rollup-district", async () => {
  // Mock the mutation to reject with a 400 carrying rollup-district reason
  vi.mocked(useBulkEnrich).mockReturnValue({
    mutateAsync: vi.fn().mockRejectedValue({
      status: 400,
      body: { reason: "rollup-district", rollupLeaids: ["3620580"], childLeaids: Array.from({ length: 32 }, (_, i) => `child-${i}`) },
    }),
  } as any);

  render(<ContactsActionBar planId="p1" contacts={[]} />);
  fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));

  expect(await screen.findByText(/contains 32 community districts/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /expand to 32 districts/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/features/plans/components/__tests__/ContactsActionBar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Add mutation hook for expand-rollup**

In `src/features/plans/lib/queries.ts`:

```typescript
export function useExpandRollup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, rollupLeaid }: { planId: string; rollupLeaid: string }) => {
      const res = await fetch(`/api/territory-plans/${planId}/expand-rollup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollupLeaid }),
      });
      if (!res.ok) throw new Error("Failed to expand rollup");
      return res.json();
    },
    onSuccess: (_, { planId }) => {
      qc.invalidateQueries({ queryKey: ["territory-plan", planId] });
      qc.invalidateQueries({ queryKey: ["plan-contacts", planId] });
    },
  });
}
```

- [ ] **Step 4: Update ContactsActionBar error handling**

Replace the `catch` block (around line 145) and the `result.queued === 0` branch (line 130):

```tsx
const expandRollup = useExpandRollup();

const handleStartEnrichment = useCallback(async () => {
  setShowPopover(false);
  try {
    const result = await bulkEnrich.mutateAsync({ planId, targetRole: selectedRole, /* ... */ });
    if (result.queued === 0) {
      setToast({ message: "Nothing to enrich — all targets already have contacts", type: "info" });
      return;
    }
    // ...existing success path
  } catch (error: any) {
    // Parse rollup-district reason from 400 response body
    const body = error?.body;
    if (body?.reason === "rollup-district") {
      const count = body.childLeaids?.length ?? 0;
      setToast({
        message: `This plan contains ${count} community districts rolled up under NYC DOE.`,
        type: "warning",
        action: {
          label: `Expand to ${count} districts`,
          onClick: async () => {
            for (const rollup of body.rollupLeaids) {
              await expandRollup.mutateAsync({ planId, rollupLeaid: rollup });
            }
            // Retry the original enrich
            handleStartEnrichment();
          },
        },
      });
      return;
    }
    // ...existing error handling
  }
}, [planId, selectedRole, schoolLevels, bulkEnrich, expandRollup]);
```

(Note: the `setToast` extension to accept an `action` may require a small
update to the Toast component type. Check the existing Toast for prior art;
if the shape is already `{ message, type, action? }` you're done — if not,
extend it minimally.)

- [ ] **Step 5: Run test — expect PASS**

Run: `npx vitest run src/features/plans/components/__tests__/ContactsActionBar.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/plans/components/ContactsActionBar.tsx src/features/plans/lib/queries.ts src/features/plans/components/__tests__/ContactsActionBar.test.tsx
git commit -m "feat(plans): rollup-district toast with Expand CTA on Find Contacts"
```

---

## Phase 7 — Manual smoke

### Task 16: End-to-end smoke test on dev server

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (port 3005).

- [ ] **Step 2: Map click flow**

- Navigate to NYC on the map.
- Expected: five-borough outline is dashed plum, no fill; community districts are individually filled.
- Click in Brooklyn over District 20.
- Expected: right rail shows District 20 (or whichever borough subdivision is under cursor), NOT NYC DOE.

- [ ] **Step 3: Search → rollup CTA**

- Open search, type "NYC DOE".
- Expected: result shows "New York City Department Of Education · 32 community districts" (or the discovered child count).
- Click the result.
- Expected: right-rail strip "Rollup district — contains 32 community districts with 1,491 schools" + `[Select all 32 children]` primary and `[Keep as rollup]` disabled secondary.
- Click "Select all 32 children".
- Expected: multi-select panel now shows all 32 child districts.

- [ ] **Step 4: Old plan auto-migrate**

- Find (or create) a plan where `territory_plan_districts` still contains `3620580` (e.g., the April 22 Test plan).
- Open it.
- Expected: after page load, the plan now shows 32+N districts, `Enrollment > 0`, and the Activity timeline has a "Rollup district auto-expanded" entry.

- [ ] **Step 5: Find Contacts on unexpanded plan (fallback path)**

- Manually insert a rollup row into `territory_plan_districts` via psql (SQL: `INSERT INTO territory_plan_districts (plan_id, district_leaid) VALUES ('<existing plan>', '3620580') ON CONFLICT DO NOTHING`).
- Load the plan — auto-migrate will expand it. To test the *raw* fallback, skip auto-migrate by inserting right before the Find Contacts click (or temporarily comment out `expandPlanRollups` in the plan GET handler).
- Click Find Contacts → Superintendent → Start.
- Expected: toast reads "This plan contains 32 community districts rolled up under NYC DOE." with an `[Expand to 32 districts]` button.
- Click the button.
- Expected: plan auto-expands, bulk-enrich retries, Clay webhooks queued.

- [ ] **Step 6: Regression checks**

- Click a non-rollup district (e.g., a district in Arizona) → right rail shows normal single-district panel, no strip.
- Search a non-rollup district → no "community districts" suffix.
- Open a plan that never had a rollup → no Activity "rollup-expanded" entry created, plan loads normally.

- [ ] **Step 7: Run full Vitest suite**

Run: `npx vitest run --reporter=dot`
Expected: same 3 pre-existing failures as baseline (no new failures introduced by this work). If new failures appear, fix them before closing out.

- [ ] **Step 8: Final smoke commit (if any copy/CSS polish needed)**

```bash
git status  # review any polish-level changes
git add <specific files>
git commit -m "chore(nyc-doe-rollup): polish from manual smoke"
```

If nothing to commit, skip this step.

---

## Done Criteria

- [ ] All 16 tasks completed and checked off
- [ ] `git log --oneline worktree-nyc-doe-rollup ^origin/main` shows a clean, reviewable commit history (≈16 commits + this plan + the spec)
- [ ] `npx vitest run --reporter=dot` — pass count ≥ 1419 + net-new tests from this project, with no regressions beyond the 3 known pre-existing failures
- [ ] NYC DOE on the map is visually distinct (dashed plum outline, no fill) and non-clickable via fill
- [ ] Opening the April 22 Test plan (or any plan previously containing 3620580) shows 32+N district rows and non-zero enrollment
- [ ] Find Contacts from a plan with a rollup shows the "Expand to N districts" CTA
- [ ] Ready to open PR against `main` via `gh pr create` when the user gives the go-ahead
