# Card

Self-contained content unit — an entity the user can view, click, or act on.

See `_foundations.md` for shared styling foundations.

---

## When to Use

- Use when displaying a discrete piece of content (a record, metric, event, or summary)
- Don't use when content needs to block the page (use [Modal](modal.md) instead)
- Don't use when content slides in from the edge (use [Flyout](flyout.md) instead)

## Canonical Styling

```
bg-white rounded-lg shadow-sm border border-[#D4CFE2]
```

## Anatomy

Cards have a single content zone with optional header and expandable footer:

```tsx
<div className="bg-white rounded-lg shadow-sm border border-[#D4CFE2] p-4">
  {/* Card content */}
</div>
```

## Variants

### Standard

Full-size card with generous padding.

```tsx
<div className="bg-white rounded-lg shadow-sm border border-[#D4CFE2] p-4">
  <h3 className="text-sm font-medium text-[#403770]">Card Title</h3>
  <p className="text-sm text-[#6E6390] mt-1">Card content here.</p>
</div>
```

### Compact

Tighter padding for dense layouts and list items.

```tsx
<div className="bg-white rounded-lg shadow-sm border border-[#D4CFE2] p-3">
  {/* Compact card content */}
</div>
```

### Interactive

Adds hover effects for clickable cards.

```tsx
<div className="bg-white rounded-lg shadow-sm border border-[#D4CFE2] p-4 hover:border-[#C4E7E6] hover:shadow-lg transition-all cursor-pointer">
  {/* Clickable card content */}
</div>
```

### With Expandable Footer

Border-t trigger for revealing additional details. See [Accordion](accordion.md) for the expand/collapse pattern.

```tsx
<div className="bg-white rounded-lg shadow-sm border border-[#D4CFE2]">
  <div className="p-4">
    {/* Card content */}
  </div>
  <button
    onClick={toggleExpand}
    className="flex items-center gap-1.5 w-full px-3 py-2 border-t border-[#E2DEEC] text-xs font-medium text-[#8A80A8] hover:text-[#403770] transition-colors duration-100"
  >
    <svg
      className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
    {expanded ? 'Hide details' : 'View details'}
  </button>
  {expanded && (
    <div className="px-3 pb-3 border-t border-[#E2DEEC]">
      {/* Expanded content */}
    </div>
  )}
</div>
```

## States

| State | Visual |
|-------|--------|
| Default | Base styling as above |
| Hover (interactive) | `border-[#C4E7E6] shadow-lg` |
| Loading | Skeleton placeholder: `bg-[#E2DEEC]/60 animate-pulse rounded h-4` |
| Empty | Centered muted text: `text-sm text-[#A69DC0]` |

## Keyboard

- Interactive cards: `Enter` / `Space` activates (when rendered as `<button>` or with `role="button"`)
- Expandable footer: `Enter` / `Space` toggles detail expansion

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| SignalCard | `src/features/map/components/panels/district/signals/SignalCard.tsx` | Uses `border-gray-100` — should be `border-[#D4CFE2]` |
| CalendarEventCard | `src/features/calendar/components/CalendarEventCard.tsx` | Compact variant with left accent border |
| DistrictCard | `src/features/map/components/right-panels/DistrictCard.tsx` | Card with tabs pattern |
