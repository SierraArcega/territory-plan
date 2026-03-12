# Panel

Persistent navigation surface alongside main content. Part of the page layout — not an overlay.

See `_foundations.md` for shared styling foundations.

---

## When to Use

- Use when content needs to persist alongside the main view (navigation, detail views, entity lists)
- Don't use when content should block interaction (use [Modal](modal.md) instead)
- Don't use when content is temporary and contextual (use [Flyout](flyout.md) instead)

## Canonical Styling

Desktop (floating):
```
bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg
```

Mobile (bottom drawer):
```
bg-white/95 backdrop-blur-sm rounded-t-2xl shadow-lg max-h-[70vh]
```

## Anatomy

```tsx
{/* Desktop floating panel */}
<div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
  {/* Header */}
  <div className="flex items-center justify-between px-3 py-2 border-b border-[#E2DEEC]">
    <h3 className="text-xs font-medium uppercase tracking-wider text-[#A69DC0]">Panel Title</h3>
    {/* Compact close button — see _foundations.md */}
  </div>

  {/* Content */}
  <div className="p-3 overflow-y-auto">
    {/* Panel content */}
  </div>
</div>
```

## Key Rules

- No outer border on the floating panel shell — shadow + blur provide separation
- Embedded sub-panels (e.g., RightPanel) may use a directional border (`border-l border-[#E2DEEC]`) as a layout divider — this is a layout concern, not a container border
- Close button only — no auto-dismiss (Escape/click-outside)
- Auto-collapse on tablet via media query
- Widths are context-dependent

## Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| Desktop | Floating rounded panel with `rounded-2xl shadow-lg` |
| Tablet (`sm:` and below `xl:`) | Auto-collapses to hidden |
| Mobile (base) | Bottom drawer: `rounded-t-2xl shadow-lg max-h-[70vh]` |

Mobile drawer includes a backdrop: `absolute inset-0 z-10 bg-black/20`.

## Keyboard

- Close button: `Enter` / `Space` closes the panel
- `Tab` navigates through panel content

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| FloatingPanel | `src/features/map/components/FloatingPanel.tsx` | Uses `border-gray-200/60`, `text-gray-400` — should use plum-derived tokens |
| RightPanel | `src/features/map/components/RightPanel.tsx` | Uses `stroke="#9CA3AF"` on close button — should be `#A69DC0` |
| PlanDistrictPanel | `src/features/plans/components/PlanDistrictPanel.tsx` | Review needed |
