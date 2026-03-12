# Accordion

Reveal/hide sections of content in place.

See `_foundations.md` for shared styling foundations.

---

## When to Use

- Use when sections of content can be shown/hidden to reduce visual noise
- Use for expandable card details, collapsible sections in panels
- Don't use for content that should always be visible (just lay it out)
- Don't use for switchable views where only one is active (use [Tabs](tabs.md) instead)

## Canonical Styling

Trigger:

```
flex items-center gap-1.5 [padding] text-xs font-medium text-[#8A80A8] hover:text-[#403770] transition-colors duration-100
```

Chevron: `w-3 h-3` pointing right (collapsed), rotated 90° (expanded) with `transition-transform duration-150`.

## Anatomy

```tsx
<button
  onClick={toggleSection}
  className="flex items-center gap-1.5 w-full px-4 py-3 text-xs font-medium text-[#8A80A8] hover:text-[#403770] transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg
    className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
  Section Title
</button>

{expanded && (
  <div className="border-t border-[#E2DEEC]">
    {/* Section content, inherits parent padding */}
  </div>
)}
```

## Variants

### Section Header Expand

Heading is the trigger. Chevron sits left of heading text.

```tsx
<button
  onClick={toggleSection}
  className="flex items-center gap-1.5 w-full py-2 text-sm font-semibold text-[#403770] hover:text-[#322a5a] transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg
    className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
  Section Title
</button>
```

### Card Section Expand

Footer trigger below card content. See [Card](card.md) with expandable footer variant.

```tsx
<button
  onClick={toggleExpand}
  className="flex items-center gap-1.5 w-full px-3 py-2 border-t border-[#E2DEEC] text-xs font-medium text-[#8A80A8] hover:text-[#403770] transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg
    className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
  {expanded ? 'Hide details' : 'View details'}
</button>
```

### Mutex Accordion

Only one section open at a time. Expanding a new section collapses the previous one. Manage with a single `openIndex` state.

## States

| State | Visual |
|-------|--------|
| Collapsed | Chevron points right, content hidden |
| Expanded | Chevron rotated 90°, content visible |
| Hover (trigger) | Label text shifts to `text-[#403770]` |
| Disabled | See `Navigation/_foundations.md` disabled state |

## Keyboard

- `Enter` / `Space` toggles expand/collapse
- `Tab` moves between collapsible triggers

## Related Patterns

- **Sidebar collapse** (icon-only mode): This is a navigation pattern — see `Navigation/side-nav.md`.

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| SignalCard expand | `src/features/map/components/panels/district/signals/SignalCard.tsx` | Card section expand pattern — uses `border-gray-100` dividers |
| FloatingPanel sections | `src/features/map/components/FloatingPanel.tsx` | Section header expand pattern |
