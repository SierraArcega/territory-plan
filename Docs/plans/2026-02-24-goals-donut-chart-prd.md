# Goals Donut Chart — HomePanel

**Date:** 2026-02-24
**Status:** Draft

## Problem Statement

The Goals section of the map-view HomePanel (`src/features/map/components/panels/HomePanel.tsx`) displays 4 fiscal-year goal metrics as horizontal progress bars stacked vertically. Progress bars are hard to scan at a glance in a compact side panel — the fill is thin (1.5px) and the percentage label is small. Donut charts communicate progress more intuitively: the ring fill is immediately legible, and the percentage sits prominently in the center.

The full-page HomeView (`src/features/shared/components/views/HomeView.tsx`) already uses donut charts for the same 4 metrics and receives positive feedback. This change brings the map panel into visual parity with the full-page view while respecting the panel's tighter width constraints.

**Who benefits:** Sales reps using the map view, who glance at goal progress while working territory plans.

## Proposed Solution

Extract the existing `DonutChart` SVG component from `HomeView.tsx` into a shared file, then replace the linear progress bars in `HomePanel.tsx` with a 2x2 grid of smaller donuts (48px diameter, 5px stroke). Each cell shows the donut with the percentage inside and the metric label beneath it — no current/target text to keep it compact.

Tapping a donut opens a lightweight popover showing the full breakdown (current value / target value), giving users detail-on-demand without cluttering the default view.

No data model, API, or backend changes are required. The same `useGoalDashboard` hook and `goalMetrics` array power both the old bars and the new donuts.

## Technical Design

### Affected Files

| File | Action | Description |
|------|--------|-------------|
| `src/features/goals/components/DonutChart.tsx` | **Create** | Shared DonutChart component extracted from HomeView. Accepts `percent`, `color`, `size`, `strokeWidth`, `fontSize`, and optional `onClick`. The label is rendered by the parent grid cell, not by DonutChart itself. |
| `src/features/goals/components/DonutMetricPopover.tsx` | **Create** | Small popover component that displays current/target breakdown when a donut is tapped. Dismisses on click-outside or Escape. |
| `src/features/map/components/panels/HomePanel.tsx` | **Modify** | Replace the `space-y-2.5` progress-bar list (lines 430-475) with a 2x2 `grid grid-cols-2 gap-3` of DonutChart cells. Wire up tap-to-popover. |
| `src/features/shared/components/views/HomeView.tsx` | **Modify** | Replace the inline `DonutChart` function (lines 87-130) with an import from `src/features/goals/components/DonutChart.tsx`. No visual change. |
| `src/features/goals/components/__tests__/DonutChart.test.tsx` | **Create** | Unit tests for the shared DonutChart component. |

### Data Model Changes

None. No Prisma schema changes, no migrations.

### API Changes

None. The existing `GET /api/profile/goals/:fiscalYear/dashboard` endpoint returns all needed data via the `useGoalDashboard` hook. The `GoalDashboard` type already provides `goals` (targets) and `actuals` (current values).

### UI Changes

#### DonutChart Component (`src/features/goals/components/DonutChart.tsx`)

Extracted from the existing inline component in HomeView with the following interface:

```tsx
interface DonutChartProps {
  percent: number;       // 0-100, capped at 100 for display
  color: string;         // ring fill color (hex)
  size?: number;         // diameter in px (default 100)
  strokeWidth?: number;  // ring thickness in px (default 8)
  fontSize?: string;     // Tailwind text size class for center label (default "text-base")
  onClick?: () => void;  // optional tap handler
}
```

Behavior matches the existing HomeView donut exactly:
- SVG with two `<circle>` elements (background track `#f0f0f0`, colored fill arc)
- Rotated -90deg so arc starts at 12 o'clock
- `strokeLinecap="round"` for rounded arc ends
- Animated fill via `useEffect` + `setTimeout(200ms)` + CSS `transition: stroke-dashoffset 1s ease-out`
- Center label shows `Math.round(percent)%` in Plum (`#403770`)
- When `onClick` is provided, cursor changes to pointer and ring gets a subtle hover effect

#### DonutMetricPopover (`src/features/goals/components/DonutMetricPopover.tsx`)

A small absolute-positioned popover anchored to the tapped donut cell:

```tsx
interface DonutMetricPopoverProps {
  label: string;          // "Earnings", "Take", etc.
  current: number;
  target: number | null;
  format: "currency" | "number";
  color: string;
  onClose: () => void;
}
```

Visual spec:
- White background, `rounded-lg`, `shadow-lg`, `border border-gray-100`
- Positioned above the donut (or below if near top of panel), centered horizontally
- Content: metric label (bold, `text-[11px]`), current value in Plum (`text-sm font-semibold`), "of {target}" in gray (`text-[10px] text-gray-400`)
- Dismisses on click-outside (via `useEffect` + `mousedown` listener) or Escape key
- Entrance: `animate-in fade-in slide-in-from-bottom-2 duration-150`

#### HomePanel Goals Section Layout Change

**Before (vertical stack of bars):**
```
[label ................... current / target]
[====----------- 45%]

[label ................... current / target]
[======----------- 60%]
...
```

**After (2x2 donut grid):**
```
 [ (donut) ]    [ (donut) ]
  Earnings         Take

 [ (donut) ]    [ (donut) ]
 Total Target   New Districts
```

Grid implementation:
- Container: `grid grid-cols-2 gap-3`
- Each cell: `flex flex-col items-center text-center` with a click handler
- DonutChart: `size={48}`, `strokeWidth={5}`, `fontSize="text-[10px]"`
- Label: `text-[10px] font-medium text-gray-500 mt-1`

