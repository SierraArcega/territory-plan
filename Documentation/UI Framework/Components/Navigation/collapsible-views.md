# Collapsible Views

Expand/collapse patterns for sections, cards, and sidebar navigation.

See `_foundations.md` for transition timing and keyboard conventions.

---

## Trigger Anatomy

All collapsible triggers share a common layout:

- **Chevron:** `w-3 h-3` pointing right (collapsed) or down (expanded)
- **Rotation:** `transition-transform duration-150`
- **Label:** `text-xs font-medium text-[#8A80A8] hover:text-[#403770]`
- **Layout:** `flex items-center gap-1.5`

## Patterns

### Card Section Expand

SignalCard-style pattern. Trigger sits as a footer row below card content.

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

{expanded && (
  <div className="px-3 pb-3 border-t border-[#E2DEEC]">
    {/* Expanded content */}
  </div>
)}
```

### Section Header Expand (Accordion)

Trigger is the section heading itself. Chevron sits left of heading text.

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

{expanded && (
  <div className="border-t border-[#E2DEEC]">
    {/* Section content, inherits parent padding */}
  </div>
)}
```

### Accordion Variant

Only one section open at a time within a group. Expanding a new section collapses the previous one.

### Sidebar Collapse

Full sidebar collapse to icon-only mode.

| State | Width | Content |
|---|---|---|
| Expanded | `w-[140px]` | Icon + label |
| Collapsed | `w-14` | Icon only |

- **Transition:** `transition-all duration-200 ease-in-out`
- **Toggle:** Chevron button at sidebar bottom: `text-[#A69DC0] hover:text-[#403770]`
- **Collapsed tooltip:** `bg-[#403770] text-white text-sm rounded-lg shadow-lg px-2 py-1 z-50`

```tsx
{/* Collapse toggle button */}
<button
  onClick={toggleCollapse}
  className="flex items-center justify-center w-full py-3 border-t border-[#E2DEEC] text-[#A69DC0] hover:text-[#403770] transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg
    className={`w-4 h-4 transition-transform duration-150 ${collapsed ? 'rotate-180' : ''}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7" />
  </svg>
</button>
```

## States

| State | Visual |
|---|---|
| Collapsed | Chevron points right, content hidden |
| Expanded | Chevron rotated down, content visible |
| Hover (trigger) | Label text shifts to `text-[#403770]` |
| Disabled | See `_foundations.md` disabled state |

## Keyboard

- `Enter` / `Space` toggles expand/collapse
- `Tab` moves between collapsible triggers

## Codebase Examples

| Component | File |
|---|---|
| SignalCard | `src/features/map/components/panels/district/signals/SignalCard.tsx` |
| Sidebar | `src/features/shared/components/navigation/Sidebar.tsx` |
| FloatingPanel | `src/features/map/components/FloatingPanel.tsx` |
