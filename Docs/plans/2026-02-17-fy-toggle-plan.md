# Fiscal Year Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the FY selector in the Build View panel switch map shading between fiscal years for Fullmind and competitor layers.

**Architecture:** Pre-compute per-FY category columns in the `district_map_features` materialized view. The tile route accepts a `?fy=` param and aliases the correct FY columns to canonical names (`fullmind_category`, etc.), so frontend filter expressions stay unchanged. MapV2Container appends the selected FY to the tile URL and re-fetches when it changes.

**Tech Stack:** PostgreSQL materialized view, Next.js API route, MapLibre GL JS, Zustand

**Design doc:** `Docs/plans/2026-02-17-fy-toggle-design.md`

---

### Task 1: Update Materialized View with Per-FY Columns

**Files:**
- Modify: `scripts/district-map-features-view.sql`

**Context:** The materialized view currently computes a single `fullmind_category` using FY25→FY26 comparison, and single `proximity_category`, `elevate_category`, `tbt_category` using FY25 vs FY26 competitor spend. We need per-FY versions: `fy25_*` and `fy26_*` for each. The old unqualified column names are removed — the tile route will alias them.

**Step 1: Rewrite the fullmind_cats CTE to produce per-FY columns**

Replace the existing `fullmind_cats` CTE (lines 21-58) with two CTEs:

```sql
fullmind_fy26 AS (
  -- FY26 categories: FY25→FY26 comparison (current logic, unchanged)
  SELECT
    d.leaid,
    CASE
      WHEN COALESCE(d.fy25_net_invoicing, 0) > 0
        AND COALESCE(d.fy26_net_invoicing, 0) > 0
      THEN 'multi_year'
      WHEN COALESCE(d.fy26_net_invoicing, 0) > 0
        AND NOT COALESCE(d.fy25_net_invoicing, 0) > 0
      THEN 'new'
      WHEN COALESCE(d.fy25_net_invoicing, 0) > 0
        AND NOT COALESCE(d.fy26_net_invoicing, 0) > 0
      THEN 'lapsed'
      WHEN COALESCE(d.fy25_net_invoicing, 0) > 0
        AND COALESCE(d.fy26_open_pipeline, 0) > COALESCE(d.fy25_net_invoicing, 0)
      THEN 'expansion_pipeline'
      WHEN COALESCE(d.fy25_net_invoicing, 0) > 0
        AND COALESCE(d.fy26_open_pipeline, 0) > 0
      THEN 'renewal_pipeline'
      WHEN COALESCE(d.fy26_open_pipeline, 0) > 0
        AND ip.leaid IS NOT NULL
      THEN 'new_pipeline'
      WHEN ip.leaid IS NOT NULL
      THEN 'target'
      ELSE NULL
    END AS fy26_fullmind_category
  FROM districts d
  LEFT JOIN in_plan ip ON d.leaid = ip.leaid
),
fullmind_fy25 AS (
  -- FY25 categories: FY24→FY25 comparison
  -- FY24 data not loaded yet, so multi_year/lapsed won't appear until it is.
  -- No fy25_open_pipeline column exists, so pipeline categories are NULL.
  SELECT
    d.leaid,
    CASE
      WHEN COALESCE(d.fy24_net_invoicing, 0) > 0
        AND COALESCE(d.fy25_net_invoicing, 0) > 0
      THEN 'multi_year'
      WHEN COALESCE(d.fy25_net_invoicing, 0) > 0
        AND NOT COALESCE(d.fy24_net_invoicing, 0) > 0
      THEN 'new'
      WHEN COALESCE(d.fy24_net_invoicing, 0) > 0
        AND NOT COALESCE(d.fy25_net_invoicing, 0) > 0
      THEN 'lapsed'
      -- Pipeline: would use fy25_open_pipeline if it existed
      -- For now, fall through to target-only
      WHEN ip.leaid IS NOT NULL
        AND COALESCE(d.fy25_net_invoicing, 0) = 0
      THEN 'target'
      ELSE NULL
    END AS fy25_fullmind_category
  FROM districts d
  LEFT JOIN in_plan ip ON d.leaid = ip.leaid
),
```

