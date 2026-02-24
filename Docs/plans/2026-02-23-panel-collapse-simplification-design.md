# Panel Collapse Simplification

## Problem

The floating panel has a three-stage collapse: full → collapsed (icon strip only) → hidden (pill). The middle "collapsed" state (56px icon strip with no content) isn't useful — it's an awkward in-between that adds a click before reaching the pill.

## Design

Reduce `panelMode` to a two-state toggle: `"full" | "hidden"`.

- Clicking the chevron in the IconBar collapses directly to the "Menu" pill
- Clicking the pill expands back to full
- Tablet auto-collapse goes to `"hidden"` instead of `"collapsed"`
- Mobile follows the same two-state pattern: full drawer or pill

## Changes

### store.ts
- `panelMode` type: `"full" | "collapsed" | "hidden"` → `"full" | "hidden"`
- `setPanelMode` signature updated to match
- `collapsePanel`: toggles `full ↔ hidden`

### FloatingPanel.tsx
- Remove collapsed-specific rendering branch (icon-strip-only at 56px width)
- Remove `panelMode === "collapsed"` from bottom-positioning logic
- Tablet auto-collapse targets `"hidden"`
- Mobile: remove collapsed bar, just full drawer or pill

### IconBar.tsx
- No change — already calls `collapsePanel()`

### No API or data changes
