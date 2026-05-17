# Feature Spec: Sort + Group Toolbar Controls for Entity Grid Views

**Date:** 2026-05-17
**Slug:** views-sort-and-group
**Branch:** worktree-saved-views-sidebar

## Requirements

Add explicit Sort and Group controls to every entity grid view (Table / Contacts /
Opps / Vacancies / News / RFPs) so reps can re-order rows and bucket them by a
discrete field without learning the shift-click multi-sort gesture.

**In scope:**
- Sort button + chips in the toolbar; mirrors today's Filter chip pattern.
- Group button + single chip in the toolbar; one active group at a time.
- Group rendering: collapsible sticky section headers with row counts.
- Persistence of `groupBy` in `viewLayouts` (backward-compatible schema change).
- Bundled flag-flips: `contacts.name` and `contacts.leaid` become sortable.

**Out of scope:**
- Map view (no rows) and Kanban view (already groups by stage).
- Districts `target`, `pipeline`, `stage` sort/group — needs an SQL refactor;
  separate follow-up issue.
- Group aggregates (sum, avg, max). Counts only.
- Persisting collapsed-group state. Per-session only.
- Drag-to-reorder of the sort stack. Re-add to change priority.

**Performance:** Frontend-only — `groupBy` prepends to the existing `layout.sort`
array, so the existing SQL ORDER BY does the grouping work. No new queries, no
new backend code path.

## Visual Design

**Approved approach:** Inline triple chip strip — Filter / Sort / Group on one
row, with the column gear `[⚙]` pinned right. Each cluster has its own `+`
button and chip area; chips share visual treatment for cohesion. See the
approved preview in conversation history.

**Key architectural decisions:**
- `GridView` remains the single host. All 6 entity views are thin wrappers
  over it, so toolbar changes land in one place.
- Sort and Group reuse the existing `GridFilterChips` + `FilterFieldPicker`
  patterns — same border tokens, same popover layout, same dashed-add CTA.
- Group rendering is purely client-side: walk the returned (sorted) rows and
  inject section-header `<tr>` rows wherever the group value changes.
- Collapsed state is per-session component state; not persisted.

### Toolbar — final spec

| Element | Style |
|---|---|
| `+ Filter` / `+ Sort` / `+ Group` buttons | Existing dashed CTA pill. `rounded-full`, `border-dashed border-[#E2DEEC]`, `text-[12px] text-[#544A78]`, hover bg `#F7F5FA`. Lucide `Plus` at 12px. |
| Filter chip (existing) | `bg-[#F7F5FA]`, `border-[#E2DEEC]`, plum text `#403770`, `X` removes. Click body → reopen widget. |
| Sort chip | Same pill style. Body: `↓ Target` (lucide `ArrowDown`/`ArrowUp` 12px + column header). 2+ sorts show a tiny ¹/²/³ index suffix. Click body → flip direction. Click `X` → remove. |
| Group chip | Same pill style. Body: `≣ Stage` (lucide `Layers` 12px + column header, no direction). Single chip max. Click body → reopen picker to swap. Click `X` → remove. |
| Picker popovers | 224px panel, `bg-white`, `rounded-lg`, `border-[#E2DEEC]`, `shadow-md`, z-30. Header label "Add sort" or "Group by". Disabled rows = already-used field or column hidden. |

### Group rendering — final spec

When `layout.groupBy` is set, rows arrive pre-sorted by the group field
(frontend prepends `{ id: groupBy, dir: "asc" }` to the sort stack before the
fetch). The component walks the returned rows and emits a section header
whenever the group value changes:

```
▾  NEW YORK · 12 rows           ← sticky header (top: ~36px, below thead)
   <data rows…>
▸  CALIFORNIA · 8 rows (collapsed)
▾  TEXAS · 5 rows
   <data rows…>
— No value — · 3 rows           ← null group; rendered at the end
   <data rows…>
```

Header row spec:
- `<tr>` with `<td colSpan={visibleCols.length}>` containing the chevron + label + count.
- `bg-[#F7F5FA]`, `border-b border-[#EFEDF5]`, `position: sticky; top: 36px` (below the column header).
- `text-[12px] font-semibold text-[#403770]`, group value `uppercase tracking-[0.06em]`.
- Count rendered as `· {n} rows` in `text-[#8A80A8]`.
- Chevron: `ChevronDown` (expanded) / `ChevronRight` (collapsed), 14px, plum.
- Entire row clickable; cursor pointer; hover bg `#EFEDF5`.

Collapsed state: `Set<string>` in `useState`, keyed by the stringified group
value. Resets to empty (all expanded) on every mount.

Null/undefined group values render under `— No value —`, sorted to the end.

### Picker contents

**SortFieldPicker** — all columns in `SOURCE_COLUMNS[source]` where
`sortable: true`. Already-sorted fields appear disabled.

**GroupFieldPicker** — columns where `sortable: true` AND
`filterWidget.kind ∈ { multiselect, select, toggle }`. Per source:

| Source | Groupable columns |
|---|---|
| districts | State, Customer, Open pipe, Has target |
| contacts | Persona, Seniority, Primary |
| opps | Stage, State, School year |
| vacancies | Status, Category, Relevant |
| news | Relevance, Source |
| rfps | Status, Relevance, State |

## Component Plan

