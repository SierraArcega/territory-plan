# Explore Filter & Sort Upgrade — Design Doc

**Date:** 2026-02-17
**Inspiration:** Attio CRM filter/sort UX (reference images in `Data Files/Reference Images/Filter + Sort/`)
**Approach:** Refactor in place (Approach A) — evolve existing components

---

## Overview

Upgrade the Explore space's filtering and sorting to match the Attio-style progressive builder pattern. Key improvements:

1. **3-step progressive filter builder** (attribute → operator → value)
2. **Multi-sort** with dedicated dropdown and drag-to-reorder
3. **Saved views** persisted to localStorage
4. **Searchable attribute pickers** for both filter and sort
5. **Improved filter chips** showing attribute · operator · value with click-to-edit

---

## 1. Filter Builder — 3-Step Progressive Flow

### Step 1: Attribute Picker
- Searchable dropdown showing columns grouped by category (Core, CRM/Revenue, Education, Demographics, Signals, Engagement)
- Text input at top filters the list as you type
- Grouped with section headers matching existing `ColumnDef.group`

### Step 2: Operator Picker
Based on the column's `filterType`, show relevant operators:

| filterType | Operators |
|---|---|
| `text` | is, is not, contains, is empty, is not empty |
| `enum` | is, is not, is empty, is not empty |
| `number` | is, is not, less than, greater than, between, is empty, is not empty |
| `boolean` | is true, is false |
| `date` | is, before, after, between, is empty, is not empty |
| `tags` | contains, is empty, is not empty |

### Step 3: Value Input
Contextual based on type + operator:
- **Text:** Text input field
- **Enum:** Searchable list of enum values
- **Number:** Single number input, or two inputs for "between"
- **Date:** Date picker, or two pickers for "between"
- **Boolean:** No value step (operator implies value)
- **Empty/not empty:** No value step needed

### Active Filter Chips
- Render inline in the toolbar: `Attribute · Operator · Value`
- Each chip has an × to remove
- Clicking a chip re-opens it for editing (jumps to the relevant step)
- "Clear all" link when any filters are active

---

## 2. Multi-Sort Dropdown

### Toolbar Button
- "Sort" button sits to the left of "Filter" in the toolbar
- Shows a badge count when sorts are active (e.g. "Sort · 2")

### Dropdown Contents
- Each active sort rule: `[drag handle] [Column name] · [Asc ↕ Desc] · [× remove]`
- "+ Add sort" button opens the searchable attribute picker
- Sort rules ordered top-to-bottom by priority (first = primary sort)
- **Drag to reorder** for changing priority

### Column Header Shortcut
- Clicking a column header in the table sets that column as a **single sort** (replaces existing sorts)
- This is the quick path; the dropdown is the power-user path for multi-sort

### Store Changes
- `exploreSort` type changes from `ExploreSortConfig | null` to `ExploreSortConfig[]`
- New actions: `addSortRule`, `removeSortRule`, `reorderSortRules`

---

## 3. Saved Views

### UI
- Dropdown at the far left of the toolbar
- Shows current view name, or "Unsaved View" if modified
- When modified: "Discard changes" and "Save" buttons appear

### What a View Contains
- Entity type
- Active filters (array)
- Active sort rules (array)
- Visible columns (array)

### Workflow
1. Start from a saved view (or "Default")
2. Change filters/sorts/columns → label updates to show unsaved state
3. "Save" overwrites current view; "Save as new" creates a named copy
4. "Discard changes" reverts to last saved state
5. Delete custom views (Default view cannot be deleted)

### Storage
- localStorage, keyed by entity type
- Key: `explore-views-{entity}`
- Default view per entity: no filters, no sorts, default columns

---

## 4. Toolbar Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ Header:  "Explore Districts"                            "1,234 total" │
├────────────────────────────────────────────────────────────────────────┤
│ [📋 Default View ▾] [⇅ Sort · 2] [▽ Filter] │chip│chip│  [Discard]   │
│                                                  [Save]       [Cols ⚙]│
├────────────────────────────────────────────────────────────────────────┤
│ KPI Cards                                                             │
├────────────────────────────────────────────────────────────────────────┤
│ Data Table                                                            │
└────────────────────────────────────────────────────────────────────────┘
```

- **View dropdown:** far left
- **Sort button:** with badge count, opens sort dropdown
- **Filter button:** opens 3-step progressive builder
- **Filter chips:** flow inline after Filter button
- **Discard/Save:** appear on right when view has unsaved changes
- **Column picker:** existing component, stays far right

---

## 5. Store & API Changes

### New Types
```typescript
// Expanded FilterOp union
type FilterOp = "eq" | "neq" | "in" | "contains" | "gt" | "gte" | "lt" | "lte"
  | "between" | "is_true" | "is_false" | "is_empty" | "is_not_empty";

// Saved view
interface ExploreSavedView {
  id: string;
  name: string;
  entity: ExploreEntity;
  filters: ExploreFilter[];
  sorts: ExploreSortConfig[];
  columns: string[];
}
```

### Store Updates
- `exploreSort`: `Record<ExploreEntity, ExploreSortConfig[]>` (was `...| null`)
- New state: `exploreSavedViews: Record<ExploreEntity, ExploreSavedView[]>`
- New state: `activeViewId: Record<ExploreEntity, string | null>`
- New actions: `addSortRule`, `removeSortRule`, `reorderSortRules`, `saveView`, `loadView`, `deleteView`

### API Route Updates
- Explore API already accepts `sort` and `filters` params
- Needs to handle: multi-sort (array of sort configs), `is_empty`/`is_not_empty` operators, `neq` operator
- No new API routes required

### No New Dependencies
- Drag-to-reorder uses HTML5 drag events (no library needed)
- All UI built with existing Tailwind utilities

---

## 6. Files Changed

| File | Change |
|---|---|
| `src/lib/map-v2-store.ts` | Update types, add multi-sort + saved views state/actions |
| `src/components/map-v2/explore/ExploreFilters.tsx` | Refactor to 3-step builder, add operator step, search, chip editing |
| `src/components/map-v2/explore/ExploreOverlay.tsx` | Update toolbar layout, wire new sort/view components |
| `src/components/map-v2/explore/ExploreSortDropdown.tsx` | **New** — multi-sort dropdown with drag reorder |
| `src/components/map-v2/explore/ExploreSavedViews.tsx` | **New** — saved views dropdown with save/discard |
| `src/components/map-v2/explore/ExploreTable.tsx` | Update sort handler for multi-sort compatibility |
| `src/app/api/explore/[entity]/route.ts` | Handle multi-sort array, new filter operators |
| `src/components/map-v2/explore/columns/districtColumns.ts` | No changes needed (operators derived from filterType) |
