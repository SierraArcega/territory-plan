# Plan Membership Owner Display

**Date:** 2026-05-01  
**Status:** Approved

## Summary

Add plan owner visibility to the Plan Membership section in the district card's Fullmind tab. Currently each row shows a color dot, plan name, and status. This change appends the owner's full name after a `·` separator.

## Current Behavior

```
● Kleist Renewal   Working
```

## Target Behavior

```
● Kleist Renewal   Working · Sierra Arcega
```

Owner is omitted (not shown as blank) when `plan.owner` is null.

## Data

Owner data is already fetched. `useTerritoryPlans()` returns `TerritoryPlan[]` where each plan includes `owner: { id, fullName, avatarUrl } | null`. No API or schema changes needed.

## Component Change

**File:** `src/features/map/components/SearchResults/DistrictExploreModal.tsx` (lines 513–519)

Update the plan membership row to:

- `plan.name` — `text-sm font-medium text-[#544A78] whitespace-nowrap`
- `plan.status` — `text-[11px] text-[#A69DC0] capitalize whitespace-nowrap`
- `· {plan.owner.fullName}` — `text-[11px] text-[#A69DC0] truncate` (rendered only when owner exists)
- Row container gains `overflow-hidden` so the owner name absorbs any width squeeze

## Narrow-Width Resilience

Name and status are `whitespace-nowrap` — they never break. The owner segment is `truncate` with `min-w-0` ancestry, so it clips cleanly when the card is narrow.

## Scope

Single component, display-only. No API changes, no schema changes, no new queries.
