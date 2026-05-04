# Map Plans Endpoint — Vector Tiles Migration Design

**Date:** 2026-05-01
**Branch target:** `main`
**Scope:** `/api/map/plans` performance — convert from full-payload GeoJSON to MVT vector tiles

---

## Problem

The `/api/map/plans` endpoint serializes the entire set of plan-district polygons in one response. Measured behavior on the live database (Supabase, Postgres + PostGIS):

| Variant | Rows | Payload | Postgres query | JS row mapping | Total handler |
|---------|-----:|--------:|---------------:|---------------:|--------------:|
| Owner-filtered (current user, 6 plans) | 6 | 220 KB | 223 ms | 143 ms | ~560 ms |
| **Unfiltered (all 58 plans)** | **2,211** | **84.3 MB** | **50.2 s** | **9.2 s** | **~60 s** |

Most of the 60 s in the worst case is `ST_AsGeoJSON` serializing 2,211 full-precision district polygons; the JS-side `pg` driver then has to parse 84 MB of JSON into 2,211 objects (the 9.2 s mapping cost). Pool acquisition is a constant ~190 ms tax — small relative to the geometry cost, tracked as a separate concern.

The endpoint scales **with row count** (plans × districts). Adoption is currently low and expected to grow ~5×, which would push the worst case to ~5 minutes.

A separate measurement confirmed `ST_SimplifyPreserveTopology(render_geometry, 0.005)` would buy a 17× speedup today (~3 s, 3.4 MB), but caps at ~5× growth and is throwaway work — vector tiles are the architectural fix and are nearly free to build because the infrastructure already exists.

## Solution

Convert `/api/map/plans` from a single GeoJSON endpoint to a **vector tile endpoint** at `/api/map/plans/[z]/[x]/[y]/route.ts`, mirroring the existing `/api/tiles/[z]/[x]/[y]` pattern. MapLibre fetches per-tile-per-zoom; only geometry visible in the current viewport transfers. Cold load drops from ~60 s → <500 ms per visible tile, and scales with viewport size, not row count.

This is a small project (~1–2 days of focused work) because the building blocks are already in place:

- **`district_map_features` materialized view** with a `render_geometry` column and a GIST spatial index — created in `scripts/district-map-features-view.sql`
- **MVT helpers in PostGIS** (`ST_AsMVT`, `ST_AsMVTGeom`, `ST_TileEnvelope`)
- **A working tile endpoint** at `src/app/api/tiles/[z]/[x]/[y]/route.ts` using zoom-aware simplification tolerances (`0.01` at low zoom, `0.005` at mid, `0.001` at high)

## Architecture

### Endpoint

`GET /api/map/plans/[z]/[x]/[y].mvt`

