# LHF "Add to Plan" — TARGET Required State

**Date:** 2026-05-06  
**Status:** Approved

## Problem

The "Add to Plan" popover on the Low Hanging Fruit page has a TARGET input that defaults to empty (rendered as `$0` due to `placeholder="0"`). The "Add to Plan" button is already disabled until `parsedTarget > 0`, but nothing in the UI explains why. Users see a button that looks clickable next to a field that looks filled — the mismatch causes confusion.

## Solution

Surface an amber visual state on the TARGET field whenever it is empty/zero, immediately communicating that it must be filled before the button will activate. No change to the disable logic — only the affordance changes.

## Scope

Two components are affected:

- `src/features/leaderboard/components/LhfPlanPicker.tsx` — single-district picker
- `src/features/leaderboard/components/LhfBulkPlanPicker.tsx` — multi-district bulk picker

## Changes

### 1. Placeholder text

**Before:** `placeholder="0"` — looks like a pre-filled zero value.  
**After:** `placeholder="e.g. 50,000"` — clearly indicates the field is empty and expects a value. The `$` prefix is already rendered as a separate element.

### 2. Amber border + background (when empty)

When `parsedTarget <= 0` (LhfPlanPicker) or the equivalent parsed value ≤ 0 (LhfBulkPlanPicker), apply amber classes to the input:

```
border-amber-400 bg-amber-50
```

When `parsedTarget > 0`, restore to the normal idle state:

```
border-[#C2BBD4] bg-white
```

The transition is immediate — no blur required. The amber clears the moment the user types a positive value.

### 3. Helper text (when empty)

Directly below the input wrapper, conditionally render a one-line hint when `parsedTarget <= 0`:

```tsx
{parsedTarget <= 0 && (
  <p className="text-[11px] text-amber-700 mt-1">
    Set a target amount to add to plan
  </p>
)}
```

This sits in the same visual area as the existing red `errorMessage` slot. The two do not conflict — the error message covers the "create new plan" edge case and the amber hint covers the normal open state.

## Behavior Details

| Scenario | Field state | Helper text | Button |
|---|---|---|---|
| Open, no suggested target | Amber border, `bg-amber-50` | Shown | Disabled |
| Open, has suggested target | Normal (field pre-filled) | Hidden | Enabled |
| User types a valid amount | Normal | Hidden | Enabled (if plan selected) |
| User clears back to empty | Amber | Shown | Disabled |

**Districts with a `suggestedTarget`** have the field pre-filled on open, so `parsedTarget > 0` from the start — no amber shown, button is already enabled.

## Out of Scope

- No change to the `canSubmit` logic or button disabled condition.
- No tooltip on the button (chosen over Option C for immediacy — the field draws attention before the user reaches the button).
- No change to the PLAN or TYPE fields — only TARGET has a required constraint.
