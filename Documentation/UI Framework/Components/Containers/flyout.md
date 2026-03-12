# Flyout

Slide-in panel from the edge for contextual detail. Larger than a popover, doesn't block like a modal.

See `_foundations.md` for shared styling foundations (backdrop, close button, dismiss behavior).

---

## When to Use

- Use for contextual detail views that are too large for a popover
- Use for forms or multi-step workflows that should stay in context
- Don't use when content should block the page (use [Modal](modal.md) instead)
- Don't use when content is a small menu or tooltip (use [Popover](popover.md) instead)
- Don't use when content is a persistent layout surface (use [Panel](panel.md) instead)

## Canonical Styling

Desktop (slides from right):

```
bg-white border-l border-[#E2DEEC]
```

With shadow: `box-shadow: -4px 0 15px rgba(0,0,0,0.08)`

Mobile (bottom drawer):

```
bg-white rounded-t-2xl shadow-lg max-h-[70vh]
```

## Anatomy

```tsx
{/* Optional backdrop */}
<div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

{/* Flyout panel */}
<div className="fixed top-0 right-0 bottom-0 z-50 w-[400px] bg-white border-l border-[#E2DEEC] shadow-[-4px_0_15px_rgba(0,0,0,0.08)] transition-all duration-200 ease-out">
  {/* Header */}
  <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2DEEC]">
    <h3 className="text-sm font-semibold text-[#403770]">Flyout Title</h3>
    {/* Compact close button — see _foundations.md */}
  </div>

  {/* Content */}
  <div className="p-4 overflow-y-auto h-full">
    {/* Flyout content */}
  </div>
</div>
```

## Key Rules

- Optional backdrop: `bg-black/20` (lighter than modal)
- Dismiss: Escape + click-outside + close button
- Close button: compact (`w-6 h-6`)
- Transition: `transition-all duration-200 ease-out` (uses `panel-v2-enter` animation)

## Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| Desktop | Slides from right edge with left border + shadow |
| Mobile (base) | Bottom drawer: `rounded-t-2xl shadow-lg max-h-[70vh]` |

## Keyboard

- `Escape` closes the flyout
- Click outside closes the flyout
- `Tab` navigates through flyout content

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| RightPanel (narrow mode) | `src/features/map/components/RightPanel.tsx` | Task form, contact detail, activity form — uses `border-gray-200/60` instead of `border-[#E2DEEC]` |
