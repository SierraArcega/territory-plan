# Unified Layer Control

**Date:** 2026-03-18
**Status:** Draft

## Problem

The map currently has two separate layer control mechanisms:

1. **Layer Bubble** — a "Build a Map View" popover for district choropleth visualization (vendor colors, engagement filters, signals, locale, school types, saved views)
2. **Layer Drawer** — a collapsible panel for toggling overlay pin layers (contacts, vacancies, activities, plans) with per-layer filters

Having both creates UI clutter and a fragmented mental model. Users need a single, unified way to compose map views that combine district visualization with overlay data to support decision-making.

## Design

### Approach: Two-Tier (Quick Toggles + Detail Drawer)

A compact toggle bar for fast layer on/off, with a detail drawer that slides open for per-layer filters and styling. Toggle-first for daily rep use; deeper controls available for reporting.

### Component 1: Toggle Bar

A floating bar anchored at the **bottom-left of the map**, always visible.

**Structure:**
- `LAYERS` label followed by a row of toggle chips
- Fixed chip order: Districts, Plans, Contacts, Vacancies, Activities
- Each chip has a colored dot matching its layer color
- Districts chip is always active (cannot be toggled off) — it is the base map layer

**Chip states:**
- **Inactive:** Light background (`#f0edf5`), muted text, desaturated dot
- **Active:** Filled with the layer's brand color, white text, white dot
  - Districts: `#403770` (plum)
  - Plans: `#7B6BA4` (light plum)
  - Contacts: `#F37167` (coral)
  - Vacancies: `#FFCF70` (golden)
  - Activities: `#6EA3BE` (steel blue)

**Interactions:**
- **Click chip** → toggle layer on/off (except Districts, which is always on)
- **Gear icon** (appears on active chips) → open detail drawer for that layer
- **Active overlay chips** show feature count badges (e.g., "247", "18")

**Styling:**
- Semi-transparent background (`rgba(255,255,255,0.95)`) — avoid `backdrop-filter: blur()` as it causes compositing overhead on the WebGL canvas, especially on lower-end GPUs
- Pill shape (`border-radius: 24px`)
- Compact: `padding: 6px 10px`, chip font size `12-13px`

**Extensibility:** New layer types = new chip. Overflow handling deferred until needed (current five chips fit comfortably).

### Component 2: Tabbed Results Panel

The existing right-side search results panel becomes a **tabbed viewport** driven by active layers.

**Behavior:**
- Toggling a layer on adds a tab to the results panel; toggling off removes it
- Each tab shows entity-specific cards with counts (e.g., "Districts 142", "Vacancies 18")
- The Districts tab is always present (Districts layer cannot be toggled off)
- Tabs appear in fixed order: Districts, Plans, Contacts, Vacancies, Activities (matches toggle bar order)
- Only tabs for active layers are shown

**Tab content:**
- Each tab has its own card format appropriate to the entity type
- Clicking a card (or clicking an item on the map) opens entity detail in the panel
- Bulk actions (Add to Plan, Export) are available per tab where applicable

**Interaction with search bar:**
- Search bar filters continue to apply to the Districts tab
- Layer-specific filters (from the detail drawer) apply to their respective tabs

**Key principle:** Switching tabs does NOT change what's on the map — all active layers remain visible. Tabs control what you're browsing in the results panel.

### Component 3: Detail Drawer

A compact popover that opens from the toggle bar when clicking the gear icon on an active chip. One drawer open at a time.

**Districts drawer** (richest):
- **Filters section:** State, Owner, Engagement dropdowns
- **Color By:** Chip selector for the visualization dimension — Engagement, Enrollment, ELL, SWD, Expenditure, Locale. Replaces the old separate Sales Data / Market Data / Signals sections with a single "what dimension should districts be colored by?" choice. When "Engagement" is selected, all active vendor layers display simultaneously (preserving current multi-vendor overlay behavior); other dimensions show a single choropleth layer.
- **Customize Colors** (collapsed by default): Palette pickers, per-category color swatches, opacity sliders. Available for reporting and presentation use cases but not in the way for daily toggle-oriented use.

