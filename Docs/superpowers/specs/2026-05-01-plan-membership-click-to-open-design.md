# Plan Membership Click-to-Open Design

**Date:** 2026-05-01  
**Status:** Approved

## Summary

Clicking a plan row in the Plan Membership section of the district card's Fullmind tab closes the district card and opens the PlanWorkspace for that plan.

## Behavior

- Entire plan row is clickable (not just the name)
- On click: `onClose()` then `viewPlan(plan.id)`
- District modal closes first, then PlanWorkspace opens — same sequence used in `PlanDistrictsTab`

## Visual Treatment

Row `div` becomes a `button` element:
- `w-full text-left flex items-center gap-2.5 py-1.5 overflow-hidden cursor-pointer rounded hover:bg-[#F7F5FA] transition-colors`
- No other visual changes — color dot, plan name, status, and owner display unchanged

## Component Changes

**`FullmindTab` (in `DistrictExploreModal.tsx`):**
- Add `onClose: () => void` prop
- Pull `viewPlan` from Zustand store: `const viewPlan = useMapStore((s) => s.viewPlan)`
- Change plan membership row `div` → `button` with `onClick={() => { onClose(); viewPlan(plan.id); }}`

**`DistrictExploreModal` (same file):**
- Thread `onClose` into the `<FullmindTab ... onClose={onClose} />` call
- `onClose` is already available in scope at the call site (line 340)

## Scope

Two small changes in one file (`DistrictExploreModal.tsx`), no API or schema changes.
