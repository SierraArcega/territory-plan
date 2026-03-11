# Detail Table

Display structured attributes of a single entity. Key-value pairs.

See `_foundations.md` for shared wrapper, cell text sizing, and cell padding specs.

---

### Layout

Two-column key-value pairs within a card wrapper.

| Element | Classes |
|---|---|
| Card | `bg-white border border-[#D4CFE2] rounded-lg shadow-sm` |
| Section title (optional) | `text-sm font-semibold text-[#403770] mb-3` — sits above the card |
| Label column (left) | `w-[140px]` or `w-36`, `text-xs font-medium text-[#8A80A8] uppercase tracking-wider` |
| Value column (right) | `text-sm text-[#6E6390]`, takes remaining width |
| Row dividers | `border-b border-[#E2DEEC]` (last row omits border) |
| Row padding | `py-3 px-4` |

### Editable Variant

Value side uses InlineEditCell component. Same click-to-edit, green flash on save patterns as Data Table.

### Read-Only Variant

No hover effects, no edit affordance. Clean label-value pairs.

No header row, no footer, no toolbar, no pagination, no selection.
