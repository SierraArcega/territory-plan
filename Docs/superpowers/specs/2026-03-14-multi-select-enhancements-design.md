# Multi-Select Enhancements Design Spec

**Date:** 2026-03-14
**Branch:** aston-lineup-tab (spec only; implementation branch TBD)
**Scope:** Rewrite the Multi-Select section of `Documentation/UI Framework/Components/Forms/select.md` and migrate `LayerBubble.tsx` state dropdown to match.

---

## Problem

The existing multi-select spec documents a basic dropdown-checkbox pattern with no search, no Select All, no keyboard cursor, and no guidance on `activeIndex` tracking. The LayerBubble state dropdown has already built a richer pattern in production — this spec formalises that pattern, adds Select All, and makes it the canonical standard going forward.

---

## Component Contract

```tsx
interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  id: string;
  label: string;
  options: MultiSelectOption[];
  selected: string[];            // array of selected values
  onChange: (values: string[]) => void;
  placeholder?: string;          // trigger placeholder when nothing selected
  countLabel?: string;           // unit used in "N {countLabel}" trigger text, e.g. "states"
  searchPlaceholder?: string;    // search input placeholder
  disabled?: boolean;
}
```

`countLabel` defaults to `"items"` if not provided. Trigger label rules: 0 selected → `placeholder`; 1 selected → option label; 2–3 selected → labels joined with comma; 4+ selected → `"{N} {countLabel}"` (e.g. `"12 states"` or `"5 items"`). Always show the label itself for 1 selected value — never `"1 states"`.

---

## Features

### 1. Search Input (sticky)

A text input pinned at the top of the open panel, auto-focused when the dropdown opens. Filters the option list in real time by substring match against `label`. First `Escape` clears the query and resets `activeIndex` to `-1`; second `Escape` (or first if query is already empty) closes the dropdown.

### 2. Select All Row (sticky)

A fixed row between the search input and the scrollable list. Rendered as a `<div>` (not a `<li>`) outside the scrollable `<ul>` so it can be sticky without ARIA role conflicts (see Accessibility section). Contains a tri-state checkbox and an adaptive label.

**Label:**
- No active search: `"Select all {N}"` where N is total option count
- Active search with results: `"Select {N} results"`
- Active search with zero results: row is **hidden** (no options to select)

**Tri-state logic:**

| State | Visual | Clicking does |
|-------|--------|---------------|
| None of the filtered options are selected | Unchecked | Check all filtered |
| Some (but not all) filtered options are selected | Indeterminate (–) | Check all filtered |
| All filtered options are selected | Checked (✓) | Uncheck all filtered |

"All filtered" means all options matching the current search query — not the full option list.

### 3. Persistent Cursor (`activeIndex`)

A single integer tracking which row is "active" — the last row the user interacted with. Updates on:
- `mousedown` on any option row or the Select All row
- `ArrowDown` / `ArrowUp` keystrokes

Hover does **not** update `activeIndex`. Hover is a separate CSS `:hover` state so the cursor does not jump when the mouse drifts across the list.

`activeIndex` mapping:
- `-1` → no row highlighted (initial state on open; also reset when search is cleared)
- `0` → Select All row
- `1…N` → option rows (matching filtered order)

When a keyboard move lands on a row outside the visible scroll area of the list zone, call `element.scrollIntoView({ block: "nearest" })` on that row's DOM element to keep it visible.

Both `↓` and `↑` from the initial open state (`activeIndex === -1`) move to `0` (Select All). This symmetry is intentional — the first keypress always activates the top of the list regardless of direction.

### 4. Keyboard Navigation

All keys are handled on the search input (which is always focused while the dropdown is open):

| Key | `activeIndex` before | Result |
|-----|---------------------|--------|
| `↓` | `-1` | Move to `0` (Select All) |
| `↓` | `0` | Move to `1` (first option) |
| `↓` | `1…N-1` | Increment by 1 |
| `↓` | `N` (last option) | Stay at `N` (clamp) |
| `↑` | `-1` | Move to `0` (Select All) — this is intentional; `↑` from an unselected state activates the top row rather than doing nothing |
| `↑` | `0` | Stay at `0` (clamp) |
| `↑` | `1` | Move to `0` (Select All) |
| `↑` | `2…N` | Decrement by 1 |
| `Enter` | `0` | Apply Select All tri-state logic |
| `Enter` | `1…N` | Toggle the option at that index |
| `Enter` | `-1` | No-op |
| `Escape` | search has text | Clear search query, reset `activeIndex` to `-1` |
| `Escape` | search empty | Close the dropdown |
| `Tab` | any | Close the dropdown, move browser focus to next field |