Query params (same as today's endpoint, kept for filter compatibility):
- `status` — comma-separated plan statuses (`planning,working,stale,archived`)
- `fiscalYear` — single integer fiscal year
- `planIds` — comma-separated plan UUIDs
- `ownerIds` — comma-separated owner user UUIDs

Response: binary MVT (`Content-Type: application/vnd.mapbox-vector-tile`).
Cache: `Cache-Control: public, max-age=300`.

### MVT layer + properties

Layer name: `plans`.
One feature per (plan, district) pair (matches today's behavior — dedup is a future optimization).
Properties on each feature:
- `planId` (string)
- `planName` (string)
- `planColor` (string, hex)
- `planStatus` (string)
- `districtName` (string)
- `leaid` (string)
- `renewalTarget` (number or null)
- `expansionTarget` (number or null)

### SQL shape

```sql
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
```

Zoom-to-tolerance map (matches the district tile endpoint):
- z < 7 → `0.01`
- 7 ≤ z < 11 → `0.005`
- z ≥ 11 → `0.001`

### Filter passing — query params, not path

Filters live in the query string (`?ownerIds=…&status=…`) rather than encoded into the URL path. This mirrors the existing tile endpoint pattern and keeps filter changes simple. Each unique filter combination is its own browser cache entry. Reps don't change filters frequently, so cache-miss rate stays low.

### Data flow

```
User opens map / changes filters
  ↓
React store updates filter state (status, fiscalYear, planIds, ownerIds)
  ↓
useMapPlans builds tile URL pattern with filters baked in
  ↓
MapLibre vector source URL pattern updates → MapLibre refetches visible tiles
  ↓
GET /api/map/plans/{z}/{x}/{y}.mvt?status=…&ownerIds=…
  ↓
Route handler:
  - Parse z/x/y, validate
  - Parse filters (reuse logic from current endpoint)
  - SQL: ST_AsMVT over district_map_features, filtered by tile envelope + plan filters
  - Return binary MVT
  ↓
Browser caches per Cache-Control (5 min)
  ↓
MapLibre decodes, renders fill layer using feature properties
```

When filters change, MapLibre invalidates only the tiles in view — not the world.

## Files to Create / Modify

| Action | File | What |
|---|---|---|
| Create | `src/app/api/map/plans/[z]/[x]/[y]/route.ts` | New MVT endpoint. Mirror `/api/tiles/[z]/[x]/[y]/route.ts` structure. Reuse filter parsing from `src/app/api/map/plans/route.ts`. |
| Create | `src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts` | Unit tests (mirror tile-route test structure). |
| Modify | `src/features/map/lib/queries.ts` | Replace `useMapPlans` (TanStack Query against GeoJSON URL) with a tile-URL builder that returns the URL pattern with filters. MapLibre owns the fetching; no `useQuery` needed. |
| Modify | `src/features/map/lib/layers.ts` (or wherever the plan source is registered) | Swap the GeoJSON source for a `vector` source pointing at the MVT URL. Add `source-layer: 'plans'` to the fill layer. Verify paint expressions still work (same property names). |
| Keep (during migration) | `src/app/api/map/plans/route.ts` | Stays intact through the rollout window. Removed in a follow-up after MVT is verified in production. |
| Delete (in cleanup PR) | `src/app/api/map/plans/route.ts` | After ~1 week of MVT in production with no issues. |

## Error Handling

Inherited from the existing tile endpoint pattern:

- **Invalid `z`/`x`/`y`** (non-numeric or out of valid tile range) → `400 { error: "Invalid tile coordinates" }`
- **Empty tile** (no plan-districts intersect this tile) → `204 No Content`. MapLibre handles 204 correctly.
- **Invalid filter values** (e.g. `fiscalYear=abc`) → `400` with the existing parse-error pattern
- **Database errors** → `500` with generic error message + `console.error`

## Testing

Three test files, all small.

| File | Coverage |
|---|---|
| `src/app/api/map/plans/[z]/[x]/[y]/__tests__/route.test.ts` | (a) returns binary MVT content type, (b) SQL contains `ST_AsMVT` and `ST_Simplify`, (c) zoom-aware tolerance is applied (`0.01` at z<7, `0.005` at z 7-10, `0.001` at z≥11), (d) plan filter generates correct WHERE clause, (e) owner filter generates correct WHERE clause, (f) returns 204 on empty result, (g) returns 400 on invalid coords, (h) cache headers are set |
| `src/features/map/lib/__tests__/queries.test.ts` (modify) | Update `useMapPlans` tests to assert the URL builder returns correct tile URL pattern with filters baked into query string |
| `src/features/map/lib/__tests__/layers.test.ts` (or equivalent, if exists) | Assert the plans source is a `vector` source (not `geojson`) with the expected tile URL pattern |

### Manual verification (in the local rollout step)

- Pan/zoom around the map with plans layer enabled — tiles load progressively, no whole-world freeze
- Toggle filters (owner, status, fiscal year) — polygons update without page hang
- Zoom country → state → street level — verify simplification tolerance changes appropriately (no jagged edges at low zoom; sharp detail at high zoom)
- Compare visual output to old endpoint side-by-side — should look essentially identical at typical zoom levels
- Network tab: confirm tile responses are KB-scale, not MB-scale, and one tile per visible cell rather than one giant response

## Migration / Rollout

Three-step rollout to keep risk low:

**Step 1 — Ship both endpoints, default to old:**
Land the new MVT endpoint and tests in one PR. The old GeoJSON endpoint stays intact and remains the default consumer. Verify the new endpoint returns valid MVT in dev and staging.

**Step 2 — Switch the client over (separate PR):**
Update `useMapPlans` and the layer config to use the new vector source. Old endpoint still exists but no longer called. Smoke-test in production for ~1 week. If issues surface, revert is a one-line change (point the source URL back at the old GeoJSON endpoint).

**Step 3 — Delete the old endpoint:**
Remove `src/app/api/map/plans/route.ts` and clean up the consumer code. One small PR.

The layer-style migration is the riskiest part — MVT properties might behave subtly differently from GeoJSON properties in MapLibre paint expressions. Splitting the rollout lets you ship the backend safely, then cut over the frontend with full ability to roll back.

## Out of Scope

- **`pool.connect=200ms` overhead** — affects every API route; separate Supabase connection pooling investigation
- **Slow non-plan endpoints** (`/api/leaderboard 5.6s`, `/api/tasks 5.4s`, `/api/calendar 5.5s`, `/api/states 5.2s`, `/api/counties 4.3s` from dev logs) — separate broader DB latency investigation
- **Geometry deduplication** (one feature per district with `plan_ids: []` array instead of one per plan-district pair) — future optimization once MVT is in place; would cut payload another 2–5× when many plans overlap on the same district
- **CDN / edge caching strategy for tiles** — works fine with default Vercel behavior; revisit only if hit rate is poor
- **Approach A as a stopgap** (`ST_SimplifyPreserveTopology` against the existing GeoJSON endpoint) — rejected during brainstorm; throwaway work that ages out within 6–12 months as plan count grows

## Measurements (for reference)

Captured 2026-05-01 against the live Supabase database via temporary instrumentation in `src/app/api/map/plans/route.ts`. Instrumentation reverted after measurement; not in any commit.

```
Owner-filtered (6 rows, current user):
  pool.connect=187ms  query=223ms  mapRows=143ms  JSON.stringify=3ms  total=557ms  payload=220.5KB

Unfiltered (2,211 rows, all plans):
  pool.connect=190ms  query=50,224ms  mapRows=9,232ms  JSON.stringify=478ms  total=60,125ms  payload=86,330KB

Simplification trial (ST_SimplifyPreserveTopology against district_map_features.render_geometry):
  tolerance=0.005°  rows=2,211  payload=3,450KB  query=2,772ms
  tolerance=0.001°  rows=2,211  payload=7,866KB  query=6,391ms
```
