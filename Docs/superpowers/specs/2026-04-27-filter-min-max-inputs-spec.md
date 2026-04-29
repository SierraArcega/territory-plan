# Feature Spec: RangeFilter inline min/max number inputs

**Date:** 2026-04-27
**Slug:** filter-min-max-inputs
**Branch:** worktree-filter-min-max-inputs

## Requirements

Reps using the District Filters dropdown today have to drag dual-thumb sliders
to set min/max for histogram-style filters (Enrollment, ELL %, SWD %, Poverty %,
Median Income, Enrollment Trend, all Finance rows, all Academics rows, and the
Fullmind FY-aware Pipeline / Bookings / Invoicing rows). The sliders use a
coarse `step` (e.g., Enrollment step = 500), which prevents reps from selecting
a precise sub-range like 100–200 inside the 0–500 bucket.

Replace the static `formatValue(lo)` / `formatValue(hi)` text labels under
each slider with editable number inputs so reps can type any integer (or
decimal where the row's step < 1) inside the row's `[min, max]` range.

## Visual Design

- Approved approach: **edit-in-place — replace the two static value labels
  beneath each slider with `<input>` elements occupying the same screen
  positions and visual weight**
- The dropdown chrome, section headers, slider track, slider thumbs, and
  active-state plum tint stay exactly as today
- Currency rows (`$`) and percent rows (`%`) render a small adornment outside
  the input rather than embedding it; raw integers live inside the input

### Per-row layout

```
Enrollment                                  [Remove]
●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●
[      0]                          [ 200000]
```

- Left input left-aligned; right input right-aligned (mirrors today)
- Each input ~64px wide, `text-[10px] tabular-nums`
- Active filter: plum text matching today's active label color
- Focus ring: `focus:ring-1 focus:ring-plum/30`
- Placeholder shows the bound (`placeholder="0"` / `placeholder="200000"`)
- Click selects all text for fast overwrite

### Key architectural decisions

- **Single component change.** The shared `RangeFilter` is consumed by
  `DistrictsDropdown`, `DemographicsDropdown`, and `FinancialRangeFilter`
  (an FY-aware wrapper). Modifying it once propagates to every row.
- **Inputs do not affect slider step.** Slider step controls drag granularity
  only; typed values bypass step entirely.
- **Apply on blur / Enter, not while typing.** Slider drag stays debounced as
  today (300ms); typed entries commit on blur or Enter. This avoids partial
  values like `1` flashing as a filter while the user types `150`.

## Component Plan

- **Existing components to reuse:**
  - `RangeFilter` (`src/features/map/components/SearchBar/controls/RangeFilter.tsx`) — modified in place
  - `formatCompact` — exported as today, still used by callers passing it to the slider value labels (now used only for adornments / pill display, not inside inputs)
- **New components:** none
- **Components to extend:** none — `FinancialRangeFilter`,
  `DemographicsDropdown`, `DistrictsDropdown` consume `RangeFilter` via props
  and inherit the change for free

## Backend Design

**No backend changes.** The store's `searchFilters` already supports `between`
ops with arbitrary `[number, number]` values; the existing
`addSearchFilter` / `updateSearchFilter` / `removeSearchFilter` actions remain
untouched. SQL filtering downstream of `searchFilters` already accepts
non-step values.

## States

- **Inactive (no filter set):** inputs render min and max in muted plum text;
  no plum background ring on the row
- **Active (filter set):** inputs render `lo` / `hi` in plum; row gets the
  existing `bg-plum/5 ring-1 ring-plum/15` treatment
- **Focused:** plum focus ring on the input; no other visual change
- **Drag in progress:** inputs reflect the slider's live value
- **Mid-typing:** inputs hold the typed string locally; no validation flash;
  no filter mutation
- **Invalid on blur:** revert to last valid applied value silently
- **lo > hi after typing:** swap so the smaller value is min and larger is max

## Validation rules

Run on blur or Enter:

1. Parse via `Number(...)`. If `NaN` or empty string → revert to last valid.
2. Clamp to `[min, max]` of the row.
3. If `step < 1`, accept decimals; else round/parseInt to integers.
4. If `lo > hi`, swap.
5. If both equal `min` and `max` (i.e., the user reset to bounds) →
   call `removeSearchFilter` (matches today's slider behavior).
6. Otherwise → call `onApply(column, lo, hi)`.

## Accessibility

- `aria-label="${label} minimum"` / `"${label} maximum"` per input
- `inputMode="numeric"` (or `"decimal"` for step < 1)
- `type="text"` (not `type="number"`) to avoid native spinners and to keep
  parsing under our control
- Escape key restores last applied value and blurs

## Out of Scope

- Any change to slider step granularity (e.g., making Enrollment step = 1
  for the slider itself). Step keeps its current behavior; typed input
  bypasses it.
- Replacing the dual-thumb slider with anything else.
- Format-aware input parsing (e.g., typing `"200K"` and parsing back to
  200000). Inputs accept raw integers/decimals only.
- New filter ops, new store fields, new API routes.
- Visual changes to filter pills, the section header chevron, or the
  collapsible section behavior.
