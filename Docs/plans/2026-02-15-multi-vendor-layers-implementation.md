# Multi-Vendor Layer System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-layer picker with a multi-vendor toggle system (Fullmind + 3 competitors) with per-vendor shading and AND-filters for owner/plan.

**Architecture:** New materialized view (`district_map_features`) pre-computes per-vendor categories and filter fields for all 13K districts. Unified tile endpoint exports everything. Client creates 4 independent semi-transparent MapLibre fill layers, one per vendor. LayerBubble UI rebuilt with vendor checkboxes + filter dropdowns.

**Tech Stack:** PostgreSQL/PostGIS, Next.js 16, React 19, Zustand, MapLibre GL, Tailwind CSS

**Design doc:** `docs/plans/2026-02-15-multi-vendor-layers-design.md`
**Brand guide:** `Docs/fullmind-brand.md`

---

### Task 1: Create the `district_map_features` Materialized View

**Files:**
- Create: `scripts/district-map-features-view.sql`

**Step 1: Write the SQL script**

Create `scripts/district-map-features-view.sql` with this exact content:

```sql
-- Multi-vendor layer materialized view
-- Replaces district_customer_categories and district_vendor_comparison
-- Exports all filter + vendor category fields for vector tiles

DROP MATERIALIZED VIEW IF EXISTS district_map_features;

CREATE MATERIALIZED VIEW district_map_features AS
WITH plan_memberships AS (
  -- Comma-separated plan IDs per district
  SELECT
    district_leaid AS leaid,
    STRING_AGG(plan_id, ',' ORDER BY plan_id) AS plan_ids
  FROM territory_plan_districts
  GROUP BY district_leaid
),
in_plan AS (
  -- Simple boolean: is this district in ANY plan?
  SELECT DISTINCT district_leaid AS leaid
  FROM territory_plan_districts
),
fullmind_cats AS (
  SELECT
    d.leaid,
    CASE
      -- Active customers (have FY26 revenue)
      WHEN COALESCE(d.fy25_net_invoicing, 0) > 0
        AND COALESCE(d.fy26_net_invoicing, 0) > 0
      THEN 'multi_year'

      WHEN COALESCE(d.fy26_net_invoicing, 0) > 0
        AND NOT COALESCE(d.fy25_net_invoicing, 0) > 0
      THEN 'new'

      WHEN COALESCE(d.fy25_net_invoicing, 0) > 0
        AND NOT COALESCE(d.fy26_net_invoicing, 0) > 0
      THEN 'lapsed'

      -- Pipeline stages (no FY26 revenue yet)
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
    END AS fullmind_category
  FROM districts d
  LEFT JOIN in_plan ip ON d.leaid = ip.leaid
),
-- Per-vendor competitor categories
vendor_cats AS (
  SELECT
    cs.leaid,
    cs.competitor,
    CASE
      WHEN SUM(CASE WHEN cs.fiscal_year = '2025' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = '2026' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'multi_year'
      WHEN SUM(CASE WHEN cs.fiscal_year = '2026' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'new'
      WHEN SUM(CASE WHEN cs.fiscal_year = '2025' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'churned'
      ELSE NULL
    END AS category
  FROM competitor_spend cs
  WHERE cs.competitor IN ('Proximity Learning', 'Elevate K12', 'Tutored By Teachers')
  GROUP BY cs.leaid, cs.competitor
)
SELECT
  d.leaid,
  d.name,
  d.state_abbrev,
  d.sales_executive,
  pm.plan_ids,
  fc.fullmind_category,
  MAX(CASE WHEN vc.competitor = 'Proximity Learning' THEN vc.category END) AS proximity_category,
  MAX(CASE WHEN vc.competitor = 'Elevate K12' THEN vc.category END) AS elevate_category,
  MAX(CASE WHEN vc.competitor = 'Tutored By Teachers' THEN vc.category END) AS tbt_category,
  d.geometry
FROM districts d
LEFT JOIN plan_memberships pm ON d.leaid = pm.leaid
LEFT JOIN fullmind_cats fc ON d.leaid = fc.leaid
LEFT JOIN vendor_cats vc ON d.leaid = vc.leaid
GROUP BY d.leaid, d.name, d.state_abbrev, d.sales_executive,
         pm.plan_ids, fc.fullmind_category, d.geometry;

-- Indexes
CREATE INDEX idx_dmf_leaid ON district_map_features(leaid);
CREATE INDEX idx_dmf_state ON district_map_features(state_abbrev);
CREATE INDEX idx_dmf_owner ON district_map_features(sales_executive);
CREATE INDEX idx_dmf_geometry ON district_map_features USING GIST(geometry);
CREATE INDEX idx_dmf_has_data ON district_map_features(fullmind_category)
  WHERE fullmind_category IS NOT NULL
     OR proximity_category IS NOT NULL
     OR elevate_category IS NOT NULL
     OR tbt_category IS NOT NULL;

ANALYZE district_map_features;

-- Summary
SELECT
  'district_map_features created: ' || COUNT(*) || ' districts' AS status,
  COUNT(*) FILTER (WHERE fullmind_category IS NOT NULL) AS fullmind_districts,
  COUNT(*) FILTER (WHERE proximity_category IS NOT NULL) AS proximity_districts,
  COUNT(*) FILTER (WHERE elevate_category IS NOT NULL) AS elevate_districts,
  COUNT(*) FILTER (WHERE tbt_category IS NOT NULL) AS tbt_districts
FROM district_map_features;
```

