# Multi-Vendor Layer System Design

**Date:** 2026-02-15
**Branch:** `feature/map-v2-prototype`
**Phase:** 1 of N (vendor layers + owner/plan filters)

## Problem

The current layer system is a single-select radio: pick one of 7 views (customers, competitors, state, etc.). Three of the seven layers are broken (enrollment, revenue, owner reference fields not in tiles). The system can't answer questions like "show me Sarah's districts, colored by which vendors are active there, with Fullmind and Elevate toggled on."

## Decision

Replace the single-layer picker with a multi-vendor toggle system + AND-filters. Each vendor gets its own semi-transparent MapLibre layer. Filters (owner, plan) narrow which districts are visible. All data is pre-computed in an enriched materialized view and shipped in vector tiles for instant client-side filtering.

## Phase 1 Scope

- 4 vendor layers (Fullmind, Proximity, Elevate, TBT) — each independently toggleable
- Fullmind gets 4-tier pipeline shading: target → new pipeline → renewal → expansion
- Competitors get 3-tier shading: churned → new → multi-year
- Owner filter (single-select dropdown)
- Plan filter (single-select dropdown)
- Enriched materialized view + unified tile endpoint

**Out of scope (Phase 2+):** Locale filter, ELL/SWD flags, fiscal year filter, enrollment ranges, additional data dimensions.

## Data Architecture

### New Materialized View: `district_map_features`

Replaces both `district_customer_categories` and `district_vendor_comparison`.

**Properties per district:**

| Property | Type | Source | Purpose |
|----------|------|--------|---------|
| `leaid` | varchar(7) | districts | PK |
| `name` | varchar | districts | Display |
| `state_abbrev` | varchar(2) | districts | Display + future filter |
| `sales_executive` | varchar | districts | Owner filter |
| `plan_ids` | text | territory_plan_districts | Plan filter (comma-separated) |
| `fullmind_category` | varchar | Computed | Fullmind layer shading |
| `proximity_category` | varchar | competitor_spend | Proximity layer shading |
| `elevate_category` | varchar | competitor_spend | Elevate layer shading |
| `tbt_category` | varchar | competitor_spend | TBT layer shading |
| `geometry` | geometry | districts | Map rendering |

### Fullmind Category Logic

Evaluated in priority order (first match wins):

| Category | Condition | Shade |
|----------|-----------|-------|
| `expansion_pipeline` | FY25 revenue > 0 AND FY26 pipeline > FY25 revenue | Darkest |
| `renewal_pipeline` | FY25 revenue > 0 AND FY26 pipeline > 0 AND pipeline <= FY25 revenue | Dark |
| `new_pipeline` | No FY25 revenue AND FY26 pipeline > 0 AND in a territory plan | Medium |
| `target` | In a territory plan, no pipeline, no revenue | Lightest |
| `multi_year` | FY25 revenue > 0 AND FY26 revenue > 0 | (Existing customer — darkest) |
| `new` | FY26 revenue > 0, no FY25 revenue | (New customer) |
| `lapsed` | FY25 revenue > 0, no FY26 revenue | (Lost customer) |
| NULL | No relationship | Not rendered |

### Competitor Category Logic (per vendor)

| Category | Condition | Shade |
|----------|-----------|-------|
| `multi_year` | Spend in FY25 AND FY26 | Darkest |
| `new` | Spend in FY26, not FY25 | Medium |
| `churned` | Spend in FY25, not FY26 | Lightest |
| NULL | No spend | Not rendered |

## Rendering Architecture

### MapLibre Layer Stack

```
1. district-base-fill        — Light gray for ALL districts (background)
2. district-base-boundary    — Thin gray boundary
3. district-fullmind-fill    — Fullmind shading (opacity ~0.55)
4. district-proximity-fill   — Proximity shading (opacity ~0.55)
5. district-elevate-fill     — Elevate shading (opacity ~0.55)
6. district-tbt-fill         — TBT shading (opacity ~0.55)
7. district-hover-fill       — Hover highlight (unchanged)
8. district-selected-fill    — Selection highlight (unchanged)
```

Each vendor layer is a separate fill layer on the same vector tile source. Toggling = `setLayoutProperty(layerId, "visibility", "visible"/"none")`.

### Color Palette (from fullmind-brand.md tint/shade tables)