### 5. Trigger Label Adaptation

| Selection state | Trigger text |
|----------------|-------------|
| None selected | `placeholder` prop (e.g., `"All States"`) |
| 1 selected | The selected option's `label` |
| 2–3 selected | Labels joined with comma: `"CA, TX, NY"` |
| 4+ selected | `"{N} {countLabel}"` (e.g., `"12 states"`) |

### 6. Removable Chips

Selected values render as removable chips below the trigger button. Each chip shows the option `label` and an × button. Clicking × removes that value from `selected` via `onChange`. Chips are rendered from the `options` array to get the label from the value. Class strings are inherited from the existing spec:

```
inline-flex items-center gap-1 px-2 py-0.5 bg-[#F7F5FA] rounded-full text-xs text-[#403770]
```

Chip remove button: `text-[#A69DC0] hover:text-[#403770] transition-colors`

Chips render in the same order as `selected` (insertion order). `onChange` is always called with the complete new array, never a delta.

If a value in `selected` has no matching entry in `options` (stale or async-loaded data), render the raw value string as the chip label and still allow removal via the × button. Do not silently skip it — a visible chip ensures the user knows something is selected and can clear it.

---

## Panel Structure

```
┌─────────────────────────────────┐
│  [trigger button]               │  always visible, outside dropdown
├─────────────────────────────────┤
│  🔍 Search…          [sticky]   │  auto-focused on open
│  ─────────────────────────────  │
│  ▣  Select all 50 states        │  sticky <div>, tri-state; hidden when 0 results
│  ─────────────────────────────  │
│  □  Alabama              AL     │  scrollable <ul>
│  ✓  Alaska               AK     │  cursor row = bg-[#EDE9F7]
│  ✓  Arizona              AZ     │  checked = plum checkbox
│  □  Arkansas             AR     │
│  …                              │
└─────────────────────────────────┘
```

The search input and Select All row are rendered **outside** the `<ul role="listbox">` so they can be position-sticky without invalidating the listbox's child structure.

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
No focus ring — this input is always focused when the dropdown is open; a persistent ring would be noisy.

### Select All row (sticky zone, below search)
```
flex items-center gap-2 px-3 py-2 text-sm font-medium
text-[#403770] border-b border-[#E2DEEC] bg-[#FDFCFF]
hover:bg-[#F7F5FA] cursor-pointer select-none
```
Hidden (`display: none`) when the search query returns zero results.

**Tri-state checkbox — Unchecked:**
```
w-4 h-4 rounded border border-[#C2BBD4] bg-white flex-shrink-0
```

**Tri-state checkbox — Indeterminate** (render a `—` dash SVG icon inside):
```
w-4 h-4 rounded border border-[#403770] bg-[#403770]
flex items-center justify-center flex-shrink-0
```
Dash icon: `<rect x="3" y="7.5" width="10" height="1" rx="0.5" fill="white"/>` (16×16 viewBox)

**Tri-state checkbox — Checked** (render a `✓` checkmark SVG icon inside):
```
w-4 h-4 rounded border border-[#403770] bg-[#403770]
flex items-center justify-center flex-shrink-0
```
Checkmark icon: `<path d="M3 8L6.5 11.5L13 5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` (16×16 viewBox)

Both indeterminate and checked share the same container classes — they differ only by their inner SVG icon.

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
Apply cursor and default row classes as a **mutually exclusive conditional** — one complete string or the other, never both. Do not rely on Tailwind's last-write-wins behavior to resolve the conflict.

### Option checkbox
```
w-4 h-4 rounded border border-[#C2BBD4] text-[#403770] flex-shrink-0
```
Use `tabIndex={-1}` and `aria-hidden="true"` — keyboard interaction is managed by the search input. Omit `focus:ring` since these checkboxes can never receive focus.

