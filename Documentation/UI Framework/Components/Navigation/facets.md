# Facets

Filtering patterns from simple chips to advanced filter builders.

See `_foundations.md` for focus ring, transition timing, and keyboard conventions.

---

## Tier 1 — Filter Chips

Horizontal row of pill toggles. Uses the chip/toggle button variant from `buttons.md`.

- **Layout:** `gap-2`, horizontal row
- **Multiple active:** Yes — any combination of chips can be active simultaneously

```tsx
<div className="flex items-center gap-2">
  <button className="rounded-full bg-[#403770] text-white border-transparent px-3 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none transition-colors duration-100">
    Active
    <span className="text-[10px] font-bold bg-white/20 rounded-full px-1.5 ml-1">12</span>
  </button>
  <button className="rounded-full border border-[#D4CFE2] text-[#8A80A8] bg-white px-3 py-1 text-xs font-medium hover:bg-[#EFEDF5] focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none transition-colors duration-100">
    Inactive
  </button>
</div>
```

**Keyboard:** Arrow keys navigate chips, `Space` / `Enter` toggles.

## Tier 2 — Dropdown Filters

### Trigger Button

```
border border-[#D4CFE2] rounded-lg px-3 py-2 text-xs font-medium text-[#6E6390]
```

Includes a chevron icon (`w-3 h-3`) on the right.

### Dropdown Popover

```
bg-white rounded-xl shadow-lg border border-[#D4CFE2] py-1
```

### Select Items

```
px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5]
```

### Multi-Select Variant

Adds a checkbox before each label:

```
w-4 h-4 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/30
```

### Clear Button

```
text-xs text-[#403770] hover:bg-[#EFEDF5]
```

```tsx
<div className="relative">
  <button
    onClick={toggleDropdown}
    className="flex items-center gap-2 border border-[#D4CFE2] rounded-lg px-3 py-2 text-xs font-medium text-[#6E6390] hover:bg-[#EFEDF5] transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
  >
    Status
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {open && (
    <div className="absolute top-full mt-1 bg-white rounded-xl shadow-lg border border-[#D4CFE2] py-1 min-w-[160px] z-20">
      <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5]">
        <input type="checkbox" className="w-4 h-4 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/30" />
        Active
      </button>
      <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5]">
        <input type="checkbox" className="w-4 h-4 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/30" />
        Inactive
      </button>
    </div>
  )}
</div>
```

**Keyboard:** `Enter` / `Space` opens dropdown, arrow keys navigate, `Escape` closes.

## Tier 3 — Advanced Filter Builder

3-step picker: Column > Operator > Value. Based on the ExploreFilters pattern.

### Picker Popover

```
w-56 bg-white rounded-lg border border-[#D4CFE2] shadow-lg
```

### Step Group Labels

```
text-[10px] font-semibold uppercase tracking-wider text-[#A69DC0]
```

### Step Items

```
px-3 py-1.5 text-[13px] text-[#6E6390] hover:bg-[#C4E7E6]/15 hover:text-[#403770]
```

### Back Button

Chevron-left icon:

```
w-3.5 h-3.5 text-[#A69DC0] hover:text-[#403770]
```

### Apply Button

```
bg-[#403770] text-white rounded-lg text-xs font-medium
```

### Value Inputs by Type

| Type | Control |
|---|---|
| Text | Standard text input |
| Enum | Checkbox list (multi-select) |
| Number | Min/max range inputs |
| Date | Date picker |
| Tags | Tag input with autocomplete |
| Relation | Entity search dropdown |
| Boolean | Toggle switch |

```tsx
<div className="w-56 bg-white rounded-lg border border-[#D4CFE2] shadow-lg">
  {/* Step header with back button */}
  <div className="flex items-center gap-2 px-3 py-2 border-b border-[#E2DEEC]">
    <button className="text-[#A69DC0] hover:text-[#403770] transition-colors">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A69DC0]">
      Select Column
    </span>
  </div>

  {/* Step items */}
  <div className="py-1">
    <button className="w-full px-3 py-1.5 text-[13px] text-[#6E6390] hover:bg-[#C4E7E6]/15 hover:text-[#403770] text-left transition-colors">
      District Name
    </button>
    <button className="w-full px-3 py-1.5 text-[13px] text-[#6E6390] hover:bg-[#C4E7E6]/15 hover:text-[#403770] text-left transition-colors">
      Status
    </button>
  </div>

  {/* Apply button */}
  <div className="px-3 py-2 border-t border-[#E2DEEC]">
    <button className="w-full bg-[#403770] text-white rounded-lg text-xs font-medium px-3 py-1.5 hover:bg-[#322a5a] transition-colors">
      Apply Filter
    </button>
  </div>
</div>
```

## Active Filter Display

Applied filters shown as removable pills.

### Filter Pill

```
px-2.5 py-1 text-xs font-medium bg-[#C4E7E6]/30 text-[#403770] rounded-full border border-[#C4E7E6]/50
```

### Remove Button

X icon within the pill:

```
text-[#403770]/40 hover:text-[#403770]
```

Icon size: `w-3 h-3`

### Clear All

```
text-xs font-medium text-[#A69DC0] hover:text-[#F37167]
```

```tsx
<div className="flex items-center gap-2 flex-wrap">
  <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#C4E7E6]/30 text-[#403770] rounded-full border border-[#C4E7E6]/50">
    Status: Active
    <button className="text-[#403770]/40 hover:text-[#403770] transition-colors">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </span>

  <button className="text-xs font-medium text-[#A69DC0] hover:text-[#F37167] transition-colors">
    Clear all
  </button>
</div>
```

## Saved Views

Save/load/delete filter+sort+group configurations. Stored in `localStorage`.

## Keyboard

| Tier | Interactions |
|---|---|
| Chips | Arrow keys navigate, `Space`/`Enter` toggles |
| Dropdown | `Enter`/`Space` opens, arrows navigate, `Escape` closes |
| Advanced builder | `Enter` selects step item, `Escape` goes back or closes |
| Filter pills | `Tab` between pills, `Enter`/`Space` removes |

## Codebase Examples

| Component | File |
|---|---|
| FilterBar (global) | `src/features/shared/components/filters/FilterBar.tsx` |
| PlanTabs FilterBar | `src/features/plans/components/PlanTabs.tsx` |
| ExploreFilters | `src/features/map/components/explore/ExploreFilters.tsx` |