**Important:** The `fy24_net_invoicing` column likely does NOT exist on the districts table yet. Before writing this SQL, check if it exists:

```bash
psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'districts' AND column_name LIKE 'fy24%';"
```

If `fy24_net_invoicing` does not exist, use `0` as a constant instead (every `COALESCE(d.fy24_net_invoicing, 0)` becomes just `0`). This means FY25 will only produce `new` (has FY25 revenue) or `target` (in plan, no revenue) until FY24 data is loaded. Update the SQL accordingly.

**Step 2: Rewrite the vendor_cats CTE to produce per-FY columns**

Replace the existing `vendor_cats` CTE (lines 60-77) with:

```sql
vendor_fy26 AS (
  -- FY26 competitor categories: FY25→FY26 comparison (current logic)
  SELECT
    cs.leaid,
    cs.competitor,
    CASE
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY25' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = 'FY26' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'multi_year'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY26' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'new'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY25' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'churned'
      ELSE NULL
    END AS category
  FROM competitor_spend cs
  WHERE cs.competitor IN ('Proximity Learning', 'Elevate K12', 'Tutored By Teachers')
  GROUP BY cs.leaid, cs.competitor
),
vendor_fy25 AS (
  -- FY25 competitor categories: FY24→FY25 comparison
  SELECT
    cs.leaid,
    cs.competitor,
    CASE
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = 'FY25' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'multi_year'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY25' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'new'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'churned'
      ELSE NULL
    END AS category
  FROM competitor_spend cs
  WHERE cs.competitor IN ('Proximity Learning', 'Elevate K12', 'Tutored By Teachers')
  GROUP BY cs.leaid, cs.competitor
),
```

**Step 3: Update the SELECT to output per-FY columns**

Replace the current SELECT (lines 78-133) with:

```sql
SELECT
  d.leaid,
  d.name,
  d.state_abbrev,
  d.sales_executive,
  pm.plan_ids,
  -- Per-FY Fullmind categories
  f26.fy26_fullmind_category,
  f25.fy25_fullmind_category,
  -- Per-FY competitor categories
  MAX(CASE WHEN v26.competitor = 'Proximity Learning' THEN v26.category END) AS fy26_proximity_category,
  MAX(CASE WHEN v26.competitor = 'Elevate K12' THEN v26.category END) AS fy26_elevate_category,
  MAX(CASE WHEN v26.competitor = 'Tutored By Teachers' THEN v26.category END) AS fy26_tbt_category,
  MAX(CASE WHEN v25.competitor = 'Proximity Learning' THEN v25.category END) AS fy25_proximity_category,
  MAX(CASE WHEN v25.competitor = 'Elevate K12' THEN v25.category END) AS fy25_elevate_category,
  MAX(CASE WHEN v25.competitor = 'Tutored By Teachers' THEN v25.category END) AS fy25_tbt_category,
  -- Signal columns (FY-independent, unchanged)
  CASE
    WHEN d.enrollment_trend_3yr >= 5  THEN 'strong_growth'
    WHEN d.enrollment_trend_3yr >= 1  THEN 'growth'
    WHEN d.enrollment_trend_3yr >= -1 THEN 'stable'
    WHEN d.enrollment_trend_3yr >= -5 THEN 'decline'
    WHEN d.enrollment_trend_3yr < -5  THEN 'strong_decline'
    ELSE NULL
  END AS enrollment_signal,
  CASE
    WHEN d.ell_trend_3yr >= 5  THEN 'strong_growth'
    WHEN d.ell_trend_3yr >= 1  THEN 'growth'
    WHEN d.ell_trend_3yr >= -1 THEN 'stable'
    WHEN d.ell_trend_3yr >= -5 THEN 'decline'
    WHEN d.ell_trend_3yr < -5  THEN 'strong_decline'
    ELSE NULL
  END AS ell_signal,
  CASE
    WHEN d.swd_trend_3yr >= 5  THEN 'strong_growth'
    WHEN d.swd_trend_3yr >= 1  THEN 'growth'
    WHEN d.swd_trend_3yr >= -1 THEN 'stable'
    WHEN d.swd_trend_3yr >= -5 THEN 'decline'
    WHEN d.swd_trend_3yr < -5  THEN 'strong_decline'
    ELSE NULL
  END AS swd_signal,
  CASE
    WHEN d.urban_centric_locale IN (11, 12, 13) THEN 'city'
    WHEN d.urban_centric_locale IN (21, 22, 23) THEN 'suburb'
    WHEN d.urban_centric_locale IN (31, 32, 33) THEN 'town'
    WHEN d.urban_centric_locale IN (41, 42, 43) THEN 'rural'
    ELSE NULL
  END AS locale_signal,
  d.expenditure_pp_quartile_state AS expenditure_signal,
  d.geometry,
  d.account_type,
  d.point_location,
  COALESCE(d.geometry, d.point_location) AS render_geometry
FROM districts d
LEFT JOIN plan_memberships pm ON d.leaid = pm.leaid
LEFT JOIN fullmind_fy26 f26 ON d.leaid = f26.leaid
LEFT JOIN fullmind_fy25 f25 ON d.leaid = f25.leaid
LEFT JOIN vendor_fy26 v26 ON d.leaid = v26.leaid
LEFT JOIN vendor_fy25 v25 ON d.leaid = v25.leaid
WHERE d.geometry IS NOT NULL OR d.point_location IS NOT NULL
GROUP BY d.leaid, d.name, d.state_abbrev, d.sales_executive,
         pm.plan_ids, f26.fy26_fullmind_category, f25.fy25_fullmind_category,
         d.geometry, d.account_type, d.point_location;
```

