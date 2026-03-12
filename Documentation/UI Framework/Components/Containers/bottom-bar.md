# Bottom Bar

Floating action bar at the viewport bottom for bulk operations on selected items.

See `_foundations.md` for shared styling foundations.

---

## When to Use

- Use when the user has selected one or more items and needs bulk action controls
- Use for persistent actions that should stay visible while scrolling
- Don't use for navigation (use a regular nav bar)
- Don't use when actions apply to a single item (use inline actions or a [Popover](popover.md))

## Canonical Styling

```
bg-[#403770] rounded-xl shadow-lg shadow-[#403770]/20
```

Positioning:

```
fixed bottom-4 left-1/2 -translate-x-1/2 z-30
```

## Anatomy

```tsx
<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-[#403770] rounded-xl shadow-lg shadow-[#403770]/20 px-4 py-2.5 flex items-center gap-3 animate-slide-up">
  {/* Selection count */}
  <span className="text-sm font-medium text-white">
    {count} selected
  </span>

  {/* Divider */}
  <div className="w-px h-5 bg-white/20" />

  {/* Action buttons */}
  <button className="px-3 py-1.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
    Assign
  </button>

  {/* Dismiss */}
  <button
    onClick={clearSelection}
    aria-label="Clear selection"
    className="flex items-center justify-center w-6 h-6 rounded-lg hover:bg-white/20 transition-colors"
  >
    <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
</div>
```

## Action Button States

| State | Classes |
|-------|---------|
| Default | `bg-white/10 hover:bg-white/20 rounded-lg` |
| Active (has queued value) | `bg-white/20 ring-1 ring-inset ring-white/25` |

## Dividers

Vertical dividers between action groups:

```
w-px h-5 bg-white/20
```

## Animation

Slides up on first selection: `animate-slide-up` (defined in `globals.css`).

## Keyboard

- `Tab` navigates between action buttons
- `Enter` / `Space` activates an action
- Dismiss button clears selection and hides the bar

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| BulkActionBar | `src/features/map/components/explore/BulkActionBar.tsx` | Primary implementation — conformant styling |