| Vendor | Hue | Lightest → Darkest shading |
|--------|-----|---------------------------|
| **Fullmind** | Plum `#403770` | `#ecebf1` → `#b3afc6` → `#665f8d` → `#403770` |
| **Proximity** | Coral `#F37167` | `#fef1f0` → `#f58d85` → `#F37167` |
| **Elevate** | Steel Blue `#6EA3BE` | `#f1f6f9` → `#8bb5cb` → `#6EA3BE` |
| **TBT** | Golden `#FFCF70` | `#fffaf1` → `#ffd98d` → `#FFCF70` |

At 55% opacity, overlapping vendor layers produce visually distinct blended tones.

### Filter Expressions

Filters AND together and apply to all vendor layers + base layer simultaneously:

```js
// Owner filter
["==", ["get", "sales_executive"], "Sarah"]

// Plan filter (plan_ids is comma-separated)
["in", "plan123", ["string", ["get", "plan_ids"]]]

// Combined
["all",
  ["==", ["get", "sales_executive"], "Sarah"],
  ["in", "plan123", ["string", ["get", "plan_ids"]]]
]
```

## Tile Route Changes

### Unified Endpoint

Replace the `?layer=customer|vendor` branching with a single query against `district_map_features`:

```sql
SELECT
  d.leaid, d.name, d.state_abbrev,
  d.sales_executive, d.plan_ids,
  d.fullmind_category, d.proximity_category,
  d.elevate_category, d.tbt_category,
  ST_AsMVTGeom(...) AS geom
FROM district_map_features d
WHERE d.geometry IS NOT NULL
  AND d.geometry && tile_bounds
```

At national zoom (< 6), add: `AND (fullmind_category IS NOT NULL OR proximity_category IS NOT NULL OR elevate_category IS NOT NULL OR tbt_category IS NOT NULL)` to avoid sending 13K empty polygons.

### Materialized View Refresh

Same pattern as today: `REFRESH MATERIALIZED VIEW district_map_features;` triggered after CRM sync, plan changes, or competitor spend imports.

## LayerBubble UI

### Collapsed Pill

Summary text: "2 vendors · 1 filter" or "Fullmind" (single vendor, no filters) or "All districts" (nothing active). Same bottom-right position, same expand-on-click.

### Expanded Popover (~320px)

```
┌─────────────────────────────┐
│  MAP LAYERS            ✕    │
│─────────────────────────────│
│  FILTERS                    │
│  ┌─ Owner ──────── ▾ ─────┐│
│  │ All Owners              ││
│  └─────────────────────────┘│
│  ┌─ Plan ───────── ▾ ─────┐│
│  │ All Plans               ││
│  └─────────────────────────┘│
│─────────────────────────────│
│  VENDOR LAYERS              │
│  ☑ Fullmind                 │
│  ☑ Proximity Learning       │
│  ☐ Elevate K12              │
│  ☐ Tutored by Teachers      │
│                             │
│  Darker = deeper engagement │
└─────────────────────────────┘
```

- Filter dropdowns fetch available values (owner names, plan names) from existing API endpoints
- Vendor checkboxes toggle independently; at least one must remain on
- Tooltip on hover over vendor name: "target → pipeline → renewal → expansion" (Fullmind) or "churned → new → multi-year" (competitors)
- `text-[11px] text-gray-400 italic` for the shading hint

## Zustand Store Changes

### Remove
- `activeLayer: LayerType`
- `setActiveLayer()`
- `LayerType` type (replaced)

### Add

```typescript
type VendorId = "fullmind" | "proximity" | "elevate" | "tbt";

// State
activeVendors: Set<VendorId>       // default: Set(["fullmind"])
filterOwner: string | null          // null = all
filterPlanId: string | null         // null = all

// Actions
toggleVendor: (vendor: VendorId) => void
setFilterOwner: (owner: string | null) => void
setFilterPlanId: (planId: string | null) => void
```

## Files Touched

| Action | File |
|--------|------|
| **New** | `scripts/district-map-features-view.sql` |
| **Rewrite** | `src/components/map-v2/LayerBubble.tsx` |
| **Rewrite** | `src/lib/map-v2-layers.ts` |
| **Modify** | `src/lib/map-v2-store.ts` |
| **Modify** | `src/app/api/tiles/[z]/[x]/[y]/route.ts` |
| **Modify** | `src/components/map-v2/MapV2Container.tsx` |
| **Delete** | `src/components/map-v2/LayerPicker.tsx` (dead code) |
| **Delete** | `src/components/map-v2/LayerLegend.tsx` (dead code) |

## Future (Phase 2+)

- Additional filter dropdowns: State, Locale, Fiscal Year
- Boolean filter toggles: Above Avg ELL, Above Avg SWD
- Hybrid API fallback for long-tail filter dimensions if tiles get too heavy