**Step 4: Update the indexes**

Replace the `idx_dmf_has_data` index (lines 141-145) with:

```sql
CREATE INDEX idx_dmf_has_data_fy26 ON district_map_features(fy26_fullmind_category)
  WHERE fy26_fullmind_category IS NOT NULL
     OR fy26_proximity_category IS NOT NULL
     OR fy26_elevate_category IS NOT NULL
     OR fy26_tbt_category IS NOT NULL;

CREATE INDEX idx_dmf_has_data_fy25 ON district_map_features(fy25_fullmind_category)
  WHERE fy25_fullmind_category IS NOT NULL
     OR fy25_proximity_category IS NOT NULL
     OR fy25_elevate_category IS NOT NULL
     OR fy25_tbt_category IS NOT NULL;
```

**Step 5: Update the summary query**

Replace the summary SELECT (lines 150-156) with:

```sql
SELECT
  'district_map_features created: ' || COUNT(*) || ' districts' AS status,
  COUNT(*) FILTER (WHERE fy26_fullmind_category IS NOT NULL) AS fy26_fullmind,
  COUNT(*) FILTER (WHERE fy25_fullmind_category IS NOT NULL) AS fy25_fullmind,
  COUNT(*) FILTER (WHERE fy26_proximity_category IS NOT NULL) AS fy26_proximity,
  COUNT(*) FILTER (WHERE fy25_proximity_category IS NOT NULL) AS fy25_proximity,
  COUNT(*) FILTER (WHERE fy26_elevate_category IS NOT NULL) AS fy26_elevate,
  COUNT(*) FILTER (WHERE fy26_tbt_category IS NOT NULL) AS fy26_tbt
FROM district_map_features;
```

**Step 6: Commit**

```bash
git add scripts/district-map-features-view.sql
git commit -m "feat: add per-FY category columns to district_map_features view"
```

---

### Task 2: Update Tile Route to Accept FY Param

**Files:**
- Modify: `src/app/api/tiles/[z]/[x]/[y]/route.ts`

**Context:** The tile route currently selects `d.fullmind_category`, `d.proximity_category`, etc. directly from the materialized view. Those unqualified columns no longer exist — we need to read the `?fy=` param and alias the correct per-FY columns to the canonical names the frontend expects.

