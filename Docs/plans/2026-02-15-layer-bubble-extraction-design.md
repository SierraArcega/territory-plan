# Layer Bubble Extraction Design

**Date:** 2026-02-15
**Branch:** `feature/map-v2-prototype`

## Problem

The map v2 floating panel currently mixes two concerns: layer/map-visualization controls and territory workflow (districts, plans, search). The Layers icon tab routes to BrowsePanel which bundles search, layer picker, and legend — making the panel feel crowded and blurring its purpose. Layers are a map-level control that should live closer to the map, not buried in the workflow panel.

## Decision

Extract layer functionality (LayerPicker + LayerLegend) into a standalone floating bubble in the bottom-right corner of the map. The main panel becomes home base for exploring districts, managing plans, and search.

## Design

### New Component: `LayerBubble`

**Position:** `absolute bottom-6 right-6 z-10`

**Collapsed state (default):**
- Small rounded pill (~160px wide): active layer color dot + label + chevron
- Styling: `bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60`
- Text: `text-sm font-medium text-plum` (brand: Plum `#403770`)
- Hover: subtle lift (`hover:shadow-xl`)

**Expanded state (click to open):**
- Popover card (~280px wide) that grows upward from the pill
- Contains:
  1. Header row: "Map Layer" label + close button (x icon, `text-gray-400 hover:text-plum`)
  2. Layer picker: list of 7 layer options (reuse existing layer data from LayerPicker)
  3. Legend: color swatches + labels for the active layer
- Background: `bg-white rounded-xl shadow-xl border border-gray-200`
- Animation: scale+fade from bottom-right origin (`transform-origin: bottom right`)
- Close triggers: click outside, press Escape, click close button

**Mobile:** Same position and behavior. Independent of the panel drawer.

### Store Changes (`map-v2-store.ts`)

```
- IconBarTab type: "layers" → "search"
- New state: layerBubbleOpen: boolean (default false)
- New actions: toggleLayerBubble(), setLayerBubbleOpen(open: boolean)
- Update setActiveIconTab: "layers" branch → "search" branch
```

### IconBar Changes

- Replace tab: `{ id: "search", icon: "search", label: "Search" }`
- New magnifying glass SVG in TabIcon switch
- Remove layers SVG from TabIcon (moves to LayerBubble)

### BrowsePanel → SearchPanel

Rename file. Strip LayerPicker, LayerLegend, and legend list. Keep SearchBar as the primary element. Clean search/explore interface.

### PanelContent Routing

```
- activeIconTab === "home" → HomePanel (unchanged)
- activeIconTab === "search" → SearchPanel (was BrowsePanel via "layers")
- activeIconTab === "plans" → PlansListPanel (unchanged)
- Default fallback → SearchPanel (was BrowsePanel)
```

### MapV2Shell

Add `<LayerBubble />` as sibling to FloatingPanel and MultiSelectChip.

### FloatingPanel (mobile)

Update collapsed mobile bar icon from layers SVG to a compass/explore icon matching the new search-first identity.

## Brand Compliance

Per `fullmind-brand.md`:
- **Pill text:** Plum `#403770` — primary UI color
- **Backgrounds:** `bg-white/95` with `backdrop-blur-sm` — light style tooltips/popovers per brand
- **Layer color dots:** existing brand-compliant palette
- **Close button:** `text-gray-400 hover:text-plum` — Plum for interactive states
- **Popover border/shadow:** `border border-gray-200 shadow-xl` — matches brand tooltip pattern
- **Typography:** Inherits Plus Jakarta Sans from app, `text-sm` for content, `text-xs font-medium text-gray-400 uppercase tracking-wider` for section labels
- **Spacing:** `p-3` card padding, `gap-1.5` between legend items — per brand spacing scale
- **Icons:** Simple, single-color, Plum or gray — per brand icon rules

## Files Touched

| Action | File |
|--------|------|
| **New** | `src/components/map-v2/LayerBubble.tsx` |
| **Rename** | `panels/BrowsePanel.tsx` → `panels/SearchPanel.tsx` |
| **Edit** | `src/lib/map-v2-store.ts` |
| **Edit** | `src/components/map-v2/IconBar.tsx` |
| **Edit** | `src/components/map-v2/PanelContent.tsx` |
| **Edit** | `src/components/map-v2/MapV2Shell.tsx` |
| **Edit** | `src/components/map-v2/FloatingPanel.tsx` |

## Out of Scope (Future)

- Activity log / task tracking in the panel
- Faceted district browse/filter in SearchPanel
- Layer filtering by clicking legend entries on the bubble
