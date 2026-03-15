# Multi-Select Enhancements Design Spec

**Date:** 2026-03-14
**Branch:** aston-lineup-tab (spec only; implementation branch TBD)
**Scope:** Rewrite the Multi-Select section of `Documentation/UI Framework/Components/Forms/select.md` and migrate `LayerBubble.tsx` state dropdown to match.

---

## Problem

The existing multi-select spec documents a basic dropdown-checkbox pattern with no search, no Select All, no keyboard cursor, and no guidance on `activeIndex` tracking. The LayerBubble state dropdown has already built a richer pattern in production — this spec formalises that pattern, adds Select All, and makes it the canonical standard going forward.

---

## Features

### 1. Search Input (sticky)

A text input pinned at the top of the open panel, auto-focused when the dropdown opens. Filters the option list in real time by substring match. First `Escape` clears the query; second `Escape` closes the dropdown.

### 2. Select All Row (sticky)

A fixed row between the search input and the scrollable list. Contains a tri-state checkbox and the label "Select all N" (or "Select N results" when search is active).

**Tri-state logic:**

| State | Visual | Clicking does |
|-------|--------|---------------|
| None of the filtered options are selected | Unchecked | Check all filtered |
| Some (but not all) filtered options are selected | Indeterminate (dash) | Check all filtered |
| All filtered options are selected | Checked | Uncheck all filtered |

When search is active, "all" means all results matching the query — not the full option list.

### 3. Persistent Cursor (`activeIndex`)

A single integer tracking which row is "active" — the last row the user interacted with. Updates on:
- `mousedown` on any option row or the Select All row
- `ArrowDown` / `ArrowUp` keystrokes

Hover does **not** update `activeIndex`. Hover is a separate CSS `:hover` state so the cursor does not jump when the mouse drifts across the list.

`activeIndex` mapping:
- `-1` → no row highlighted (initial state on open)
- `0` → Select All row
- `1…N` → option rows (matching filtered order)

### 4. Keyboard Navigation

All keys are handled on the search input (which is always focused while the dropdown is open):

| Key | Action |
|-----|--------|
| `↓` | Move `activeIndex` to next row (clamps at last option) |
| `↑` | Move `activeIndex` to previous row (clamps at Select All row, index 0) |
| `Enter` | Toggle the row at `activeIndex`. If index is 0, apply Select All logic. If index is -1, no-op. |
| `Escape` (search has text) | Clear search query, reset `activeIndex` to -1 |
| `Escape` (search empty) | Close the dropdown |
| `Tab` | Close the dropdown, move browser focus to next field |

### 5. Trigger Label Adaptation

| Selection state | Trigger text |
|----------------|-------------|
| None selected | Placeholder (e.g., "All States") |
| 1–3 selected | Values joined: "CA, TX, NY" |
| 4+ selected | Count: "12 states" |

### 6. Removable Chips (unchanged from existing spec)

Selected values render as removable chips below the trigger. Each chip has an × button that removes that value from the selection.

---

## Panel Structure

```
┌─────────────────────────────────┐
│  [trigger button]               │  always visible
├─────────────────────────────────┤
│  🔍 Search…          [sticky]   │  auto-focused on open
├─────────────────────────────────┤
│  ▣  Select all 50 states        │  sticky, tri-state checkbox
├─────────────────────────────────┤
│  □  Alabama              AL     │  scrollable
│  ✓  Alaska               AK     │  cursor row = bg-[#EDE9F7]
│  ✓  Arizona              AZ     │  checked = plum checkbox
│  □  Arkansas             AR     │
│  …                              │
└─────────────────────────────────┘
```

---

## Visual Spec

### Dropdown panel
```
absolute z-10 mt-1 w-full bg-white rounded-xl shadow-lg
border border-[#D4CFE2]/60 overflow-hidden
```
No `overflow-y-auto` on the panel itself — only the list zone scrolls.

### Search input (sticky zone)
```
w-full px-3 py-2 text-sm border-b border-[#E2DEEC]
bg-white text-[#403770] placeholder:text-[#A69DC0]
focus:outline-none
```
No focus ring — this input is always focused when the dropdown is open.

### Select All row (sticky zone, below search)
```
flex items-center gap-2 px-3 py-2 text-sm font-medium
text-[#403770] border-b border-[#E2DEEC] bg-[#FDFCFF]
cursor-pointer select-none
```

**Tri-state checkbox variants:**

Unchecked:
```
w-4 h-4 rounded border border-[#C2BBD4] bg-white
```

Indeterminate (dash icon inside):
```
w-4 h-4 rounded border border-[#403770] bg-[#403770]
flex items-center justify-center
```

Checked (checkmark icon inside):
```
w-4 h-4 rounded border border-[#403770] bg-[#403770]
flex items-center justify-center
```

### Scrollable list zone
```
max-h-60 overflow-y-auto
```

### Option row — default
```
flex items-center gap-2 px-3 py-2 text-sm text-[#403770]
hover:bg-[#F7F5FA] cursor-pointer select-none
```

### Option row — cursor (activeIndex matches this row)
```
flex items-center gap-2 px-3 py-2 text-sm text-[#403770]
bg-[#EDE9F7] cursor-pointer select-none
```
Cursor wins over hover when both apply.

### Option checkbox
```
w-4 h-4 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]
```
Use `tabIndex={-1}` — keyboard interaction is managed by the search input, not the checkboxes.

### Empty state (no search results)
```
px-3 py-2 text-sm text-[#A69DC0] italic
```

---

## Accessibility

- Trigger button: `aria-haspopup="listbox"`, `aria-expanded={isOpen}`
- Dropdown `<ul>`: `role="listbox"`, `aria-multiselectable="true"`, `aria-label={label}`
- Each option `<li>`: `role="option"`, `aria-selected={isSelected}`, stable `id`
- Search input: `aria-label="Search options"` or `aria-controls` pointing to listbox id
- Select All row: `role="option"`, `aria-selected` reflects tri-state (use `aria-checked` on the inner checkbox), `aria-label="Select all"` or "Select N results"
- Chip remove buttons: `aria-label="Remove [value]"`
- Checkboxes inside rows: `tabIndex={-1}` — navigation is handled by the search input

---

## Do / Don't Updates

**DO** always include a search input for lists with more than ~10 options — Select All without search forces users to scroll to understand what's being selected.

**DO** make Select All search-aware — "Select all" when a filter is active should select only visible results, not the entire dataset.

**DON'T** let hover update `activeIndex` — hover and keyboard cursor are independent states. Conflating them causes the cursor to jump unexpectedly when the mouse drifts.

**DON'T** put focus rings on the search input inside the dropdown — it is always focused while the panel is open and a persistent ring is noisy.

---

## Codebase Examples

| Component | File | Notes |
|-----------|------|-------|
| LayerBubble (state filter) | `src/features/map/components/LayerBubble.tsx` | Reference implementation; will be migrated to this spec |

---

## Files Changed

| File | Change |
|------|--------|
| `Documentation/UI Framework/Components/Forms/select.md` | Replace Multi-Select section with updated spec and TSX example |
| `src/features/map/components/LayerBubble.tsx` | Migrate state dropdown: add Select All row, align classes to spec tokens, verify mousedown sets `activeIndex` |
