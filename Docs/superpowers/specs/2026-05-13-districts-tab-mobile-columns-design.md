# Districts Tab — Mobile Column Layout

**Date:** 2026-05-13  
**Branch:** feat/home-sidebar-collapse  
**Status:** Approved for implementation

## Problem

`PlanDistrictsTab` uses a fixed five-column grid (`grid-cols-[1fr_110px_110px_55px_28px]`). On a ~390px mobile screen (40px horizontal padding on the parent), the four fixed columns consume ~303px, leaving only ~47px for the `1fr` name column. District names truncate to one or two characters ("A…", "B…").

## Goal

Make the Districts tab table readable at any width below 640px. Desktop layout is unchanged.

## Non-Goals

- No changes to the expanded row panel (service-type breakdown, revenue inputs, notes, remove button).
- No changes to the footer, sort behavior, or any other tab.
- No changes to the desktop layout (≥ 640px).

## Design

### Breakpoint

`< 640px` (Tailwind `sm:` prefix) — same breakpoint used by `PlanDetailMobileShell`.

### Mobile Column Layout

```
┌─────────────────────────────────────────────┐
│ District          │ Target │ Actual │ Attain.│
│                   │  52px  │  52px  │  44px  │
├─────────────────────────────────────────────┤
│ › Yonkers City   │  $42K  │  $38K  │   90%  │
│   NY · 25K        │        │        │        │
├─────────────────────────────────────────────┤
│ › White Plains    │  $31K  │  $28K  │   90%  │
│   NY · 8K         │        │        │        │
├─────────────────────────────────────────────┤
│ › New Rochelle    │  $18K  │  $31K  │  172%  │
│   NY · 12K        │        │        │        │
└─────────────────────────────────────────────┘
```

- **Name column** (`flex-1`): expand chevron + district name (truncated with ellipsis, ~12 visible chars at 390px) + state/enrollment sub-label below (`sm:hidden`)
- **Target column** (`w-[52px]`, right-aligned): compact currency value
- **Actual column** (`w-[52px]`, right-aligned): compact currency value  
- **Attainment column** (`w-[44px]`, right-aligned): percentage, color-coded
- **Remove button slot** (`w-[28px]`): unchanged — only visible when row is expanded

### Grid Template Change

```
Mobile:  grid-cols-[1fr_52px_52px_44px_28px]
Desktop: grid-cols-[1fr_110px_110px_55px_28px]   ← unchanged
```

Applied via Tailwind: `grid-cols-[1fr_52px_52px_44px_28px] sm:grid-cols-[1fr_110px_110px_55px_28px]`

This single class change applies to both the header row and every `DistrictRow` collapsed-row div.

### Header Labels

The `SortBtn` component currently takes `label: string`. This needs to change to `label: React.ReactNode` to support responsive labels.

The two columns that need shorter mobile text:

| Column | Desktop label | Mobile label |
|--------|--------------|--------------|
| target | Rev. Target  | Target       |
| actual | Rev. Actual  | Actual       |
| attainment | Attain.  | Attain.      |

Implementation: pass a ReactNode with responsive spans:

```tsx
label={
  <>
    <span className="sm:hidden">Target</span>
    <span className="hidden sm:inline">Rev. Target</span>
  </>
}
```

### Sub-label (state + enrollment)

Added below the district name, hidden on desktop:

```tsx
<span className="sm:hidden text-[9px] text-[#8A80A8] mt-0.5 block">
  {district.stateAbbrev ?? "—"}
  {district.enrollment != null && ` · ${formatEnrollment(district.enrollment)}`}
</span>
```

`formatEnrollment` is a small inline helper (not a shared utility — too small to warrant extraction):

```ts
function formatEnrollment(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
}
```

### Attainment Color Coding

No change to existing `getAttainmentStyle` helper — it already handles the color tiers.

### Expand Chevron

The expand chevron already lives in the name cell. No changes needed — it remains visible at all widths and communicates row interactability.

## Architecture

### Files Changed

**Modify:** `src/features/map/components/SearchResults/PlanDistrictsTab.tsx`

1. `SortBtn` — change `label: string` → `label: React.ReactNode`
2. Header row div — update grid class to responsive version
3. `SortBtn` calls for "Rev. Target" and "Rev. Actual" — pass responsive ReactNode labels
4. `DistrictRow` collapsed-row div — update grid class to responsive version
5. Name cell — add `sm:hidden` sub-label below district name
6. Add `formatEnrollment` helper function (file-local)

### No Changes To

- Expanded row panel (service breakdown, revenue inputs, notes, remove button)
- Footer
- Sort logic
- Any other component

## Implementation Notes

- The `28px` remove-button slot stays in the grid on mobile even when the button is hidden — this keeps the column count consistent between header and data rows, which is required for alignment.
- `formatEnrollment` rounds to nearest K — "25321 enrolled" → "25K". Values under 1000 display as-is (rare but possible for tiny charter districts).
- No `useIsMobile` hook needed — the layout change is purely Tailwind responsive classes. The sub-label ReactNode approach also avoids any JS overhead.
- Verify at 320px (older iPhones) and 390px (iPhone 14) in Safari Responsive Design Mode before marking complete.