**Step 2: Run the SQL against the database**

```bash
cd territory-plan
source .env
psql "$DIRECT_URL" -f scripts/district-map-features-view.sql
```

Expected: View created with ~13K rows, summary showing counts per vendor.

**Step 3: Commit**

```bash
git add scripts/district-map-features-view.sql
git commit -m "feat(data): add district_map_features materialized view

Pre-computes per-vendor categories (fullmind, proximity, elevate, tbt)
and filter fields (sales_executive, plan_ids) for enriched vector tiles."
```

---

### Task 2: Update Tile Route to Use Unified View

**Files:**
- Modify: `src/app/api/tiles/[z]/[x]/[y]/route.ts`

**Step 1: Rewrite the tile route**

Replace the entire contents of `src/app/api/tiles/[z]/[x]/[y]/route.ts` with:

```typescript
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

    // Get optional state filter
    const { searchParams } = new URL(request.url);
    const stateFilter = searchParams.get("state");

    // At low zoom (national view), only load districts with vendor data
    const isNationalView = zoom < 6 && !stateFilter;

    // Geometry simplification tolerance based on zoom level
    const simplifyTolerance = zoom < 5 ? 0.01 : zoom < 7 ? 0.005 : 0.001;

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
          d.fullmind_category,
          d.proximity_category,
          d.elevate_category,
          d.tbt_category,
          ST_AsMVTGeom(
            ST_Transform(
              ST_Simplify(d.geometry, ${simplifyTolerance}),
              3857
            ),
            (SELECT envelope FROM tile_bounds),
            4096,
            64,
            true
          ) AS geom
        FROM district_map_features d
        WHERE d.geometry IS NOT NULL
          AND d.geometry && (SELECT envelope_4326 FROM tile_bounds)
          ${stateFilter ? "AND d.state_abbrev = $4" : ""}
          ${isNationalView ? `AND (
            d.fullmind_category IS NOT NULL
            OR d.proximity_category IS NOT NULL
            OR d.elevate_category IS NOT NULL
            OR d.tbt_category IS NOT NULL
          )` : ""}
      )
      SELECT ST_AsMVT(tile_data, 'districts', 4096, 'geom') AS mvt
      FROM tile_data
      WHERE geom IS NOT NULL
    `;

    const queryParams = stateFilter
      ? [zoom, tileX, tileY, stateFilter]
      : [zoom, tileX, tileY];

    const client = await pool.connect();
    try {
      const result = await client.query(query, queryParams);
      const mvt = result.rows[0]?.mvt;

      if (!mvt || mvt.length === 0) {
        return new NextResponse(null, {
          status: 204,
          headers: {
            "Content-Type": "application/vnd.mapbox-vector-tile",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }

      const cacheTime = isNationalView ? 86400 : 3600;

      return new NextResponse(mvt, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.mapbox-vector-tile",
          "Cache-Control": `public, max-age=${cacheTime}`,
          "Content-Length": mvt.length.toString(),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error generating tile:", error);
    return NextResponse.json(
      { error: "Failed to generate tile" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify build**

Run: `cd territory-plan && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/api/tiles/[z]/[x]/[y]/route.ts
git commit -m "feat(tiles): unified tile endpoint using district_map_features

Exports all vendor categories + filter fields in a single MVT layer.
Removes the customer/vendor layer toggle."
```

---

### Task 3: Rewrite `map-v2-layers.ts` for Vendor Paint Configs

**Files:**
- Rewrite: `src/lib/map-v2-layers.ts`

**Step 1: Replace the entire file**

Replace all contents of `src/lib/map-v2-layers.ts` with:

```typescript
import type { ExpressionSpecification } from "maplibre-gl";

// ============================================
// Vendor definitions
// ============================================

export type VendorId = "fullmind" | "proximity" | "elevate" | "tbt";

export interface VendorConfig {
  id: VendorId;
  label: string;
  /** The tile property that holds this vendor's category */
  tileProperty: string;
  /** Fill color expression: match on category → brand tint/shade */
  fillColor: ExpressionSpecification;
  fillOpacity: number;
  /** Tooltip describing the shading progression */
  shadingTooltip: string;
}

// Fullmind shading: target (lightest) → expansion_pipeline (darkest)
// Plus existing customer categories: lapsed, new, multi_year
// Colors from brand Plum tint/shade table
const FULLMIND_FILL: ExpressionSpecification = [
  "match",
  ["get", "fullmind_category"],
  "target", "#ecebf1",             // Plum 90% tint (lightest)
  "new_pipeline", "#b3afc6",       // Plum 50% tint
  "renewal_pipeline", "#665f8d",   // Plum 20% shade
  "expansion_pipeline", "#403770", // Plum (full)
  "lapsed", "#d9d7e2",             // Plum 80% tint
  "new", "#8c87a9",                // Plum 40% tint
  "multi_year", "#403770",         // Plum (full)
  "rgba(0,0,0,0)",                 // Transparent if no category
];

// Competitor shading: churned (lightest) → multi_year (darkest)
// Colors from brand Coral tint/shade table
const PROXIMITY_FILL: ExpressionSpecification = [
  "match",
  ["get", "proximity_category"],
  "churned", "#fef1f0",   // Coral 90% tint (lightest)
  "new", "#f58d85",        // Coral 20% tint
  "multi_year", "#F37167", // Coral (full)
  "rgba(0,0,0,0)",
];

// Colors from brand Steel Blue tint/shade table
const ELEVATE_FILL: ExpressionSpecification = [
  "match",
  ["get", "elevate_category"],
  "churned", "#f1f6f9",   // Steel Blue 90% tint (lightest)
  "new", "#8bb5cb",        // Steel Blue 20% tint
  "multi_year", "#6EA3BE", // Steel Blue (full)
  "rgba(0,0,0,0)",
];

// Colors from brand Golden tint/shade table
const TBT_FILL: ExpressionSpecification = [
  "match",
  ["get", "tbt_category"],
  "churned", "#fffaf1",   // Golden 90% tint (lightest)
  "new", "#ffd98d",        // Golden 20% tint
  "multi_year", "#FFCF70", // Golden (full)
  "rgba(0,0,0,0)",
];

export const VENDOR_CONFIGS: Record<VendorId, VendorConfig> = {
  fullmind: {
    id: "fullmind",
    label: "Fullmind",
    tileProperty: "fullmind_category",
    fillColor: FULLMIND_FILL,
    fillOpacity: 0.55,
    shadingTooltip: "target \u203a pipeline \u203a renewal \u203a expansion",
  },
  proximity: {
    id: "proximity",
    label: "Proximity Learning",
    tileProperty: "proximity_category",
    fillColor: PROXIMITY_FILL,
    fillOpacity: 0.55,
    shadingTooltip: "churned \u203a new \u203a multi-year",
  },
  elevate: {
    id: "elevate",
    label: "Elevate K12",
    tileProperty: "elevate_category",
    fillColor: ELEVATE_FILL,
    fillOpacity: 0.55,
    shadingTooltip: "churned \u203a new \u203a multi-year",
  },
  tbt: {
    id: "tbt",
    label: "Tutored by Teachers",
    tileProperty: "tbt_category",
    fillColor: TBT_FILL,
    fillOpacity: 0.55,
    shadingTooltip: "churned \u203a new \u203a multi-year",
  },
};

export const VENDOR_IDS: VendorId[] = ["fullmind", "proximity", "elevate", "tbt"];

// ============================================
// Filter helpers
// ============================================

/**
 * Build a combined MapLibre filter expression from active filters.
 * Returns null if no filters are active (show all districts).
 */
export function buildFilterExpression(
  filterOwner: string | null,
  filterPlanId: string | null,
): ExpressionSpecification | null {
  const conditions: ExpressionSpecification[] = [];

  if (filterOwner) {
    conditions.push(["==", ["get", "sales_executive"], filterOwner]);
  }

  if (filterPlanId) {
    // plan_ids is comma-separated; use "in" substring match
    conditions.push([
      "!=",
      ["index-of", filterPlanId, ["coalesce", ["get", "plan_ids"], ""]],
      -1,
    ]);
  }

  if (conditions.length === 0) return null;
  if (conditions.length === 1) return conditions[0];
  return ["all", ...conditions] as ExpressionSpecification;
}
```

**Step 2: Verify build**

Run: `cd territory-plan && npx next build 2>&1 | tail -20`

Note: Build will have errors because MapV2Container and LayerBubble still import old exports (`getLayerConfig`, `LayerType`). Expected — we fix those in Tasks 4-5.

**Step 3: Commit**

```bash
git add src/lib/map-v2-layers.ts
git commit -m "feat(layers): rewrite layer config for multi-vendor system

Per-vendor paint expressions using brand tint/shade colors.
Fullmind: 7-tier shading (target→multi_year).
Competitors: 3-tier shading (churned→multi_year).
Filter expression builder for owner/plan AND-filters."
```

---

### Task 4: Update Zustand Store for Multi-Vendor State

**Files:**
- Modify: `src/lib/map-v2-store.ts`

**Step 1: Replace old layer state with multi-vendor state**

In `src/lib/map-v2-store.ts`, make these edits:

1. **Replace the imports and types at the top (lines 12-20).** Remove the `LayerType` type entirely. Add:

```typescript
import type { VendorId } from "@/lib/map-v2-layers";
```

(Add this as the second line of the file, after the zustand import.)

2. **Remove from `MapV2State` interface (line 53-54):**
```typescript
  // Active layer
  activeLayer: LayerType;
```

Replace with:
```typescript
  // Multi-vendor layers
  activeVendors: Set<VendorId>;
  filterOwner: string | null;
  filterPlanId: string | null;
```

3. **Remove from `MapV2Actions` interface (lines 92-93):**
```typescript
  // Layer
  setActiveLayer: (layer: LayerType) => void;
```

Replace with:
```typescript
  // Vendor layers & filters
  toggleVendor: (vendor: VendorId) => void;
  setFilterOwner: (owner: string | null) => void;
  setFilterPlanId: (planId: string | null) => void;
```

4. **In the store initializer (line 152):** Remove `activeLayer: "customers",` and add:
```typescript
  activeVendors: new Set<VendorId>(["fullmind"]),
  filterOwner: null,
  filterPlanId: null,
```

5. **Replace the `setActiveLayer` action (lines 187-188)** with:
```typescript
  // Vendor layers & filters
  toggleVendor: (vendor) =>
    set((s) => {
      const next = new Set(s.activeVendors);
      if (next.has(vendor)) {
        // Don't allow unchecking the last vendor
        if (next.size > 1) next.delete(vendor);
      } else {
        next.add(vendor);
      }
      return { activeVendors: next };
    }),

  setFilterOwner: (owner) => set({ filterOwner: owner }),
  setFilterPlanId: (planId) => set({ filterPlanId: planId }),
```

**Step 2: Verify build**

Run: `cd territory-plan && npx next build 2>&1 | tail -20`

Note: Will have errors from MapV2Container and LayerBubble referencing `activeLayer`. Expected — fixed in next tasks.

**Step 3: Commit**

```bash
git add src/lib/map-v2-store.ts
git commit -m "feat(store): replace activeLayer with multi-vendor state

activeVendors Set, filterOwner, filterPlanId, toggleVendor action
with minimum-one-vendor guard."
```

---

### Task 5: Rewrite MapV2Container Layer Creation & Effects

**Files:**
- Modify: `src/components/map-v2/MapV2Container.tsx`

This is the biggest task. Three changes inside MapV2Container:

**Step 1: Update store destructuring (line 110-124)**

Replace:
```typescript
  const {
    selectedLeaid,
    hoveredLeaid,
    activeLayer,
    panelState,
    ...
  } = useMapV2Store();
```

With:
```typescript
  const {
    selectedLeaid,
    hoveredLeaid,
    activeVendors,
    filterOwner,
    filterPlanId,
    panelState,
    selectDistrict,
    selectState,
    setHoveredLeaid,
    showTooltip,
    hideTooltip,
    updateTooltipPosition,
    addClickRipple,
    addDistrictToPlan,
    toggleDistrictSelection,
  } = useMapV2Store();
```

Also update the import at line 7:
```typescript
// Before
import { getLayerConfig } from "@/lib/map-v2-layers";

// After
import { VENDOR_CONFIGS, VENDOR_IDS, buildFilterExpression } from "@/lib/map-v2-layers";
```

**Step 2: Replace the layer creation block (lines 208-273)**

Remove everything from `// District customer fill` through `// Non-customer boundary` (the 4 layers: `district-customer-fill`, `district-customer-boundary`, `district-fill`, `district-boundary`).

Replace with:

```typescript
      // Base fill for all districts (light gray background)
      map.current.addLayer({
        id: "district-base-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        minzoom: 5,
        paint: {
          "fill-color": "#E5E7EB",
          "fill-opacity": 0.4,
        },
      });

      // Base boundary for all districts
      map.current.addLayer({
        id: "district-base-boundary",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        minzoom: 5,
        paint: {
          "line-color": "#374151",
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.2, 7, 0.6, 10, 1],
          "line-opacity": 0.4,
        },
      });

      // Per-vendor fill layers (stacked, semi-transparent)
      for (const vendorId of ["fullmind", "proximity", "elevate", "tbt"] as const) {
        const config = VENDOR_CONFIGS[vendorId];
        map.current.addLayer({
          id: `district-${vendorId}-fill`,
          type: "fill",
          source: "districts",
          "source-layer": "districts",
          filter: ["has", config.tileProperty],
          paint: {
            "fill-color": config.fillColor as any,
            "fill-opacity": config.fillOpacity,
            "fill-opacity-transition": { duration: 150 },
          },
          layout: {
            visibility: vendorId === "fullmind" ? "visible" : "none",
          },
        });
      }
```

**Step 3: Update the hover handler query layers (line 346-351)**

Replace:
```typescript
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: [
          "district-customer-fill",
          "district-fill",
        ],
      });
```

With:
```typescript
      const queryLayers = [
        "district-base-fill",
        ...VENDOR_IDS.map((v) => `district-${v}-fill`),
      ];
      // Only query layers that actually exist on the map
      const activeLayers = queryLayers.filter(
        (id) => map.current?.getLayer(id)
      );
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: activeLayers,
      });
```

**Step 4: Update the click handler query layers (line 425-427)**

Same replacement pattern:
```typescript
      const districtFeatures = map.current.queryRenderedFeatures(e.point, {
        layers: [
          "district-base-fill",
          ...VENDOR_IDS.map((v) => `district-${v}-fill`),
        ].filter((id) => map.current?.getLayer(id)),
      });
```

**Step 5: Replace the activeLayer effect (lines 526-555)**

Remove the entire `useEffect` that watches `activeLayer`. Replace with two new effects:

```typescript
  // Toggle vendor layer visibility
  useEffect(() => {
    if (!map.current || !mapReady) return;
    for (const vendorId of VENDOR_IDS) {
      const layerId = `district-${vendorId}-fill`;
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(
          layerId,
          "visibility",
          activeVendors.has(vendorId) ? "visible" : "none"
        );
      }
    }
  }, [activeVendors, mapReady]);

  // Apply filter expression to all layers
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const filter = buildFilterExpression(filterOwner, filterPlanId);

    // Apply to base layers
    map.current.setFilter("district-base-fill", filter);
    map.current.setFilter("district-base-boundary", filter);

    // Apply to each vendor layer (combine with the vendor's own "has" filter)
    for (const vendorId of VENDOR_IDS) {
      const layerId = `district-${vendorId}-fill`;
      if (!map.current.getLayer(layerId)) continue;
      const config = VENDOR_CONFIGS[vendorId];
      const vendorFilter: any = ["has", config.tileProperty];
      const combined = filter
        ? ["all", vendorFilter, filter]
        : vendorFilter;
      map.current.setFilter(layerId, combined);
    }
  }, [filterOwner, filterPlanId, mapReady]);
```

**Step 6: Verify build**

Run: `cd territory-plan && npx next build 2>&1 | tail -20`

Note: LayerBubble still references old types — that's Task 6. MapV2Container should compile if the store and layers imports are correct.

**Step 7: Commit**

```bash
git add src/components/map-v2/MapV2Container.tsx
git commit -m "feat(map): 4-layer vendor rendering with filter effects

Creates independent MapLibre fill layers per vendor with toggle
visibility. Applies combined AND-filter expressions across all layers."
```

---

### Task 6: Rewrite LayerBubble UI

**Files:**
- Rewrite: `src/components/map-v2/LayerBubble.tsx`

**Step 1: Replace the entire file**

Replace all contents of `src/components/map-v2/LayerBubble.tsx` with:

```tsx
"use client";

import { useRef, useEffect, useState } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { VENDOR_CONFIGS, VENDOR_IDS, type VendorId } from "@/lib/map-v2-layers";

export default function LayerBubble() {
  const activeVendors = useMapV2Store((s) => s.activeVendors);
  const toggleVendor = useMapV2Store((s) => s.toggleVendor);
  const filterOwner = useMapV2Store((s) => s.filterOwner);
  const setFilterOwner = useMapV2Store((s) => s.setFilterOwner);
  const filterPlanId = useMapV2Store((s) => s.filterPlanId);
  const setFilterPlanId = useMapV2Store((s) => s.setFilterPlanId);
  const layerBubbleOpen = useMapV2Store((s) => s.layerBubbleOpen);
  const setLayerBubbleOpen = useMapV2Store((s) => s.setLayerBubbleOpen);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch filter options
  const [owners, setOwners] = useState<string[]>([]);
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    // Fetch distinct owners
    fetch("/api/sales-executives")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setOwners(data.map?.((d: any) => d.name || d) || []))
      .catch(() => {});
    // Fetch plans
    fetch("/api/territory-plans")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setPlans(data.map?.((d: any) => ({ id: d.id, name: d.name })) || []))
      .catch(() => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!layerBubbleOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setLayerBubbleOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [layerBubbleOpen, setLayerBubbleOpen]);

  // Close on Escape
  useEffect(() => {
    if (!layerBubbleOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setLayerBubbleOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [layerBubbleOpen, setLayerBubbleOpen]);

  // Build summary text for the collapsed pill
  const vendorCount = activeVendors.size;
  const filterCount = (filterOwner ? 1 : 0) + (filterPlanId ? 1 : 0);
  let pillText = "";
  if (vendorCount === 1) {
    const v = VENDOR_CONFIGS[[...activeVendors][0]];
    pillText = v?.label || "Fullmind";
  } else {
    pillText = `${vendorCount} vendors`;
  }
  if (filterCount > 0) {
    pillText += ` · ${filterCount} filter${filterCount > 1 ? "s" : ""}`;
  }

  return (
    <div ref={ref} className="absolute bottom-6 right-6 z-10">
      {/* Expanded popover */}
      {layerBubbleOpen && (
        <div
          className="absolute bottom-full right-0 mb-2 w-[320px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          style={{ transformOrigin: "bottom right" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Map Layers
            </span>
            <button
              onClick={() => setLayerBubbleOpen(false)}
              className="w-5 h-5 rounded-md flex items-center justify-center text-gray-400 hover:text-plum hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Filters */}
          <div className="px-3 pb-2 space-y-2">
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              Filters
            </div>

            {/* Owner filter */}
            <select
              value={filterOwner || ""}
              onChange={(e) => setFilterOwner(e.target.value || null)}
              className="w-full text-sm bg-gray-50 border border-gray-200/60 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30"
            >
              <option value="">All Owners</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>

            {/* Plan filter */}
            <select
              value={filterPlanId || ""}
              onChange={(e) => setFilterPlanId(e.target.value || null)}
              className="w-full text-sm bg-gray-50 border border-gray-200/60 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30"
            >
              <option value="">All Plans</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </div>

          {/* Vendor layers */}
          <div className="px-3 pb-2 pt-1 border-t border-gray-100">
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 mt-2">
              Vendor Layers
            </div>
            <div className="space-y-0.5">
              {VENDOR_IDS.map((vendorId) => {
                const config = VENDOR_CONFIGS[vendorId];
                const isActive = activeVendors.has(vendorId);
                const isLastActive = isActive && activeVendors.size === 1;

                return (
                  <label
                    key={vendorId}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors group ${
                      isActive ? "bg-plum/5" : "hover:bg-gray-50"
                    }`}
                    title={config.shadingTooltip}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      disabled={isLastActive}
                      onChange={() => toggleVendor(vendorId)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-plum focus:ring-plum/30 disabled:opacity-40"
                    />
                    <span className={`text-sm ${isActive ? "font-medium text-plum" : "text-gray-600"}`}>
                      {config.label}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Shading hint */}
            <p className="text-[11px] text-gray-400 italic mt-2 mb-1">
              Darker = deeper engagement
            </p>
          </div>
        </div>
      )}

      {/* Collapsed pill */}
      <button
        onClick={() => setLayerBubbleOpen(!layerBubbleOpen)}
        className={`
          flex items-center gap-2 px-3 py-2
          bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60
          hover:shadow-xl transition-all duration-150
          ${layerBubbleOpen ? "ring-2 ring-plum/20" : ""}
        `}
        aria-label="Map layers. Click to configure."
      >
        {/* Stacked vendor dots */}
        <div className="flex -space-x-1">
          {VENDOR_IDS.filter((v) => activeVendors.has(v)).map((vendorId) => {
            const colors: Record<VendorId, string> = {
              fullmind: "#403770",
              proximity: "#F37167",
              elevate: "#6EA3BE",
              tbt: "#FFCF70",
            };
            return (
              <span
                key={vendorId}
                className="w-2.5 h-2.5 rounded-full border border-white"
                style={{ backgroundColor: colors[vendorId] }}
              />
            );
          })}
        </div>
        <span className="text-sm font-medium text-gray-700">{pillText}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`text-gray-400 transition-transform duration-150 ${layerBubbleOpen ? "rotate-180" : ""}`}
        >
          <path d="M2.5 6.5L5 4L7.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd territory-plan && npx next build 2>&1 | tail -20`

Expected: Build succeeds (all imports resolved).

**Step 3: Commit**

```bash
git add src/components/map-v2/LayerBubble.tsx
git commit -m "feat(ui): rewrite LayerBubble with vendor toggles and filters

Vendor checkboxes with minimum-one guard, owner/plan dropdowns,
'Darker = deeper engagement' hint, dynamic pill summary."
```

---

### Task 7: Delete Dead Code

**Files:**
- Delete: `src/components/map-v2/LayerPicker.tsx`
- Delete: `src/components/map-v2/LayerLegend.tsx`

**Step 1: Verify no remaining imports**

```bash
cd territory-plan && grep -r "LayerPicker\|LayerLegend\|getLayerConfig\|LayerType" src/ --include="*.tsx" --include="*.ts"
```

Expected: No results. If anything still references these, fix the import before deleting.

**Step 2: Delete the files**

```bash
cd territory-plan
git rm src/components/map-v2/LayerPicker.tsx
git rm src/components/map-v2/LayerLegend.tsx
```

**Step 3: Verify build**

Run: `cd territory-plan && npx next build 2>&1 | tail -20`

Expected: Clean build.

**Step 4: Commit**

```bash
git commit -m "chore: remove dead LayerPicker and LayerLegend components"
```

---

### Task 8: Final Build + Smoke Test

**Step 1: Full build**

Run: `cd territory-plan && npx next build 2>&1 | tail -20`

Expected: Clean build, no errors.

**Step 2: Dev server smoke test**

Run: `cd territory-plan && npm run dev`

Open `http://localhost:3000/map-v2` and verify:

- [ ] **Layer bubble pill** at bottom-right shows "Fullmind"
- [ ] **Click pill** → popover expands with Filters section + Vendor Layers section
- [ ] **Owner dropdown** lists sales executives, selecting one filters the map
- [ ] **Plan dropdown** lists territory plans, selecting one filters the map
- [ ] **Vendor checkboxes** — check Proximity → coral-tinted districts appear overlapping Fullmind purple
- [ ] **Multiple vendors** — check 3 vendors, see blended colors on overlap districts
- [ ] **Last vendor guard** — can't uncheck the only remaining vendor
- [ ] **"Darker = deeper engagement"** hint visible at bottom of vendor section
- [ ] **Hover tooltip** on vendor checkbox label shows shading progression
- [ ] **Pill summary updates** — "2 vendors · 1 filter" etc.
- [ ] **District hover** still works (hover highlight + tooltip)
- [ ] **District click** still works (selection + detail panel)
- [ ] **Escape key** still works (close bubble, deselect, zoom out)
- [ ] **Mobile layout** (resize to <640px) — bubble still visible and functional

**Step 3: Commit any fixups**

```bash
git add -A
git commit -m "chore(map-v2): final verification of multi-vendor layer system"
```
