# Filter & Facets

Two filter systems: **Explore filters** (structured column/operator/value for tabular data) and **Map layer toggles** (vendor/signal/locale visibility). This doc covers both.

---

## Decision Tree: Which Filter Pattern?

```
1. Filtering tabular data with column-based criteria?
   -> Explore Filters (3-step picker)

2. Toggling map layer visibility (vendors, signals, school types)?
   -> Layer Bubble toggles

3. Quick-filtering a list by search text?
   -> Inline search input (see forms-and-editing.md)
```

---

## Explore Filter Architecture

3-step picker flow. State machine: `PickerStep = "column" | "operator" | "value"`.

```
Step 1: Column       Step 2: Operator      Step 3: Value
+--------------+    +--------------+    +--------------+
| Search...    |    | [<-] Column  |    | [<-] Col . Op|
| -- Group --- |    | ------------ |    | ------------ |
|  Column A    | -> |  is          | -> |  [input]     |
|  Column B    |    |  is not      |    |  [Apply]     |
|  Column C    |    |  contains    |    +--------------+
+--------------+    |  is empty    |
                    +--------------+
```

Picker container styling:

```tsx
{/* Filter picker dropdown — absolute-positioned below trigger */}
<div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-lg z-30 overflow-hidden">
  {/* step content */}
</div>
```

> **Migration note:** `border-gray-200` should migrate to token border `#D4CFE2`.

**Step transitions:**

| From | Action | To |
|------|--------|----|
| `column` | Click column | `operator` (stores `selectedColumn`) |
| `operator` | Click operator with `needsValue: true` | `value` (stores `selectedOperator`) |
| `operator` | Click operator with `needsValue: false` | Submit immediately, close picker |
| `value` | Click Apply / Enter | Submit filter, close picker |
| any | Click back arrow | Previous step |
| any | Click outside | Close picker, reset state |

---

## Filter Types & Operators

Complete `OPERATORS_BY_TYPE` mapping from `ExploreFilters.tsx`:

| Filter Type | Operators | Op codes |
|-------------|-----------|----------|
| `text` | is, is not, contains, is empty, is not empty | `eq`, `neq`, `contains`, `is_empty`, `is_not_empty` |
| `enum` | is, is not, is empty, is not empty | `eq`, `neq`, `is_empty`, `is_not_empty` |
| `number` | is, is not, greater than, less than, between, is empty, is not empty | `eq`, `neq`, `gt`, `lt`, `between`, `is_empty`, `is_not_empty` |
| `boolean` | is true, is false | `is_true`, `is_false` |
| `date` | is, after, before, between, is empty, is not empty | `eq`, `gt`, `lt`, `between`, `is_empty`, `is_not_empty` |
| `tags` | contains, is empty, is not empty | `contains`, `is_empty`, `is_not_empty` |
| `relation` | includes any of, excludes all of, has none, has any | `eq`, `neq`, `is_empty`, `is_not_empty` |

Operators with `needsValue: false` (`is_empty`, `is_not_empty`, `is_true`, `is_false`) submit immediately without Step 3.

Canonical `FilterOp` union (source of truth: `src/features/explore/lib/filters.ts`):

```ts
type FilterOp =
  | "eq" | "neq" | "in" | "contains"
  | "gt" | "gte" | "lt" | "lte" | "between"
  | "is_true" | "is_false"
  | "is_empty" | "is_not_empty";
```

---

## Filter Pill Pattern

Active filter rendered as a tinted pill. Click pill to edit (re-opens picker at value step), click x to remove.

```tsx
{/* Active filter pill — brand-tinted chip */}
<span
  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#C4E7E6]/30 text-[#403770] rounded-full border border-[#C4E7E6]/50 cursor-pointer hover:bg-[#C4E7E6]/50 transition-colors"
  onClick={() => handleChipClick(filter)}
>
  {pillLabel}
  <button
    onClick={(e) => { e.stopPropagation(); onRemoveFilter(filter.id); }}
    className="text-[#403770]/40 hover:text-[#403770] transition-colors"
  >
    {/* x close icon */}
  </button>
</span>
```

