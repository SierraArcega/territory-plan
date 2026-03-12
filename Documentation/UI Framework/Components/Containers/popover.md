# Popover

Contextual floating content anchored to a trigger — dropdowns, menus, metric details.

See `_foundations.md` for shared styling foundations (dismiss behavior).

---

## When to Use

- Use for small, contextual content anchored to a trigger element
- Use for dropdown menus, sort controls, metric details
- Don't use when content is large or multi-step (use [Flyout](flyout.md) instead)
- Don't use when content should block the page (use [Modal](modal.md) instead)

## Canonical Styling

```
bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60
```

## Anatomy

```tsx
<div className="absolute bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 py-1 z-30">
  {/* Popover content */}
</div>
```

## Variants

### Menu Popover

List of clickable items:

```tsx
<div className="absolute bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 py-1 z-30">
  <button className="w-full px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5] text-left transition-colors">
    Edit
  </button>
  <button className="w-full px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5] text-left transition-colors">
    Duplicate
  </button>
  <div className="border-t border-[#E2DEEC] my-1" />
  <button className="w-full px-3 py-2 text-sm text-[#F37167] hover:bg-[#fef1f0] text-left transition-colors">
    Delete
  </button>
</div>
```

### Metric Popover

Small data display anchored to a chart or metric element:

```tsx
<div className="absolute bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 p-3 z-30">
  <h4 className="text-xs font-medium text-[#8A80A8] mb-1">Metric Label</h4>
  <p className="text-sm font-semibold text-[#403770]">42%</p>
</div>
```

## Menu Item States

| State | Classes |
|-------|---------|
| Default | `px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5]` |
| Selected | `bg-[#EFEDF5] text-[#403770] font-medium` |
| Destructive | `text-[#F37167] hover:bg-[#fef1f0]` |

## Keyboard

- `Escape` closes the popover
- Click outside closes the popover
- Arrow keys navigate menu items
- `Enter` / `Space` selects an item

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| DonutMetricPopover | `src/features/goals/components/DonutMetricPopover.tsx` | `rounded-lg border-gray-100` — should be `rounded-xl border-[#D4CFE2]/60` |
| BulkActionBar popovers | `src/features/map/components/explore/BulkActionBar.tsx` | `rounded-lg border-gray-200` — should be `rounded-xl border-[#D4CFE2]/60` |
| Sort dropdown (tables) | Various table components | `rounded-xl border-gray-200` — correct radius, wrong border color |
