# Floating District Detail Panel Design

## Goal

Replace the cramped 280px right-panel district card with a separate, draggable floating panel (400px x 70vh) that shows the full tabbed district view. A live SVG tether line connects the panel to the district's location on the map, updating in real time as the map pans/zooms or the panel is dragged.

## Architecture

The district detail becomes an independent floating component rendered as a sibling of the main FloatingPanel, not nested inside it. This decouples the detail view from the plan panel's layout constraints.

**Key components:**
- `FloatingDistrictDetail` — draggable container with header, tabs, plan actions footer
- `TetherLine` — SVG overlay drawing a connector from district point to panel edge
- Store changes — `rightPanelContent` replaced with a dedicated `detailPopout` state for the floating panel

## Panel Layout

- **Size**: 400px wide, 70vh tall
- **Default position**: Horizontally centered on the visible map area (right of main panel), vertically centered
- **Style**: `bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg` — same visual language as the main panel
- **Header**: "District" label left, close (X) button right. Entire header row is the drag handle (`cursor: grab`).
- **Content**: Full tabbed view — DistrictHeader + Info / Data+Demographics / Contacts tabs (reuses existing components from `panels/district/`)
- **Footer** (plan context only): "Add Task" and "Remove from Plan" actions, pinned at bottom

## Drag Behavior

- Header bar is the drag handle
- Position tracked via `transform: translate(dx, dy)` for 60fps movement
- Constrained to viewport — minimum 50px visible on any edge
- Position resets to default on close or when switching districts
- Z-index: same layer as main floating panel

## Tether Line

- Full-viewport SVG overlay with `pointer-events: none`
- **Source**: district lat/lng → screen coords via `map.project()`
- **Target**: nearest edge midpoint of the floating panel
- **Style**: 1.5px dashed line in plan color (fallback: coral `#F37167`), small circle at district end
- **Updates**: re-renders on map `move` event and panel drag, via `requestAnimationFrame`
- **Off-screen**: line fades/hides when district point is outside the viewport

## Interaction Flow

**Opening:**
1. Click district row in plan overview → opens floating detail
2. Panel fades + scales in (opacity 0→1, scale 0.95→1, 200ms ease-out)
3. Tether line animates in via dash-offset (~300ms)
4. Main plan panel stays unchanged

**Switching districts:**
- Content crossfades to new district
- Tether repoints to new location
- Panel position resets to default

**Closing:**
- X button or Escape key
- Reverse animation (fade + scale out)
- Clicking the same district again toggles it closed

**Map interaction:**
- Map remains fully interactive behind the panel
- Pan/zoom updates tether line in real time

## Store Changes

- Remove `district_card` from `RightPanelContent` type — district detail no longer uses the right panel
- Add `detailPopout: { leaid: string } | null` to store
- Add `openDetailPopout(leaid)` / `closeDetailPopout()` actions
- `PlanOverviewSection` calls `openDetailPopout(leaid)` instead of `openRightPanel`

## Files to Create/Modify

- **Create**: `src/components/map-v2/FloatingDistrictDetail.tsx` — main draggable panel
- **Create**: `src/components/map-v2/TetherLine.tsx` — SVG connector overlay
- **Modify**: `src/lib/map-v2-store.ts` — add detailPopout state/actions
- **Modify**: `src/components/map-v2/panels/PlanOverviewSection.tsx` — use openDetailPopout
- **Modify**: `src/components/map-v2/FloatingPanel.tsx` — remove right panel width expansion for district_card
- **Modify**: `src/app/map-v2/page.tsx` (or layout) — render FloatingDistrictDetail + TetherLine as siblings