**Pill label format:** `Column . Operator . Value`

| Operator type | Label example |
|---------------|---------------|
| No-value ops | `State . is empty` |
| Single value | `Enrollment . greater than . 5,000` |
| Between | `Enrollment . between . 1,000-10,000` |
| Multi-select relation | `Tags . includes any of . Pilot, Growth` (or `Tag1 +2 more`) |

---

## Value Input Components

| Filter Type | Component | Key Behavior |
|-------------|-----------|--------------|
| `text` | `TextFilterInput` | Simple text input, Enter to submit |
| `enum` | `EnumFilterInput` | Searchable list (search shown when >5 values), click to select |
| `number` | `NumberFilterInput` | Number input; `between` shows min/max pair |
| `date` | `DateFilterInput` | Date input; `between` shows start/end pair |
| `boolean` | (none) | No value input -- submits immediately on operator select |
| `tags` | `TextFilterInput` | Text contains search |
| `relation` | `RelationFilterInput` | Multi-select with checkboxes, search, Apply button with count badge |

All value inputs share this Apply button pattern:

```tsx
{/* Apply button — used in text, number, date, relation inputs */}
<button
  disabled={!canApply}
  onClick={handleApply}
  className="w-full px-3 py-1.5 text-xs font-medium text-white bg-plum rounded-lg hover:bg-plum/90 disabled:opacity-40"
>
  Apply{/* relation adds count: ` (3)` */}
</button>
```

All text inputs share this styling:

```tsx
{/* Filter text input — reused across TextFilterInput, EnumFilterInput search, RelationFilterInput search */}
<input
  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
/>
```

> **Migration note:** `border-gray-200` on inputs should migrate to token border `#C2BBD4` (strong tier).

---

## Column Definitions by Entity

| Entity | Column Defs File |
|--------|-----------------|
| districts | `src/features/map/components/explore/columns/districtColumns.ts` |
| activities | `src/features/map/components/explore/columns/activityColumns.ts` |
| tasks | `src/features/map/components/explore/columns/taskColumns.ts` |
| contacts | `src/features/map/components/explore/columns/contactColumns.ts` |
| plans | `src/features/map/components/explore/columns/planColumns.ts` |

`ColumnDef` shape (from `districtColumns.ts` -- most complete variant):

```ts
interface ColumnDef {
  key: string;            // unique column identifier
  label: string;          // display name
  group: string;          // grouping header in pickers
  isDefault: boolean;     // visible by default
  filterType: "text" | "enum" | "number" | "boolean" | "date" | "tags" | "relation";
  enumValues?: string[];  // for enum filterType
  relationSource?: "tags" | "plans";  // for relation filterType (districts only)
  editable?: boolean;     // inline-editable in table
}
```

Districts also supports dynamic competitor columns via `getCompetitorColumns(competitorFYs)`.

---

## Saved Views

`ExploreSavedView` persists filter + sort + column state per entity.

```ts
interface ExploreSavedView {
  id: string;
  name: string;
  entity: ExploreEntity;      // "districts" | "activities" | "tasks" | "contacts" | "plans"
  filters: ExploreFilter[];
  sorts: ExploreSortConfig[];
  columns: string[];           // visible column keys
}
```

| Behavior | Detail |
|----------|--------|
| Storage | `localStorage` key `explore-views-{entity}` |
| Default view | Resets filters to `[]`, sorts to `[]`, columns to `isDefault` columns |
| Dirty detection | Compares current filters/sorts/columns against active saved view via `JSON.stringify` |
| Save | Overwrites active view in-place |
| Discard | Reverts to last saved state via `loadView()` |

Sort state type for reference:

```ts
interface ExploreSortConfig {
  column: string;
  direction: "asc" | "desc";
}
```

---

## Map Layer Toggles

