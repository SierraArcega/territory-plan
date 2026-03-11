# Focus Mode District Target Popover — Design

**Date:** 2026-03-09
**Status:** Approved

## Summary

When in Focus Mode on the map, clicking a district opens a popover anchored at the click point that lets the user set renewal, winback, expansion, and new business targets for that district within the focused plan. Each target category shows contextual reference spending data (Fullmind prior-year revenue or competitor PO spend) to inform target-setting.

## Interaction Flow

### In-plan district (leaid in `focusLeaids`)

1. User clicks district on map while in Focus Mode
2. Click ripple animates at click point (existing behavior)
3. Target-setting popover appears anchored near the click `(x, y)` pixel coordinates
4. District is NOT selected in the side panel; no zoom occurs
5. One accordion auto-expands based on the district's `fullmind_category` tile property:
   - `renewal_pipeline` / `multi_year` → Renewal
   - `winback_pipeline` / `lapsed` → Winback
   - `expansion_pipeline` → Expansion
   - `target` / `new_business_pipeline` / no category → New Biz

### Out-of-plan district (leaid NOT in `focusLeaids`)

1. Click ripple animates
2. A smaller "Add to Plan?" confirmation popover appears at the click point, showing district name and an "Add to Plan" button
3. On confirm → district is added to the plan via existing `addDistrictToPlan` store action, then the target-setting popover opens in its place
4. On dismiss (X) → popover closes, nothing happens

## Popover Components

### Target-Setting Popover (`FocusModeTargetPopover`)

- Absolutely positioned inside the map container at click `(x, y)`
- Edge detection: flips left/right and up/down if too close to viewport edges
- Width: ~320px, compact card style
- **Header:** district name + X close button (top-right)
- **Body:** 4 accordion sections (Renewal, Winback, Expansion, New Biz), each containing:
  - Reference data line — contextual spending info
  - Currency input — `$` prefixed text input
- **Footer:** "Save" button (full-width, brand purple `#403770`)
- Saving state: button shows "Saving..." and disables during API call
- Success: popover closes automatically after successful save
- Error: inline error message above Save button

### Add-to-Plan Popover (`FocusModeAddPopover`)

- Same positioning logic, smaller (~240px wide)
- Shows: district name, enrollment count, and a single "Add to Plan" button
- On confirm → calls `addDistrictToPlan`, then swaps to the target-setting popover

## Reference Data Per Accordion

| Section | Data Source | Display |
|---------|-----------|---------|
| Renewal | `District.fy25SessionsRevenue` or `VendorFinancials` for Fullmind prior FY | "FY25 Fullmind Revenue: $X" |
| Winback | Same as renewal, but for the last year they were active | "Last Fullmind Revenue: $X (FY24)" |
| Expansion | `District.fy26SessionsRevenue` (current year) | "Current FY26 Revenue: $X" |
| New Biz | `CompetitorSpend` via existing `/api/districts/[leaid]/competitor-spend` | "Proximity: $X · Educere: $Y" |

## API & Data

**No new API endpoints needed.** Reuses:

- `PUT /api/territory-plans/[id]/districts/[leaid]` — existing target save (via `useUpdateDistrictTargets` hook)
- `GET /api/districts/[leaid]/competitor-spend` — existing competitor spend
- Store action `addDistrictToPlan` — existing add-to-plan

Reference spending data (Fullmind revenue fields like `fy25SessionsRevenue`, `fy26SessionsRevenue`) can be read from tile properties already available client-side via `map.queryRenderedFeatures`. Competitor spend fetched from the existing API endpoint.

## Store Changes

Minimal additions to the Zustand store (`src/features/map/lib/store.ts`):

- `focusPopover: { type: 'targets' | 'add-to-plan'; leaid: string; x: number; y: number } | null` — tracks the open popover state
- `openFocusPopover(type, leaid, x, y)` — action to open
- `closeFocusPopover()` — action to close

## Click Handler Changes

In `MapV2Container.tsx` `handleClick`, add a Focus Mode branch before the existing district-click logic:

```typescript
if (store.focusPlanId) {
  const isInPlan = store.focusLeaids.includes(leaid);
  store.openFocusPopover(
    isInPlan ? 'targets' : 'add-to-plan',
    leaid,
    e.point.x,
    e.point.y
  );
  return; // skip normal select/zoom behavior
}
```

## Dismissal

- X button in top-right corner closes the popover (discards unsaved changes)
- Escape key closes the popover
- Clicking outside closes the popover (matches existing codebase pattern)
- Successful save closes the popover automatically

## Key Files

| File | Role |
|------|------|
| `src/features/map/components/MapV2Container.tsx` | Click handler changes |
| `src/features/map/lib/store.ts` | `focusPopover` state + actions |
| `src/features/map/components/FocusModeTargetPopover.tsx` | New — target-setting popover |
| `src/features/map/components/FocusModeAddPopover.tsx` | New — add-to-plan confirmation popover |
| `src/features/plans/components/DistrictTargetEditor.tsx` | Existing — reuse `parseCurrency`/`formatCurrency` helpers |
| `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts` | Existing PUT endpoint for saving targets |
| `src/app/api/districts/[leaid]/competitor-spend/route.ts` | Existing GET endpoint for competitor spend |
| `src/lib/api.ts` | Existing `useUpdateDistrictTargets` hook |

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Popover vs side panel | Map-anchored popover | Direct, contextual interaction without losing map context |
| Pre-filled vs blank | Blank inputs each time | Acts as a "set targets" action |
| Save strategy | Immediate DB save | Simple, no risk of lost work; target-setting is deliberate (not rapid-fire) |
| All fields vs stepped | All 4 in accordion | User sees everything at once, auto-expand guides attention |
| Out-of-plan clicks | Confirm → add → set targets | Two-step prevents accidental additions |
| Implementation approach | Absolute-positioned div overlay | Matches existing codebase patterns (DonutMetricPopover, ViewActionsBar) |
