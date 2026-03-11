# LayerBubble Per-Category Controls — Design

**Goal:** Give users direct color and opacity control over every individual map category (engagement levels, signal buckets) with inline controls, replace the auto-shading palette system with per-category overrides, scale up the UI for readability, and warn on unsaved changes.

**Architecture:** Palettes become presets that populate per-category color state. Each category row gets an inline swatch picker and opacity slider. MapLibre expressions are built from per-category state instead of palette stops. Unsaved-changes detection compares current state to a snapshot taken on save/load.

**Tech Stack:** React 19, Zustand, MapLibre GL, Tailwind CSS 4, localStorage

---

## 1. Data Model — Per-Category Color + Opacity State

### New store state

```ts
// Per-category color overrides (hex).
// Key format: "${vendorOrSignalId}:${categoryName}"
// e.g., "fullmind:target", "proximity:churned", "enrollment:growth"
categoryColors: Record<string, string>;

// Per-category opacity overrides (0–1). Same key format.
categoryOpacities: Record<string, number>;
```

### Key format

`"${vendorOrSignalId}:${categoryName}"`:
- Fullmind: `fullmind:target`, `fullmind:pipeline`, `fullmind:first_year`, `fullmind:multi_year`, `fullmind:lapsed`
- Competitors: `proximity:churned`, `proximity:new`, `proximity:multi_year` (same for elevate, tbt)
- Signals (growth-type): `enrollment:strong_growth`, `enrollment:growth`, `enrollment:stable`, `enrollment:decline`, `enrollment:strong_decline`
- Signals (expenditure): `expenditure:well_above`, `expenditure:above`, `expenditure:below`, `expenditure:well_below`

### Defaults

When no override exists, fall back to the palette-derived color and the vendor's config default opacity.

### Palette as preset

When the user picks a palette (e.g. "Coral"), it writes all derived stop colors into `categoryColors` for that vendor/signal. The user can then tweak individual categories. Changing palette again overwrites all of them.

### Persistence

Added to the existing `territory-plan:palette-prefs` localStorage key alongside existing fields. On page load, if no saved per-category state exists, derive from current palette defaults.

### MapLibre wiring

- `buildVendorFillExpression` and `buildSignalFillExpression` take per-category colors directly (a `Record<string, string>` of category→hex) instead of palette stops.
- New `fill-opacity` match expression per layer built from per-category opacities, so each category renders at its own opacity.
- UseEffect in MapV2Container reacts to `categoryColors` and `categoryOpacities` changes.

## 2. Unsaved Changes Warning

### Detection

Store a `lastSavedSnapshot` — a serializable subset of the map state (vendors, filters, colors, opacities, signal, engagement filters). Set on:
- Initial page load (from defaults or loaded prefs)
- Save view action
- Load view action

Compare current state against snapshot to determine if unsaved changes exist.

### Behavior

- User clicks outside or presses Escape to close LayerBubble
- If unsaved changes detected: instead of closing, show inline bar at bottom of popover: **"Unsaved changes"** with **Save** and **Dismiss** buttons
- **Save** → opens existing save dialog
- **Dismiss** → closes popover (changes persist in store for the session but won't survive reload unless in a saved view)
- If no unsaved changes: closes normally

### Scope

Only checks map layer customizations — not transient UI state (expanded sections, dropdown states, etc.).

## 3. Scale Increase

Proportional bump across all LayerBubble sizing:

| Element | Before | After |
|---------|--------|-------|
| Popover width | 320px | 380px |
| Section headers | `text-[10px]` | `text-xs` (12px) |
| Body text / labels | `text-sm` (14px) | `text-[15px]` |
| Checkboxes | `w-3.5 h-3.5` | `w-4 h-4` |
| Color dots | `w-2.5 h-2.5` | `w-3 h-3` |
| Row padding | `px-3` | `px-4` |
| Row vertical padding | `py-1` | `py-1.5` |
| Select/input padding | `py-1.5` | `py-2` |
| Select/input text | `text-sm` | `text-[15px]` |

No layout restructuring — proportional increase for readability and touch targets.

## 4. Inline Per-Category Controls Layout

### Category row — new layout

```
[checkbox] [dot ▼] Pipeline          [==opacity slider==] 75%
           [swatch row, if dot clicked]
```

### Color dot

Clickable. Clicking expands an inline swatch row below that specific category row (not the whole vendor).

### Swatch row

~10-12 preset hex colors: current palette stops for context, plus common colors (reds, greens, blues, grays, golden). Clicking a swatch sets `categoryColors[key]` to that hex value.

### Opacity slider

Right-aligned in the row, always visible. Thin `accent-plum` range input (0–100%). Updates `categoryOpacities[key]`.

### Vendor-level palette picker

Moves to the vendor header row (next to "FULLMIND" / competitor name). Picking a palette resets all that vendor's category colors at once. The vendor-level opacity slider is removed (replaced by per-category sliders).

### Signal categories

Same treatment — each signal legend item (Strong Growth, Growth, Stable, Decline, Strong Decline / Well Above, Above, Below, Well Below) gets clickable dot + inline swatch + opacity slider.