`LayerBubble` controls map layer visibility -- distinct from Explore filters. These toggle what renders on the map, not what rows appear in a table.

**Layer categories managed by LayerBubble:**

| Category | Store fields | Toggle pattern |
|----------|-------------|----------------|
| Vendors (Fullmind, competitors) | `activeVendors`, `fullmindEngagement`, `competitorEngagement` | Checkbox per vendor + nested engagement level checkboxes |
| Signals (growth, churn, etc.) | `activeSignal` | Radio-style -- one signal active at a time |
| School types | `visibleSchoolTypes` | Checkbox per type (elementary, middle, high, charter) |
| Locales (urbanicity) | `visibleLocales` | Checkbox per locale category |
| Account types | `filterAccountTypes` | Checkbox per account type |
| Fiscal year | `selectedFiscalYear` | Radio-style selector |

**Nested engagement pattern:** Vendors use `GroupRow` with parent checkbox (tri-state: all/some/none) and collapsible child checkboxes for engagement levels (pipeline, multi-year, etc.).

**Palette & color customization:** Each vendor layer supports palette switching (`VendorPalettePicker`), per-category color swatches (`CategorySwatchPicker`), and per-category opacity sliders.

**Saved map views:** Separate from Explore saved views. Stored in `localStorage` key `territory-plan:saved-map-views`. Persists vendor, signal, locale, engagement, fiscal year, palette, and filter state.

---

## Sort Controls

`ExploreSortDropdown` provides multi-column sorting with drag-to-reorder.

| Feature | Detail |
|---------|--------|
| Add sort | Column picker (grouped, searchable), excludes already-sorted columns |
| Direction toggle | `asc`/`desc` button per rule |
| Reorder | Drag handle (`::`) with HTML drag-and-drop |
| Remove | x button per rule |
| Badge | Count badge on trigger when sorts active |

---

## Column Visibility

`ExploreColumnPicker` controls which columns show in the explore table.

| Feature | Detail |
|---------|--------|
| Layout | Grouped checkbox list in dropdown |
| Actions | "All" (select all) / "Reset" (restore `isDefault` columns) |
| Constraint | Cannot remove last column |
| Persistence | `localStorage` key `explore-columns` |

---

## Store Types

Core filter/sort types live in `src/features/map/lib/store.ts`:

```ts
type ExploreEntity = "districts" | "activities" | "tasks" | "contacts" | "plans";

interface ExploreFilter {
  id: string;
  column: string;
  op: FilterOp;
  value: string | number | boolean | string[] | [number, number];
}

interface ExploreSortConfig {
  column: string;
  direction: "asc" | "desc";
}
```

Filter state is per-entity: `exploreFilters[entity]`, `exploreSort[entity]`, `exploreColumns[entity]`.

---

## Codebase Reference

| Component | File |
|-----------|------|
| Explore filters (3-step picker) | `src/features/map/components/explore/ExploreFilters.tsx` |
| Explore overlay | `src/features/map/components/explore/ExploreOverlay.tsx` |
| Column picker | `src/features/map/components/explore/ExploreColumnPicker.tsx` |
| Sort dropdown | `src/features/map/components/explore/ExploreSortDropdown.tsx` |
| Saved views | `src/features/map/components/explore/ExploreSavedViews.tsx` |
| Layer bubble (map toggles) | `src/features/map/components/LayerBubble.tsx` |
| Filter types & `buildWhereClause` | `src/features/explore/lib/filters.ts` |
| Store (filter state) | `src/features/map/lib/store.ts` |
| District columns | `src/features/map/components/explore/columns/districtColumns.ts` |
| Activity columns | `src/features/map/components/explore/columns/activityColumns.ts` |
| Task columns | `src/features/map/components/explore/columns/taskColumns.ts` |
| Contact columns | `src/features/map/components/explore/columns/contactColumns.ts` |
| Plan columns | `src/features/map/components/explore/columns/planColumns.ts` |
