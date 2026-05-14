# Plan Detail Mobile Layout

**Date:** 2026-05-12  
**Branch:** feat/home-sidebar-collapse  
**Status:** Approved for implementation

## Problem

The plan detail modal uses a fixed two-column layout (`w-[70vw]`, left sidebar `w-[260px]`, right tab panel). When the window is narrow — either on a real phone or a resized desktop — the 260px sidebar eats most of the width before the districts table gets any room. The result is the table columns visibly crunched and partially clipped.

## Goal

Make the plan detail fully usable at any window width. The trigger is purely CSS-breakpoint-based (`< 640px` / Tailwind `sm:`), so it applies equally to mobile devices and narrow desktop windows.

## Non-Goals

- No changes to the desktop layout (≥ 640px) — the current modal + floating side arrows stays exactly as-is.
- No swipe-to-navigate gesture (noted as a future site-wide feature; out of scope here).
- No changes to any tab content components (PlanDistrictsTab, PlanContactsTab, etc.).

## Design

### Breakpoint

`< 640px` (Tailwind `sm:` prefix). Applies to both mobile devices and any browser window narrower than 640px.

### Mobile Layout Structure

```
┌──────────────────────────────────────┐
│  ← Return to Map  ‹ 2 of 7 ›   ✕   │  ← purple bar (#403770)
├──────────────────────────────────────┤
│  ● Westchester County    Stats ▾     │  ← summary strip (gradient bg)
│  FY26  Working                       │
├──────────────────────────────────────┤
│  [Stats panel — hidden by default,   │  ← collapsible, expands below strip
│   expands when "Stats ▾" tapped]     │
├──────────────────────────────────────┤
│  Districts  Opps  Contacts  Tasks …  │  ← horizontally scrollable tab bar
├──────────────────────────────────────┤
│                                      │
│  [Tab content — fills remaining      │  ← flex-1, internally scrollable
│   height, full width]                │
│                                      │
└──────────────────────────────────────┘
```

### Purple Header Bar

- Background: `#403770`
- Left: "← Return to Map" button (same `onClose` handler)
- Center: `‹ N of M ›` — prev/next buttons + counter, only rendered when `onPrev`/`onNext` are provided
- Right: `✕` close button
- All elements use `whitespace-nowrap`; the center group uses `flex-1 justify-center`

### Summary Strip

- Background: `linear-gradient(180deg, #F7F5FA 0%, #EFEDF5 100%)` (matches current sidebar header)
- Left side: colored dot + plan name (truncated) + FY badge + status badge
- Right side: "Stats ▾" / "Stats ▴" toggle button
- Border-bottom: `#E2DEEC`

### Stats Panel (collapsible)

Controlled by a `showStats` boolean (`useState(false)`). When expanded, renders below the summary strip as an inline section within the same gradient background area.

Stats displayed (same data as the desktop sidebar):
- Row 1 (3-col grid): Districts count · Total Target · Revenue (actuals)
- Row 2 (3-col grid): Renewal · Expansion · New Business

Format: each stat is a small centered block — value (bold, `#403770`) over label (`#8A80A8`, 7–8px). No horizontal rules or section headers needed at this density.

The stats panel does **not** include the Edit mode fields (owner, dates, description). The edit pencil button is desktop-only for now.

### Tab Bar

- Same `PlanDetailTabs` component, unchanged
- Tab strip already uses `overflow-x: auto` and `whitespace-nowrap` — this will work naturally at full width
- Tab content panel gets `flex-1` and fills remaining screen height

### Overlay Shape

On mobile, the modal container changes from the centered `w-[70vw] h-[70vh]` box to `fixed inset-0` (full screen). The backdrop remains unchanged (clicks outside close).

The floating prev/next arrow buttons (currently outside the modal frame on desktop) are hidden on mobile — navigation moves into the header bar instead.

## Architecture

### New Component: `PlanDetailMobileShell.tsx`

```
src/features/map/components/SearchResults/PlanDetailMobileShell.tsx
```

Props:
```ts
interface PlanDetailMobileShellProps {
  plan: TerritoryPlanDetail;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}
```

Responsibilities:
- Renders the full-screen layout: header bar + summary strip + collapsible stats + `PlanDetailTabs`
- Owns `showStats` state
- Computes the same rollup values as `PlanDetailSidebar` (totalTarget, totalActual, totalPipeline) — these are derived from `plan` props with no additional API calls

### Changes to `PlanDetailModal.tsx`

Add a `useIsMobile` hook (or inline media query check) to detect `window.innerWidth < 640`. When true:
- Render `PlanDetailMobileShell` instead of the current `PlanDetailSidebar` + `PlanDetailTabs` layout
- Change the outer modal container from `w-[70vw] max-w-[1076px] h-[70vh] max-h-[745px]` to `fixed inset-0`
- Hide the floating prev/next arrow buttons

Use a `useIsMobile` hook backed by `window.matchMedia('(max-width: 639px)')` with a resize listener. This is needed because the content swap (mobile shell vs. desktop two-column layout) is a React conditional — Tailwind classes alone can't swap component trees. The container sizing and button visibility are handled with Tailwind responsive classes (`sm:hidden`, `hidden sm:flex`, etc.) on top of the React branch.

### No Changes to

- `PlanDetailSidebar.tsx` — desktop only, rendered as-is
- `PlanDetailTabs.tsx` — rendered in both layouts, no modifications
- All tab content components (`PlanDistrictsTab`, etc.)
- `DistrictExploreModal.tsx` — separate component, not in scope

## Implementation Notes

- Stats rollup math is simple enough to duplicate in `PlanDetailMobileShell` — no need to extract a shared utility just for this
- `overflow: hidden` must not be set on `html`/`body` (per CLAUDE.md mobile rules) — the existing `document.body.style.overflow = "hidden"` in `PlanDetailModal` is fine since it targets `body` not `html`
- Verify on Safari Responsive Design Mode before marking complete (per CLAUDE.md mobile testing requirement)
- The `touch-action: pan-y` rule must not be applied to a wrapper that contains the map — this modal is a portal above the map, so it's safe