**Step 1: Add FY param parsing after line 25**

After the existing `stateFilter` line (line 25), add:

```typescript
    const fyParam = searchParams.get("fy") || "fy26";
    const fy = fyParam === "fy25" ? "fy25" : "fy26"; // whitelist valid values
```

**Step 2: Replace the hardcoded column names in the query**

Replace lines 46-49:

```typescript
          d.fullmind_category,
          d.proximity_category,
          d.elevate_category,
          d.tbt_category,
```

With FY-aware aliases:

```typescript
          d.${fy}_fullmind_category AS fullmind_category,
          d.${fy}_proximity_category AS proximity_category,
          d.${fy}_elevate_category AS elevate_category,
          d.${fy}_tbt_category AS tbt_category,
```

**Step 3: Update the national view filter (lines 70-75)**

Replace the `isNationalView` WHERE clause column references:

```typescript
          ${isNationalView ? `AND (
            d.${fy}_fullmind_category IS NOT NULL
            OR d.${fy}_proximity_category IS NOT NULL
            OR d.${fy}_elevate_category IS NOT NULL
            OR d.${fy}_tbt_category IS NOT NULL
          )` : ""}
```

**Step 4: Verify the full query looks correct**

The complete `tile_data` SELECT should now be:

```typescript
    const query = `
      WITH tile_bounds AS (
        SELECT
          ST_TileEnvelope($1, $2, $3) AS envelope,
          ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS envelope_4326
      ),
      tile_data AS (
        SELECT
          d.leaid,
          d.name,
          d.state_abbrev,
          d.sales_executive,
          d.plan_ids,
          d.${fy}_fullmind_category AS fullmind_category,
          d.${fy}_proximity_category AS proximity_category,
          d.${fy}_elevate_category AS elevate_category,
          d.${fy}_tbt_category AS tbt_category,
          d.enrollment_signal,
          d.ell_signal,
          d.swd_signal,
          d.locale_signal,
          d.expenditure_signal,
          d.account_type,
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
        WHERE d.render_geometry IS NOT NULL
          AND d.render_geometry && (SELECT envelope_4326 FROM tile_bounds)
          ${stateFilter ? "AND d.state_abbrev = $4" : ""}
          ${isNationalView ? `AND (
            d.${fy}_fullmind_category IS NOT NULL
            OR d.${fy}_proximity_category IS NOT NULL
            OR d.${fy}_elevate_category IS NOT NULL
            OR d.${fy}_tbt_category IS NOT NULL
          )` : ""}
      )
      SELECT ST_AsMVT(tile_data, 'districts', 4096, 'geom') AS mvt
      FROM tile_data
      WHERE geom IS NOT NULL
    `;
```

**Step 5: Commit**

```bash
git add src/app/api/tiles/[z]/[x]/[y]/route.ts
git commit -m "feat: tile route accepts ?fy= param to select fiscal year columns"
```

---

### Task 3: Wire FY Selection to Tile Source in MapV2Container

**Files:**
- Modify: `src/components/map-v2/MapV2Container.tsx`

**Context:** MapV2Container creates the MapLibre tile source at line 176-181 with a hardcoded URL. When `selectedFiscalYear` changes in the store, we need to update the source URL so MapLibre fetches tiles with the new FY's data. MapLibre vector sources support `setTiles()` to change the URL without recreating the source.

**Step 1: Add store subscription for selectedFiscalYear**

Find the block of `useMapV2Store` subscriptions near the top of the component. Add:

```typescript
const selectedFiscalYear = useMapV2Store((s) => s.selectedFiscalYear);
```

**Step 2: Include FY in the initial tile source URL**

Replace line 178:

```typescript
        tiles: [`${window.location.origin}/api/tiles/{z}/{x}/{y}?v=4`],
```

With:

```typescript
        tiles: [`${window.location.origin}/api/tiles/{z}/{x}/{y}?v=4&fy=fy26`],
```

