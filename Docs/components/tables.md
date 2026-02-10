# Table Component Guide

Standard styling for all CRM-style data tables in the territory planner. These conventions were established during the contacts table redesign (Feb 2026) and applied consistently across ContactsTable, DistrictsTable, and ActivitiesTable.

## Wrapper

Every table uses the same outer container:

```tsx
<div className="overflow-hidden border border-gray-200 rounded-lg bg-white shadow-sm">
  <div className="overflow-x-auto">
    <table className="min-w-full">
      ...
    </table>
  </div>
  {/* Footer */}
  <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
    ...
  </div>
</div>
```

Key classes:
- `border border-gray-200 rounded-lg` — subtle border with rounded corners
- `bg-white shadow-sm` — white background with light elevation
- `overflow-hidden` + `overflow-x-auto` — horizontal scroll on narrow screens

## Header (`<thead>`)

```tsx
<thead>
  <tr className="border-b border-gray-200 bg-gray-50/80">
    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
      Column Name
    </th>
    {/* Empty header for actions column */}
    <th className="w-20 px-3 py-3" />
  </tr>
</thead>
```

Rules:
- Background: `bg-gray-50/80` (semi-transparent, not solid)
- Bottom border: `border-b border-gray-200`
- Font: `text-[11px] font-semibold text-gray-500 uppercase tracking-wider`
- Padding: `px-4 py-3`
- Actions column header is empty (`w-20 px-3 py-3`, no text)
- Right-aligned numeric columns: add `text-right`

## Rows (`<tbody>`)

```tsx
<tbody>
  {items.map((item, idx) => {
    const isLast = idx === items.length - 1;
    return (
      <tr
        key={item.id}
        className={`
          group transition-colors duration-100 hover:bg-gray-50/70
          ${!isLast ? "border-b border-gray-100" : ""}
        `}
      >
        ...
      </tr>
    );
  })}
</tbody>
```

Rules:
- **No `divide-y`** — use conditional `border-b border-gray-100` on every row except the last
- `group` class on `<tr>` for hover-reveal actions
- Hover: `hover:bg-gray-50/70`
- Transition: `transition-colors duration-100`

### Cell text sizing

| Content type | Class |
|---|---|
| Primary name/title | `text-sm font-medium text-[#403770]` |
| Standard data | `text-[13px] text-gray-600` |
| Secondary/muted | `text-[13px] text-gray-400` or `text-[12px] text-gray-300` |
| Empty placeholder | `text-[13px] text-gray-300` with `&mdash;` |

### Cell padding

- Standard cells: `px-4 py-3`
- Compact cells (activities): `px-2 py-1` or `px-2 py-1.5`
- Actions cells: `px-3 py-3`

## Actions Column (hover-reveal icons)

Actions are icon-only buttons that appear on row hover:

```tsx
<td className="px-3 py-3">
  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
    {/* Edit */}
    <button
      onClick={handleEdit}
      className="p-1.5 text-gray-400 hover:text-[#403770] rounded-md hover:bg-gray-100 transition-colors"
      aria-label="Edit"
      title="Edit"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
    {/* Delete */}
    <button
      onClick={handleDelete}
      className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
      aria-label="Delete"
      title="Delete"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  </div>
</td>
```

Rules:
- Container: `opacity-0 group-hover:opacity-100 transition-opacity duration-150`
- Icon buttons: `p-1.5 text-gray-400 rounded-md hover:bg-gray-100 transition-colors`
- Icon size: `w-3.5 h-3.5`
- Edit hover: `hover:text-[#403770]`
- Delete hover: `hover:text-red-500 hover:bg-red-50`
- Always include `aria-label` and `title` for accessibility
- **No text labels** — icons only, with tooltips

## Footer

```tsx
<div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
  <span className="text-[12px] font-medium text-gray-400 tracking-wide">
    {count} {noun}{count !== 1 ? "s" : ""}
  </span>
  {/* Optional: summary stats on the right */}
  <div className="flex items-center gap-4">
    <span className="text-[12px] text-gray-400">
      Label: <span className="font-medium text-gray-500">{value}</span>
    </span>
  </div>
</div>
```