**New components** (all under `src/features/views/components/grid/`):
- `GridSortChips.tsx` — chip array + `+ Sort` button + clear-all link. Mirrors `GridFilterChips`.
- `GridGroupChip.tsx` — single chip + `+ Group` button. Mirrors `GridFilterChips` shape, no array.
- `SortFieldPicker.tsx` — popover; mirrors `FilterFieldPicker`.
- `GroupFieldPicker.tsx` — popover; mirrors `FilterFieldPicker`.

**Components to extend:**
- `GridView.tsx` — host the new toolbar siblings; inject group-header `<tr>` rows during render; manage collapsed-state `Set`.
- `grid-layout-schema.ts` — add optional `groupBy: { id: string } | null` field with `sortableFieldIds` superRefine; replicate on `newsLayoutSchema`.
- `useGridLayout.ts` — initialize `groupBy: null` in the default layout; persist round-trips automatically (it already debounces the whole layout blob).
- `useViewsData.ts` — when `layout.groupBy` is set, prepend `{ id: groupBy.id, dir: "asc" }` to the sort stack before serializing the URL params.
- `columns.ts` — flag-flip `contacts.name` and `contacts.leaid` to `sortable: true`.
- `source-fields.ts` (`SOURCE_FIELDS`) — add `{ id: "name", column: "name", type: "text" }` to `contacts` so the API/SQL pipeline accepts it.

**Reused without change:**
- `FilterFieldPicker.tsx`, `GridFilterChips.tsx`, `GridColumnMenu.tsx`, `GridHeaderCell.tsx`, all widget components.

## Backend Design

See `docs/superpowers/specs/2026-05-17-views-sort-and-group-backend-context.md`.

**Summary:** No new tables, no new API routes, no new SQL compilation paths.
Sort and Group both flow through the existing `layout.sort` → URL `sort=` →
`buildOrderBy` pipeline.

**Schema change:** Add optional `groupBy: { id: string } | null` to
`gridLayoutSchema` with a `sortableFieldIds` superRefine. Existing persisted
layout blobs validate unchanged (optional field).

## States

| State | Approach |
|---|---|
| Loading | Toolbar renders with current chip state. Body shows `LoadingState rows={8}`. No spinner on chips. |
| Empty (no filters) | Toolbar visible. Body shows `EmptyState`. |
| Filtered empty | Existing `FilteredEmptyState` with "Clear filters" button. Sort and Group chips stay visible — clearing filters won't help if no data matches. |
| Error | Toolbar visible. Body shows `ErrorState` with retry. |
| Group with 0 rows in a group | Header doesn't render — we iterate actual returned rows. |
| Invalid groupBy on hydrate | Zod schema rejects on PATCH; on hydrate (`useGridLayout`), an invalid `groupBy` is dropped silently — no error UI. |
| News cards mode | Sort button visible (controls render order). Group button hidden when `source === "news" && layout.mode === "cards"`. |

## Hover and focus states

- Buttons: hover bg `#F7F5FA`. Focus ring `ring-1 ring-[#403770]/40`.
- Chips: hover bg `#EFEDF5`. Body button gets focus ring on keyboard nav.
- Picker rows: hover bg `#F7F5FA`. Disabled rows: `cursor-not-allowed`, `opacity-50`.
- Group header row: hover bg `#EFEDF5` (subtle — signals clickability).

## Narrow-width behavior

The toolbar row inherits `overflow-x-auto` from the existing chip strip. The
three button/chip clusters are all `shrink-0` so they stay inline; users scroll
horizontally on phones. Per tokens.md § Narrow-Width Resilience: every text
span gets `whitespace-nowrap`. The `[⚙]` gear stays pinned right outside the
scroll area.

## Persistence

- `layout.groupBy: { id: string } | null` persisted via the existing
  debounced PATCH in `useGridLayout`.
- Backward-compatible: missing field validates as `undefined`; older clients
  ignore it.
- Collapsed-group state: per-session, in component `useState`, not persisted.

## Test Strategy

**Schema (`src/lib/saved-views/__tests__/grid-layout-schema.test.ts`):**
- Accepts `groupBy: { id: "state" }` on districts.
- Accepts `groupBy: null` and `groupBy: undefined`.
- Rejects `groupBy: { id: "target" }` (non-sortable).
- Parses a legacy blob without `groupBy` (backward compat).
- Replicated suite for `newsLayoutSchema`.

**Component (`src/features/views/components/grid/__tests__/`):**
- `GridSortChips.test.tsx` — pick a field, chip appears; click body flips direction; X removes; clear-all empties stack.
- `GridGroupChip.test.tsx` — pick a field, chip appears; picking another replaces; X removes; chip hidden in News cards mode.
- `GridView.test.tsx` — groupBy renders section headers; collapse toggles row visibility; null group lands at end with "— No value —"; ungrouped state renders no headers.

**E2E (existing `useGridLayout` integration test):**
- Extend the filter→save→refetch suite to: set sort + group, await debounce, reload, confirm both persist.

## Out of Scope

- Districts `stage` / `target` / `pipeline` / `won_range` sort + group — needs SQL refactor.
- Group aggregates (sum, avg) — counts only this round.
- Drag-to-reorder for the sort stack — re-add to change priority.
- Persisting collapsed-group state — per-session only.
- Group on Map (no rows) and Kanban (already groups by stage).
- Owner groupBy on opps — needs `SOURCE_FIELDS.opps.owner` field.