(Hardcode `fy26` for the initial load since the store default is `fy26` and the map loads once.)

**Step 3: Add a useEffect to update tiles when FY changes**

Add a new `useEffect` after the existing filter effects. This effect watches `selectedFiscalYear` and calls `setTiles()` on the districts source:

```typescript
  // Update tile source when fiscal year changes
  useEffect(() => {
    if (!map.current) return;
    const source = map.current.getSource("districts") as maplibregl.VectorTileSource | undefined;
    if (!source) return;

    const newUrl = `${window.location.origin}/api/tiles/{z}/{x}/{y}?v=4&fy=${selectedFiscalYear}`;
    (source as any).setTiles([newUrl]);

    // Force re-render of all tiles by clearing cache
    map.current.style?.sourceCaches?.["districts"]?.clearTiles();
    map.current.triggerRepaint();
  }, [selectedFiscalYear]);
```

**Important notes:**
- `setTiles()` is available on MapLibre's `VectorTileSource` but may not be in the TypeScript types — hence the `as any` cast.
- `clearTiles()` + `triggerRepaint()` ensures MapLibre actually re-fetches instead of serving from cache. If `clearTiles()` doesn't exist or doesn't work, an alternative is to remove and re-add the source, but try this first.
- If `clearTiles()` is not available, try: `map.current.getSource("districts")` → remove all layers → remove source → re-add source with new URL → re-add all layers. This is heavier but guaranteed to work.

**Step 4: Test locally**

Run: `npm run dev`
1. Open the map, open Build View panel
2. Switch FY dropdown from FY26 to FY25
3. Verify: map polygons re-shade (districts that were multi_year in FY26 may show differently in FY25)
4. Switch back to FY26 — verify original shading returns
5. Verify: Signals, Locale, Schools layers are unaffected by FY switch

**Step 5: Commit**

```bash
git add src/components/map-v2/MapV2Container.tsx
git commit -m "feat: wire FY selector to tile source URL for live FY switching"
```

---

### Task 4: Run Materialized View and Verify

**Files:**
- No code changes — database operation

**Context:** After Tasks 1-3 are committed, the materialized view needs to be rebuilt against the live database for the FY toggle to work.

**Step 1: Run the updated materialized view SQL**

```bash
psql "$DATABASE_URL" -f scripts/district-map-features-view.sql
```

Expected output: summary row showing `fy26_fullmind`, `fy25_fullmind`, etc. counts.

**Step 2: Verify the new columns exist**

```bash
psql "$DATABASE_URL" -c "SELECT fy26_fullmind_category, fy25_fullmind_category, fy26_proximity_category, fy25_proximity_category FROM district_map_features LIMIT 5;"
```

Expected: rows with category values (or NULL) in the new per-FY columns.

**Step 3: Spot-check FY25 data**

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FILTER (WHERE fy25_fullmind_category IS NOT NULL) AS fy25_fullmind, COUNT(*) FILTER (WHERE fy26_fullmind_category IS NOT NULL) AS fy26_fullmind FROM district_map_features;"
```

FY25 count should be > 0 if any districts have `fy25_net_invoicing`. FY26 count should match the old `fullmind_category` count.

**Step 4: Test the tile route with curl**

```bash
curl -s "http://localhost:3005/api/tiles/5/8/12?fy=fy26" | wc -c
curl -s "http://localhost:3005/api/tiles/5/8/12?fy=fy25" | wc -c
```

Both should return non-zero byte counts (MVT data). The FY25 tiles may be smaller if fewer districts have FY25 data.

**Step 5: End-to-end browser test**

1. Open `http://localhost:3005` and navigate to Map V2
2. Open Build View panel
3. Default is FY26 — verify Fullmind/competitor shading looks normal
4. Switch to FY25 — verify shading changes
5. Toggle engagement filters (Target, Pipeline, etc.) in FY25 — should still work
6. Switch back to FY26 — verify original shading returns
7. Open/close Signals, Locale, Schools — verify unaffected by FY