Colors remain unchanged from current implementation:
- Earnings: Coral `#F37167`
- Take: Steel Blue `#6EA3BE`
- Total Target: Plum `#403770`
- New Districts: Plum `#403770`

#### Empty State

No change to the empty state. When `goalMetrics` is null (no goals set), the existing centered "No goals set for FY{XX}" message remains as-is.

#### Brand Color Reference

| Token | Hex | Usage in this feature |
|-------|-----|----------------------|
| Coral | `#F37167` | Earnings donut ring |
| Steel Blue | `#6EA3BE` | Take donut ring |
| Plum | `#403770` | Total Target + New Districts donut rings, center percentage text |
| Off-white | `#FFFCFA` | Not directly used (panel bg is white/95 backdrop-blur) |
| Track gray | `#f0f0f0` | Donut background ring |

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| **Target is null or 0** | Donut shows 0% (empty ring with `#f0f0f0` track only). Popover shows current value and "of -" for target. |
| **Current exceeds target (>100%)** | Percentage is capped at 100% for the ring fill. Center label still shows capped 100%. Popover shows the actual current/target values uncapped so the user sees the real numbers. |
| **All targets null** | `goalMetrics` evaluates to a 4-item array with all 0% donuts. The grid still renders — the user sees 4 empty rings, which signals "you have goals but no progress yet" differently from the empty state "No goals set." |
| **Dashboard loading** | No change. The `goalMetrics` memo returns null while `dashboard` is undefined, so the empty-state placeholder shows until data arrives. |
| **Panel at minimum width (340px minus IconBar ~44px = ~296px content)** | 2x2 grid with 48px donuts + gap-3 (12px) fits in ~120px total width. Plenty of room. Labels truncate with `truncate` class if needed, but metric labels are all short ("Earnings", "Take", etc.). |
| **Popover near panel edge** | Popover measures available space and flips from above-donut to below-donut if it would overflow the top. Horizontal centering is clamped to panel bounds. |
| **Popover open, then FY tab changes** | Close any open popover when `selectedFY` changes (via `useEffect` dependency). |
| **Click outside popover** | Popover dismisses. Standard `mousedown` listener on `document`, checking if click target is outside popover ref. |
| **Escape key while popover open** | Popover dismisses. `keydown` listener for Escape. |

## Testing Strategy

### Unit Tests — Priority 1 (`src/features/goals/components/__tests__/DonutChart.test.tsx`)

These 10 tests are the primary deliverable. They cover the shared DonutChart component in isolation with no external hook mocking required.

| # | Test Case | What It Verifies | Notes |
|---|-----------|-----------------|-------|
| 1 | Renders SVG with correct dimensions | `size` prop maps to SVG width/height | |
| 2 | Background circle uses track color | First circle has `stroke="#f0f0f0"` | |
| 3 | Fill circle uses provided color | Second circle has `stroke={color}` | |
| 4 | 0% shows full offset (empty ring) | `strokeDashoffset` equals circumference | **Requires `vi.useFakeTimers()` and `act()`** to advance past the 200ms `setTimeout` that triggers the animation. The center label shows `Math.round(percent)` immediately (raw `percent`), but the ring's `strokeDashoffset` only updates after the timer fires. Call `vi.advanceTimersByTime(200)` inside `act()`, then assert. |
| 5 | 100% shows zero offset (full ring) | `strokeDashoffset` equals 0 after animation | **Requires `vi.useFakeTimers()` and `act()`** — same pattern as test #4. After advancing timers, the animated `strokeDashoffset` transitions to 0. Assert on the `style` attribute after the timer fires. |
| 6 | Percentage > 100 is capped at 100 | Passing 150 still renders "100%" in center | |
| 7 | Center label shows rounded percentage | 33.7% renders as "34%" | |
| 8 | onClick fires when clicked | Mock callback is invoked | |
| 9 | Cursor is pointer when onClick provided | Element has `cursor-pointer` style | |
| 10 | Custom fontSize applies to center label | Class is present on the span | |

### HomePanel Integration Tests — Priority 2 (`src/features/map/components/panels/__tests__/HomePanel.test.tsx`)

No tests currently exist for any panel component, and mocking all the hooks (`useGoalDashboard`, `useMapStore`, etc.) is significant setup work. Scope is intentionally limited to 4 critical cases. Additional integration coverage (formatted values, FY tab changes, popover edge positioning) is deferred as follow-up work.

| # | Test Case | What It Verifies | Notes |
|---|-----------|-----------------|-------|
| 11 | 4 donuts render when goalMetrics is present | 4 DonutChart instances in the DOM | Requires mocking `useGoalDashboard` to return fixture data |
| 12 | Tapping a donut opens popover | Click donut, popover with current/target values appears | |
| 13 | Click outside closes popover | Click outside popover ref, popover unmounts | |
| 14 | Empty state renders when no goals | "No goals set" message shows when dashboard.goals is null | |

**Follow-up (not in initial scope):** Popover formatted values, Escape key dismissal, FY tab change closes popover, label text matching. These can be added once the panel test infrastructure is established.

### HomeView Regression — Priority 2

| # | Test Case | What It Verifies |
|---|-----------|-----------------|
| 15 | HomeView still renders 4 donuts after extraction | Import from shared file works, no visual regression |

**Approximate total: 15 test cases across 2-3 test files (10 high-priority unit tests + 4 scoped integration tests + 1 regression test).**

No API or integration tests needed — this is a purely client-side UI change with no new data fetching.