**Overlay drawers** (Contacts, Vacancies, Activities, Plans — simpler):
- **Filters section:** Entity-specific filter dropdowns (e.g., Category + Status for Vacancies, Type + Status for Activities, Seniority + Persona for Contacts, Status for Plans)
- **Date Range** (Vacancies, Activities): Quick presets (7d, 30d, 90d, YTD, All) + custom date inputs

**Styling:**
- White background, rounded corners (`border-radius: 12px`), shadow
- Slides up from the toggle bar, visually anchored to it
- Max width ~340px
- Compact sections with clear labels

**Drawer filters apply to both the map AND the corresponding results panel tab.**

### Component 4: Saved Views

A bookmark icon in the toggle bar opens a saved views dropdown. Saves the full configuration: which layers are active, filter states, color-by selection, and customization settings. Accessible without adding complexity to the detail drawer.

## Navigation Model

### Two primary navigable entities
- **Districts** — click a district polygon on the map or a card in the Districts results tab → district detail opens in the panel (with existing tabs: Planning, Signals, Schools, Contacts)
- **Plans** — click a plan polygon on the map or a card in the Plans results tab → plan workspace opens in the panel

### Contextual overlay entities
- **Contacts, Vacancies, Activities** — visible as pins on the map and browsable in results panel tabs. Detail is accessed through district drill-in (the district detail panel already has tabs/cards for these entities).

### Map click behavior (hit-test priority)

When multiple layers are active, clicks are resolved in top-down priority order. The first layer with a feature under the cursor wins:

1. `activities-pins`
2. `vacancies-pins`
3. `contacts-pins`
4. `plans-fill` / `plans-outline`
5. `schools-unclustered`
6. `district-base-fill`
7. `state-fill`

**Overlay pin clicks:** Clicking an overlay pin (contact, vacancy, activity) switches the results panel to that entity's tab and highlights/scrolls to the matching card. This gives the user context without leaving the map-centric workflow. The district detail panel remains available by clicking on the district polygon directly.

**Hover conflicts:** The same priority order applies to hover. When the cursor is over a pin that sits on a district polygon, the district hover highlight should NOT activate — only the topmost layer's hover effect fires.

### Toggle bar ↔ results panel connection
- Toggle a layer on → it appears on the map AND gets a tab in the results panel
- Toggle a layer off → removed from map AND tab removed from results panel
- The results panel opens automatically when any layer is toggled on (if not already open)

## What This Replaces

| Current | Unified |
|---------|---------|
| Layer Bubble "Build View" popover (1,993 lines) | Toggle bar + Districts detail drawer |
| Layer Drawer hamburger panel (262 lines) | Toggle bar chips for overlay layers |
| Separate search results panel (districts only) | Tabbed results panel (all active entity types) |
| Sales Data / Market Data / Signals sections | "Color By" chip selector in Districts drawer |
| Per-vendor palette/engagement sections | Simplified filters + collapsed Customize section |

## State Management

The unified control consolidates state from both the existing map store and the overlay store:

**Toggle bar state:**
- `activeLayers: Set<LayerType>` — which layers are on (replaces `activeVendors`, `activeLayers` from both stores)
- `activeDetailDrawer: LayerType | null` — which drawer is open

**Per-layer filter state:**
- `layerFilters: Record<LayerType, LayerFilterState>` — filter values per layer
- `dateRange: Record<LayerType, DateRange>` — per-layer date ranges for time-based layers (Vacancies and Activities have independent date filters)
- `colorBy: ColorDimension` — what dimension districts are colored by (replaces `activeSignal` + vendor layer logic)

**Styling state (preserved from layer bubble):**
- `vendorPalettes`, `categoryColors`, `categoryOpacities` — unchanged, accessed through Customize section

