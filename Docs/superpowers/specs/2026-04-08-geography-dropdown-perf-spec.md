# Geography Dropdown Performance Optimization

**Date:** 2026-04-08
**Branch:** `feat/geography-dropdown-perf`
**Status:** Approved design, pending implementation

## Problem

The Geography filter dropdown has a noticeable delay (300-600ms) when first opened. State and County dropdowns appear empty until their API responses arrive. The county list also causes DOM overhead by rendering all ~3,000 items at once.

### Root Causes

1. **No prefetching** — States fetched via raw `fetch()` with no caching. Counties fetched via TanStack Query but only triggered when the dropdown mounts.
2. **Large DOM rendering** — `FilterMultiSelect` renders all ~3,000 county option nodes into the DOM simultaneously. The container has `max-h-36 overflow-y-auto` but all nodes exist in the tree.
3. **Inconsistent data layer** — States use raw `fetch()` while counties use TanStack Query (`useCounties()`). A `useStates()` hook already exists in `queries.ts` but isn't used by GeographyDropdown.

### What Works Well

- TanStack Query caches counties with `staleTime: Infinity` — subsequent opens are fast after first load.
- County list correctly scopes to selected states via client-side `useMemo` filtering.
- Only the county list exceeds 100 items. All other `FilterMultiSelect` usages (State ~50, Tags/Sales Exec/Plans <100) are fine.

## Solution: Prefetch + List Virtualization

### Approach

Prefetch geography data on page load so it's ready before the dropdown opens. Virtualize the county list so only visible rows render in the DOM. No API changes, no database changes.

**Expected result:** First-click delay drops from 300-600ms to <50ms.

## Design

### 1. Data Layer Changes

#### 1A. Switch GeographyDropdown to useStates() hook

**File:** `src/features/map/components/SearchBar/GeographyDropdown.tsx`

Remove the raw `fetch("/api/states")` call and local `useState` for states (lines 20, 47-58). Replace with the existing `useStates()` TanStack Query hook from `queries.ts:42-50`.

This eliminates ~12 lines of code and gives states the same caching behavior as counties (24h staleTime).

#### 1B. Prefetch states + counties on page load

**File:** `src/features/map/lib/queries.ts`

Add a `useGeographyPrefetch()` hook that calls both `useStates()` and `useCounties()`. This triggers the fetches immediately rather than waiting for the Geography dropdown to mount.

**File:** `src/features/map/components/SearchBar/index.tsx`

Call `useGeographyPrefetch()` in the SearchBar component (always mounted), so data starts loading on page load.

#### 1C. Loading states instead of conditional rendering

**File:** `src/features/map/components/SearchBar/GeographyDropdown.tsx`

Currently, State and County sections are hidden until data loads:
```tsx
{states.length > 0 && <FilterMultiSelect ... />}
{countyOptions.length > 0 && <FilterMultiSelect ... />}
```

Replace with always-rendered sections that accept a `loading` prop. This prevents layout shift and shows the dropdown structure immediately with a loading indicator on the rare occasion data isn't cached yet.

### 2. List Virtualization

#### 2A. New dependency

Install `@tanstack/react-virtual` (~3KB gzipped, zero sub-dependencies, same ecosystem as TanStack Query).

#### 2B. Virtualization in FilterMultiSelect

**File:** `src/features/map/components/SearchBar/controls/FilterMultiSelect.tsx`

Add two optional props:

```typescript
interface FilterMultiSelectProps {
  label: string;
  column: string;
  options: Array<{ value: string; label: string }>;
  onApply: (column: string, values: string[]) => void;
  loading?: boolean;     // show loading indicator
  virtualize?: boolean;  // enable list virtualization
}
```

When `virtualize={true}`:

1. The scrollable `<div>` (currently `max-h-36 overflow-y-auto`) gets a ref for the virtualizer.
2. `useVirtualizer` from `@tanstack/react-virtual` calculates which rows are visible.
3. Only visible rows + overscan buffer (5 above, 5 below) render as DOM nodes (~25 total instead of 3,000).
4. Inner container uses `position: relative` with calculated total height for correct scrollbar behavior.
5. Each row uses `position: absolute` + `translateY` for placement.

When `virtualize` is not passed or `false`, the component renders exactly as it does today. All other callers (State, Tags, Sales Exec, Plans) are unaffected.

#### 2C. Preserved behaviors

These work identically with virtualization enabled:

- **Search** — Client-side filtering via `useMemo`. The virtualizer re-renders with the filtered list.
- **Select All** — Fixed element above the virtualized list. Operates on the full filtered array, not just rendered items.
- **Keyboard navigation** — Arrow keys update `activeIndex`. The virtualizer's `scrollToIndex` ensures the active item is visible.
- **Selected pills** — Rendered above the list, outside the virtualized area. Unchanged.
- **Visual appearance** — Same height, same styling, same scrollbar. Indistinguishable from the current UI.

### 3. Usage in GeographyDropdown

The County `FilterMultiSelect` gets both new props:

```tsx
<FilterMultiSelect
  label="County"
  column="countyName"
  options={countyOptions}
  onApply={handleCountyApply}
  loading={isLoadingCounties}
  virtualize
/>
```

The State `FilterMultiSelect` gets only `loading` (no need to virtualize ~50 items).

## Files Changed

| File | Change | Risk |
|------|--------|------|
| `package.json` | Add `@tanstack/react-virtual` | Low |
| `src/features/map/lib/queries.ts` | Add `useGeographyPrefetch()` hook | Low |
| `src/features/map/components/SearchBar/index.tsx` | Call `useGeographyPrefetch()` | Low |
| `src/features/map/components/SearchBar/GeographyDropdown.tsx` | Use `useStates()`, pass `virtualize`/`loading` props, remove conditional render guards | Medium |
| `src/features/map/components/SearchBar/controls/FilterMultiSelect.tsx` | Add `virtualize` + `loading` props, conditional virtualizer rendering, keyboard scroll-to-index | Medium |

**Total:** 5 files modified. No new files. No API changes. No database changes.

## Testing

### Unit Tests

- FilterMultiSelect with `virtualize={true}` and 3,000 options renders only visible items
- Search filters the virtualized list correctly
- Select All works across all items (not just rendered ones)
- Keyboard navigation scrolls to active item via `scrollToIndex`
- FilterMultiSelect without `virtualize` prop behaves identically to current implementation
- Loading state renders correctly when `loading={true}`

### Manual QA

- Open Geography — State and County populate instantly (no delay)
- Search counties without selecting a state first (e.g., "Cook")
- Select a state, verify county list scopes correctly
- Select All counties, verify filter applies to map
- Scroll through full county list — smooth, no blank flicker
- ZIP code search still works
- Fullmind dropdown filters (Sales Exec, Plans, Tags) — unchanged
- Districts dropdown filters — unchanged
- Filter pills appear/clear correctly for geography selections

## Implementation Order

1. Create branch `feat/geography-dropdown-perf` from main
2. Install `@tanstack/react-virtual`, add `useGeographyPrefetch()`, wire into SearchBar
3. Refactor GeographyDropdown to use `useStates()` hook
4. Add virtualization + loading support to FilterMultiSelect
5. Write unit tests for virtualized and non-virtualized paths
6. Manual QA, then PR to main
