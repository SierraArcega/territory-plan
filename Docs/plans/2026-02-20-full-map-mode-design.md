# Full Map Mode — Collapsible Panel Design

## Goal

Allow the user to fully hide the floating left panel (IconBar + content) to get an immersive, full-screen map view with only the LayerBubble visible.

## State Model

Replace `panelCollapsed: boolean` with a 3-state enum:

```ts
type PanelMode = "full" | "collapsed" | "hidden";
```

- **full** — expanded panel (icon bar + content area)
- **collapsed** — icon bar only (56px strip)
- **hidden** — entire panel gone, full-screen map

Store changes:
- Remove `panelCollapsed` and `setPanelCollapsed`
- Add `panelMode: PanelMode` (default: `"full"`)
- Add `setPanelMode(mode: PanelMode)`

## UX Flow

```
[Full Panel] --click chevron--> [Collapsed / Icon Bar Only]
[Collapsed]  --click chevron--> [Hidden / Full Map]
[Hidden]     --click restore--> [Full Panel]
```

Progressive collapse: a chevron button at the top of the IconBar steps through modes. The restore button jumps back to full.

## Restore Button

When `panelMode === "hidden"`, a small floating button appears at **top-left** (`top-10 left-12` — same position the panel normally occupies).

Styling matches the LayerBubble pill: `bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60`. Contains a hamburger/menu icon. Clicking it sets `panelMode → "full"`.

## Animation

FloatingPanel slides out to the left with `translate-x` + opacity transition (~200ms ease-out) when entering hidden mode. Restore button fades in after panel exits.

## Mobile

`panelMode === "hidden"` hides the mobile bottom bar entirely. Restore button positioned bottom-left on mobile.

## Files Touched

1. `src/lib/map-v2-store.ts` — replace `panelCollapsed` with `panelMode` enum
2. `src/components/map-v2/FloatingPanel.tsx` — consume new state, hidden mode, restore button
3. `src/components/map-v2/IconBar.tsx` — add collapse/hide chevron at top
4. All callers of `setPanelCollapsed` — update to `setPanelMode`
