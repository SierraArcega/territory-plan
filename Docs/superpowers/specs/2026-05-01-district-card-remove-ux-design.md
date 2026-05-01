# District Card Remove UX Fix

**Date:** 2026-05-01  
**Status:** Approved

## Problem

In `DistrictSearchCard`, the card wrapper fires `onToggleSelect()` on every click. The only escape hatch is the "Explore" button, which uses `stopPropagation`. This means any misclick on the card body silently removes the district from the selection — a destructive, unintuitive action with no visible affordance.

## Solution

Move deselection to an explicit ✕ button. Make the entire card clickable to open the explore view.

## Behavior Changes

| Element | Before | After |
|---------|--------|-------|
| Card wrapper click | Deselects district | Opens explore view |
| Explore button | Opens explore view | No change |
| ✕ button | Does not exist | Deselects district |

## Component

**File:** `src/features/map/components/SearchResults/DistrictSearchCard.tsx`

### Card wrapper

Change `onClick` from `onToggleSelect()` to `onExplore(district.leaid)`:

```tsx
onClick={() => onExplore(district.leaid)}
```

### ✕ button

Absolutely positioned top-right corner. Added inside the card wrapper, before the content `<div>`:

```tsx
import { X } from "lucide-react";

<button
  onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
  className="absolute top-2 right-2 w-[18px] h-[18px] rounded-full flex items-center justify-center
             text-plum/50 bg-plum/10 hover:bg-red-100 hover:text-red-500 transition-colors"
  title="Remove"
>
  <X size={10} strokeWidth={2.5} />
</button>
```

The content `<div>` gets `pr-6` (24px padding-right) so the district name never overlaps the button (button is 18px wide at 8px from the right edge = 26px clearance needed).

### Explore button

No change. Keeps `e.stopPropagation()` to prevent the card's new `onExplore` from double-firing.

## Scope

Single file change. No API, store, or parent component changes required. Props `onToggleSelect` and `onExplore` already exist and wire correctly.