**Results panel state:**
- `activeResultsTab: LayerType` — which tab is selected in the results panel

## Relationship to Existing Search & Explore

The tabbed results panel **replaces** the current search results panel (SearchResults component). It subsumes the district-only results view into a multi-entity tabbed view.

The Explore Data overlay (ExploreOverlay — the tabular data grid) remains a **separate feature**. It serves a different purpose (bulk data analysis) and is accessed via the icon bar, not the toggle bar.

Existing `searchFilters` continue to drive the Districts tab content. The new `layerFilters` drive overlay tab content. These are independent filter systems — search bar filters do not affect overlay layers, and layer drawer filters do not affect district search results.

**Feature count badges** on toggle bar chips reflect the count of features currently loaded and matching filters (not viewport-limited). This matches the existing layer drawer behavior.

## MapLibre Implementation Guidance

### Layer/source strategy

All overlay layers (contacts, vacancies, activities, plans) should be **pre-created at map init** with empty GeoJSON FeatureCollections. Toggle visibility via `map.setLayoutProperty(layerId, "visibility", "visible" | "none")`. When a layer is toggled on, fetch data and call `source.setData(geojson)`. When toggled off, set visibility to `"none"` (data stays cached). Do NOT use dynamic `addLayer`/`removeLayer` — it creates z-ordering fragility and forces source re-parsing.

### Render stack (z-order, bottom to top)

```
district-base-fill
district-{vendor}-fill (×5, semi-transparent, overlapping)
district-signal-fill
district-locale-fill
district-hover / district-selected / district-search (interaction layers)
plans-fill (low opacity or outline-only — see Plans visual treatment)
plans-outline
contacts-pins
vacancies-pins
activities-pins
schools-unclustered
```

Layers are added in this order at init. Point layers render above polygon layers.

### Plans visual treatment

Plans are territory polygons that overlap district polygons. To avoid obscuring the district choropleth, Plans should render as **outline-only** (`fill-opacity: 0` with a `line` layer for the border) or with a very low fill opacity (~0.1) plus a dashed outline. The plan's color (`#7B6BA4`) applies to the outline/border.

### Clustering

Overlay layers that could exceed ~500 features (especially contacts) should enable clustering on the GeoJSON source:

```
{ cluster: true, clusterRadius: 50, clusterMaxZoom: 12 }
```

This requires a separate circle layer for cluster bubbles with a count label (`["get", "point_count"]`).

### Performance considerations

- **GeoJSON source updates** (`source.setData()`) parse on the main thread. Keep payloads under ~1,000 features. For larger datasets, use server-side viewport clipping (the existing bounds-based query pattern) or serve as vector tiles.
- **Filter debouncing:** When overlay filters change (e.g., date range), debounce `setPaintProperty`/`setFilter` calls by 200-300ms to avoid thrashing.
- **Feature count badges** must come from the API response data, not `queryRenderedFeatures` — invisible layers return no features from queries.
- **`setPaintProperty` for Color By switching** is cheap — MapLibre handles paint property changes efficiently without shader recompilation. Switching between vendor fill and signal fill is a `setLayoutProperty` visibility toggle plus a `setPaintProperty` call.

### Overlay filtering strategy

Overlay filters (category, status, date range) should be applied **server-side** in the API query rather than as MapLibre layer filter expressions. This avoids shipping all-time data to the client and keeps GeoJSON payloads small. The API already supports this pattern for the existing overlay queries (`useMapContacts`, `useMapVacancies`, etc.).

## Design Priorities

1. **Toggle-first** — one click to compose a view. This is the daily rep use case.
2. **Styling available but tucked away** — color/opacity controls for reporting, not in the way for daily use.
3. **Extensible** — adding a new layer type means adding a chip and a drawer template.
4. **Unified mental model** — everything is a "layer" you toggle on to see on the map and browse in the results panel.
