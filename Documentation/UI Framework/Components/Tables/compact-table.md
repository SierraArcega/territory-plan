# Compact/Inline Table

Small table embedded within a larger context — a card, panel, or expanded row.

See `_foundations.md` for shared wrapper, cell text sizing, and cell padding specs.

---

### When Embedded in a Card or Panel

- No outer card wrapper (already inside one)
- Smaller text: `text-xs` for data, `text-[10px] uppercase tracking-wider` for headers
- Tighter padding: `px-3 py-2` cells
- Row dividers: `border-b border-[#E2DEEC]`
- No hover highlight on rows
- No selection checkboxes
- No row actions (actions belong to parent context)

### Nested Sub-Table (Inside Expanded Row)

When used inside an expanding row's container:
- Inherits the `bg-[#F7F5FA]` background from the expanded container
- Header differentiates from parent table via smaller `text-[10px]` size
- No additional card wrapper or shadow
- Compact footer optional: same `text-[10px] text-[#A69DC0]` with count only

### Keyboard

No special keyboard interactions beyond standard tab-through of any links or buttons within cells.
