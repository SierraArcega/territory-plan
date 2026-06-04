# GridView — Frozen Column, Working Resize, New-Biz-First (PR #246 follow-up)

**Date:** 2026-06-01
**Branch:** `feat/grid-frozen-resize-columns`
**Scope:** Three follow-up changes to the district Table view shipped in PR #246.

## Problem

After PR #246 (inline target editing in `GridView`), a quick-feedback iteration surfaced three issues:

1. The four target sub-columns render **Renewal → Expansion → Win Back → New Biz**; New Biz should come **first**.
2. The district-name column scrolls out of view horizontally; it should stay **frozen** (always visible).
3. Column resize is **cosmetic** — the `col-resize` cursor shows on hover but dragging does nothing visible and does not persist a usable width.

## Root Causes (verified in code)

- **Order:** `SUB_COLS` array (`GridView.tsx:229`) defines sub-column order; the header rendering hard-codes `renewalTarget` as the first sub-column that owns the collapse chevron (`GridView.tsx:982-994`).
- **Frozen:** No `position: sticky` left anywhere. The scroll container (`GridView.tsx:871`, `overflow-auto`) does scroll horizontally, so a sticky-left column is meaningful. In a plan there is also a 36px checkbox column left of the name.
- **Resize:** Two faults. (a) `GridHeaderCell` computes a `draggingWidth` state on pointer-move but **never applies it** anywhere → no live feedback. (b) The table is `table-layout: auto` with `whitespace-nowrap` cells and a `width:100%` spacer column, so a `<th style={{width}}>` is only a hint the browser ignores; a column cannot shrink below its content's min-content width. Net effect: resize feels purely cosmetic.

## Design

### 1. New Biz first

Reorder `SUB_COLS` to **New Biz → Renewal → Expansion → Win Back**. Move the collapse-chevron special case from `renewalTarget` to `newBusinessTarget` in the header renderer. Sub-column accessors/values are keyed by field id, not position, so cell rendering and persistence are unaffected.

### 2. Freeze checkbox + district-name region

- The 36px checkbox `<th>`/`<td>` and the name `<th>`/`<td>` become `position: sticky`: checkbox at `left: 0`, name at `left: 36px` (or `left: 0` when no checkbox column is present).
- Frozen cells get an opaque background (`#FFFCFA` body, `#F7F5FA` header) plus a `group-hover` tint so row hover still reads, and a right border (`#EFEDF5`) to delineate the frozen edge.
- z-index layering: normal `thead` stays `z-[1]`; frozen header corner cells `z-[3]`; frozen body cells `z-[2]`.
- Applied consistently across the **group-spanning row, column-header row, and body rows**. The group row's leading blank ungrouped span is split so the name column gets its own sticky cell and the remaining ungrouped span shrinks by one column.

### 3. Working resize — `table-layout: fixed` + `<colgroup>`

- Table switches to `table-layout: fixed`, sized `width: max-content; min-width: 100%`. A `<colgroup>` declares one `<col>` per visible column at an explicit width plus a trailing **auto** `<col>` spacer that absorbs slack (replaces the current `width:100%` spacer `<th>`). Verified in-browser to keep both "fill when narrow" and "scroll when wide."
- Width resolution: `layout.columns[id].width ?? defaultColWidth(colDef)`. `defaultColWidth` switches on format/id — name 240, pills 130, money/number 110, date 120, state 90, default 140. Target sub-columns get a fixed 110 and stay non-resizable (as today).
- Cells truncate: `<td>` gains `overflow-hidden text-ellipsis` (already `whitespace-nowrap`); long district names ellipsize with a `title` tooltip.
- Live drag feedback: `GridHeaderCell` gains `onWidthPreview(next)` fired on pointer-move; `GridView` imperatively sets the matching `<col>`'s width through a ref keyed by column id (no per-move React re-render). On pointer-up, the existing `onWidthChange` persists to layout (500ms debounce). The dead `draggingWidth` state is removed; the 60–600 clamp stays.

## Files

- `src/features/views/components/grid/GridView.tsx` — SUB_COLS order, colgroup + table-layout, sticky cells, group-row split, col refs, `defaultColWidth` helper.
- `src/features/views/components/grid/GridHeaderCell.tsx` — add `onWidthPreview`, remove dead `draggingWidth`.
- `src/features/views/components/grid/__tests__/GridView.test.tsx` — column order, sticky styling, colgroup widths, resize commit.

## Testing

Vitest for structural assertions (sub-column order, sticky `left`/`position` on checkbox+name, colgroup `<col>` widths, resize preview→commit path). Then in-browser verification: resize grow **and** shrink with live feedback, horizontal scroll with name frozen, New-Biz-first ordering, and mobile scroll-safety per CLAUDE.md (no `overflow:hidden` on html/body; `pan-y` only on the list panel, never the map wrapper).

## Out of Scope

- Resizable target sub-columns (fixed width).
- Persisting widths for non-`SOURCE_COLUMNS` ids.
- Reordering columns by drag.