### Disabled state (trigger button)

When `disabled={true}`, the trigger button uses the standard disabled class string and the dropdown cannot be opened:
```
opacity-50 cursor-not-allowed pointer-events-none
```
Chips are hidden when disabled. The dropdown panel never renders.

### Empty state (no search results)
```
px-3 py-2 text-sm text-[#A69DC0] italic
```

---

## Accessibility

The Select All row is rendered as a `<div>` **outside** the `<ul role="listbox">`. This avoids placing a non-option element inside the listbox, which would be invalid ARIA. The tradeoff is that screen readers won't announce it as part of the listbox — it is announced separately as a button.

- Trigger button: `aria-haspopup="listbox"`, `aria-expanded={isOpen}`
- Dropdown panel wrapper: no role — it is just a visual container
- Search input: `aria-label="Search options"`, `aria-controls="{id}-listbox"`
- Select All `<div>`: `id="{id}-select-all"`, `role="checkbox"`, `aria-checked="true" | "false" | "mixed"` (tri-state; `"mixed"` = indeterminate), `tabIndex={-1}` (no tab stop), `aria-label` matches the visible label exactly — `"Select all {N}"` (no search) or `"Select {N} results"` (active search). The inner visual checkbox SVG is `aria-hidden="true"` — the `role="checkbox"` on the wrapper fully communicates selection state to screen readers. Using `role="checkbox"` on the wrapper avoids the ARIA ownership conflict that would arise from placing `role="checkbox"` inside `role="button"`.
- Search input: `aria-activedescendant` set to the `id` of the currently active row — `"{id}-option-{value}"` for option rows, `"{id}-select-all"` for the Select All row; omitted (attribute removed) when `activeIndex` is `-1`. This is required so screen readers announce the active row while focus stays in the search input.
- Option list `<ul>`: `role="listbox"`, `aria-multiselectable="true"`, `id="{id}-listbox"`, `aria-label={label}`
- Each option `<li>`: `role="option"`, `aria-selected={isSelected}`, `id="{id}-option-{value}"`
- Chip remove buttons: `aria-label="Remove {label}"`
- Checkboxes inside option rows: `tabIndex={-1}`, `aria-hidden="true"` (the `role="option"` + `aria-selected` on the `<li>` already communicates selection state to screen readers)

---

## Do / Don't Updates

**DO** always include a search input for lists with more than ~10 options — Select All without search forces users to scroll through the full list to understand what they're selecting.

**DO** make Select All search-aware — when a search query is active, "Select all" should select only the visible filtered results, not the entire dataset.

**DO** hide the Select All row when the search returns zero results — "Select 0 results" is confusing and actionless.

**DON'T** let hover update `activeIndex` — hover and keyboard cursor are independent states. Conflating them causes the cursor to jump unexpectedly when the mouse drifts.

**DON'T** put a focus ring on the search input inside the dropdown — it is always focused while the panel is open; a persistent ring is noisy and adds no usability value.

**DON'T** place `aria-checked="mixed"` on a `role="option"` element — use it on the `role="checkbox"` element inside the Select All row instead.

---

## Codebase Examples

| Component | File | Notes |
|-----------|------|-------|
| LayerBubble (state filter) | `src/features/map/components/LayerBubble.tsx` | Production implementation; will be migrated to align with this spec |

---

## Files Changed

| File | Change |
|------|--------|
| `Documentation/UI Framework/Components/Forms/select.md` | Replace Multi-Select section with updated spec and a new complete TSX example authored from scratch (use `LayerBubble.tsx` state dropdown as reference implementation where helpful) |
| `src/features/map/components/LayerBubble.tsx` | Migrate state dropdown to spec: (1) add sticky Select All row with tri-state logic (currently absent); (2) align Tailwind classes to spec tokens; (3) rename `stateHighlight` state variable to `activeIndex`, change its **initial value and all search-change resets from `0` to `-1`**, and extend it to also update on `mousedown` — currently `stateHighlight` only updates on keyboard arrow keys; (4) verify trigger label logic matches Section 5 thresholds (1 / 2–3 / 4+) |