Rules:
- Background: `bg-gray-50/60`
- Border: `border-t border-gray-100`
- Text: `text-[12px] font-medium text-gray-400 tracking-wide`
- Layout: `flex items-center justify-between`
- Right side is optional (used for totals in DistrictsTable, selection count in ContactsTable)

## Inline Editing

Use the `InlineEditCell` component (`src/components/common/InlineEditCell.tsx`) for click-to-edit cells:

```tsx
import InlineEditCell from "@/components/common/InlineEditCell";

{/* Text field */}
<InlineEditCell
  type="text"
  value={item.name}
  onSave={async (value) => handleSave(item.id, "name", value)}
  className="text-sm font-medium text-[#403770]"
/>

{/* Select field */}
<InlineEditCell
  type="select"
  value={item.status}
  onSave={async (value) => handleSave(item.id, "status", value)}
  options={STATUS_OPTIONS}
  className="text-xs text-gray-600"
/>

{/* Date field */}
<InlineEditCell
  type="date"
  value={item.startDate}
  onSave={async (value) => handleSave(item.id, "startDate", value)}
  className="text-xs"
/>

{/* Currency with display formatting */}
<InlineEditCell
  type="text"
  value={item.amount != null ? String(item.amount) : null}
  onSave={async (value) => { /* parse and save */ }}
  placeholder="-"
  displayFormat={(v) => `$${parseFloat(v).toLocaleString()}`}
  className="text-[13px] text-gray-600 text-right"
/>
```

Supported types: `text`, `textarea`, `select`, `date`

Props:
- `value` — string or null
- `onSave` — async function, called on blur/enter
- `placeholder` — shown when value is null (default `"---"`)
- `className` — applied to the display wrapper
- `displayFormat` — optional `(value: string) => string` for custom display rendering
- `options` — required for `type="select"`, array of `{ value, label }`

Behavior:
- Click to enter edit mode, Escape to cancel
- Text/date: Enter to save, blur to save
- Select: auto-saves on change
- Shows a green flash on successful save

## Empty State

When a table has no rows, show a centered empty state:

```tsx
<div className="text-center py-12 bg-white rounded-lg border border-gray-200">
  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" ...>
    {/* Relevant icon */}
  </svg>
  <h3 className="text-lg font-medium text-gray-600 mb-2">No items yet</h3>
  <p className="text-sm text-gray-500 max-w-sm mx-auto">
    Helpful description of how to add items.
  </p>
</div>
```

## Confirmation Modals

All destructive actions use a consistent confirmation dialog:

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
  <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
    <h3 className="text-lg font-semibold text-[#403770] mb-2">Delete Item?</h3>
    <p className="text-gray-600 text-sm mb-6">
      Are you sure? This action cannot be undone.
    </p>
    <div className="flex justify-end gap-3">
      <button className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
        Cancel
      </button>
      <button className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50">
        Delete
      </button>
    </div>
  </div>
</div>
```

## Checkbox Selection (ContactsTable pattern)

If a table needs row selection with bulk actions:

- Header: `<th className="w-12 pl-4 pr-2 py-3">` with a select-all checkbox
- Row: `<td className="pl-4 pr-2 py-3">` with per-row checkbox
- Checkbox: `className="w-4 h-4 rounded border-gray-300 text-[#403770] focus:ring-[#403770]/30 cursor-pointer"`
- Selected row highlight: `bg-[#C4E7E6]/15 hover:bg-[#C4E7E6]/25`

## Brand Colors Reference

| Token | Value | Usage |
|---|---|---|
| Plum | `#403770` | Primary text, links, selected states |
| Coral | `#F37167` | Accents, primary badges |
| Steel blue | `#6EA3BE` | Links (email), secondary accents |
| Robin's egg | `#C4E7E6` | Selection highlights, light backgrounds |
| Sage | `#8AA891` | Active status badge |

## File Reference

| Component | File |
|---|---|
| ContactsTable | `src/components/plans/ContactsTable.tsx` |
| DistrictsTable | `src/components/plans/DistrictsTable.tsx` |
| ActivitiesTable | `src/components/plans/ActivitiesTable.tsx` |
| InlineEditCell | `src/components/common/InlineEditCell.tsx` |
