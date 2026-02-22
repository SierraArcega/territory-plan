# Category Color Palettes — Design

**Date:** 2026-02-22
**Status:** Approved

## Problem

Map layer colors (vendor engagement levels, growth/expenditure signals) are hardcoded. Users have no way to customize the color palettes for the categories they're viewing.

## Solution

Let users select from curated color palettes for vendor layers and signal layers, with the picker inline in the LayerBubble. Palette swap is done client-side by regenerating MapLibre match expressions.

## Scope

- **Vendor engagement layers:** Fullmind, Proximity, Elevate, TBT — each gets an independent palette choice
- **Signal layers:** Enrollment, ELL, SWD, Expenditure — share one diverging palette choice
- **Out of scope:** Territory plan colors, tags, services, locale colors

## Approach: Palette Swap via MapLibre Expressions

### Palette Data Model

Each vendor palette is a base color with pre-computed tint/shade stops:

```ts
interface ColorPalette {
  id: string;        // e.g. "plum", "ocean", "forest"
  label: string;     // "Plum", "Ocean", "Forest"
  baseColor: string; // "#403770"
  dotColor: string;  // used in LayerBubble toggle dot
  stops: string[];   // ordered lightest → darkest (7 stops for vendors)
}
```

Signal palettes are diverging scales (positive → neutral → negative) with 5 stops.

Ship ~8-10 vendor palettes (current 4 brand colors + new options) and ~4-5 signal palettes.

### Expression Builder

New functions in `layers.ts`:

- `buildVendorFillExpression(vendorId, palette)` — takes a vendor's tile property and a palette, returns a MapLibre `match` expression. Replaces the hardcoded `FULLMIND_FILL`, `PROXIMITY_FILL`, etc.
- `buildSignalFillExpression(signalId, palette)` — same for signal layers.

The category-to-stop mapping is positional and fixed (e.g. "target" is always the lightest stop). Swapping palettes plugs different hex values into the same slots.

### Store & Persistence

New state in `useMapV2Store`:

- `vendorPalettes: Record<VendorId, string>` — maps each vendor to a palette ID
- `signalPalette: string` — active signal palette ID
- `setVendorPalette(vendorId, paletteId)` and `setSignalPalette(paletteId)` actions

Defaults match today's hardcoded colors (fullmind→plum, proximity→coral, elevate→steel-blue, tbt→golden, signals→mint-coral).

**localStorage persistence:** Own key (`territory-plan:palette-prefs`), loaded on mount. Saved views also capture palette selections (new optional fields on `SavedMapView`).

**Map container integration:** `MapV2Container` calls `buildVendorFillExpression()` instead of reading static `fillColor` from config. On palette change, uses `map.setPaintProperty()` — no layer teardown needed.

### UI — Palette Picker in LayerBubble

- The existing `ColorDot` next to each vendor name becomes clickable
- Clicking reveals an inline row of ~10 small color swatches (the available palettes)
- Active palette gets a ring/check indicator
- For signals: similar row below the active signal's legend, with mini gradient previews (3 dots showing endpoints + midpoint)
- Compact, no popover — single row of circles like the existing `TagsEditor` color picker pattern
- MapLibre interpolates paint property transitions for smooth visual feedback

### Saved Views Compatibility

`SavedMapView` gets two new optional fields:

- `vendorPalettes?: Record<string, string>`
- `signalPalette?: string`

Optional fields ensure backward compatibility with existing saved views (they fall back to defaults).
