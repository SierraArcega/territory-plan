# Tooltips

Tooltips are contextual information overlays that surface details about map entities and UI controls on hover, without requiring navigation or a modal interaction.

See `_foundations.md` for transition timing (`tooltip-enter` / `tooltip-exit`).

---

## Map Tooltip (Rich)

Context-aware tooltip displayed on map entity hover. Renders adjacent to the cursor and shows entity name, metadata, and a category indicator.

**Container:**

```
absolute pointer-events-none z-20
bg-white/95 backdrop-blur-sm rounded-xl shadow-lg
px-3 py-2 max-w-[220px]
```

**z-index note:** Map tooltips use `z-20` rather than the general `z-30` tooltip tier because they must float above map chrome (`z-10`) but should not overlay panels or popovers — they are contextual to the map surface. General tooltips (e.g., on icon buttons outside the map) should use `z-30` per `tokens.md`. `rounded-xl` is intentional — tooltips are floating elements per `tokens.md`.

**Positioning:** Offset from cursor — `left: x + 12; top: y - 8; transform: translateY(-100%)`.

**Typography:**

| Role | Classes |
|------|---------|
| Entity name | `text-sm font-medium text-[#403770]` |
| Metadata | `text-xs text-[#8A80A8]` |
| Category label | `text-xs text-[#6E6390]` |

**Divider:** `border-t border-[#E2DEEC]`

**Category indicator:** Status dot (`w-2 h-2 rounded-full`) paired with a category label. Dot color comes from the vendor or category palette defined in `tokens.md`.

**Animation:** `tooltip-enter` on mount, `tooltip-exit` on unmount — both defined in `globals.css`.

### TSX Example

```tsx
interface MapTooltipProps {
  x: number;
  y: number;
  entityName: string;
  category: string;
  categoryColor: string;
  metadata: string;
  visible: boolean;
}

function MapTooltip({
  x,
  y,
  entityName,
  category,
  categoryColor,
  metadata,
  visible,
}: MapTooltipProps) {
  if (!visible) return null;

  return (
    <div
      className={`
        absolute pointer-events-none z-20
        bg-white/95 backdrop-blur-sm rounded-xl shadow-lg
        px-3 py-2 max-w-[220px]
        tooltip-enter
      `}
      style={{
        left: x + 12,
        top: y - 8,
        transform: "translateY(-100%)",
      }}
      role="tooltip"
    >
      {/* Category indicator */}
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: categoryColor }}
        />
        <span className="text-xs text-[#6E6390]">{category}</span>
      </div>

      {/* Entity name */}
      <p className="text-sm font-medium text-[#403770] leading-snug">
        {entityName}
      </p>

      {/* Divider */}
      <div className="border-t border-[#E2DEEC] my-1.5" />

      {/* Metadata */}
      <p className="text-xs text-[#8A80A8]">{metadata}</p>
    </div>
  );
}
```

---

## Simple Tooltip (Dark)

For icon-only buttons and abbreviated labels where a brief text label is sufficient. Uses the primary plum fill for strong contrast against light backgrounds.

**Container:** `bg-[#403770] rounded-lg px-3 py-1.5`

**Text:** `text-xs font-medium text-white`

**Positioning:** Centered below the trigger element.

**z-index:** Use `z-30` per `tokens.md` (general tooltip tier, outside the map surface).

### TSX Example

```tsx
interface SimpleTooltipProps {
  label: string;
  children: React.ReactNode;
}

function SimpleTooltip({ label, children }: SimpleTooltipProps) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <div aria-describedby="tooltip-label">{children}</div>

      {visible && (
        <div
          id="tooltip-label"
          role="tooltip"
          className={`
            absolute top-full left-1/2 -translate-x-1/2 mt-1.5
            z-30 pointer-events-none whitespace-nowrap
            bg-[#403770] rounded-lg px-3 py-1.5
            text-xs font-medium text-white
            tooltip-enter
          `}
        >
          {label}
        </div>
      )}
    </div>
  );
}
```

---

## Accessibility

Interactive tooltips should use `role="tooltip"` on the tooltip container. The trigger element should reference the tooltip via `aria-describedby` pointing to the tooltip's `id`. This ensures screen readers announce the tooltip content when focus or hover activates it.

```tsx
{/* Trigger */}
<button aria-describedby="my-tooltip-id">
  <IconFilter />
</button>

{/* Tooltip */}
<div id="my-tooltip-id" role="tooltip" className="...">
  Filter accounts
</div>
```

For icon buttons, prefer `SimpleTooltip` over a native `title` attribute when the product design system is in use — `title` rendering is browser-controlled and cannot be styled. See `Navigation/buttons.md` for icon button patterns.

---

## Migration Notes

- **MapV2Tooltip** currently uses `z-[15]` — migrate to `z-20` per the z-index note above.
- Any tooltip using `bg-gray-800`, `bg-gray-900`, or similar Tailwind grays for the dark variant should be migrated to `bg-[#403770]`.
- Tooltips using `rounded-md` should use `rounded-lg` (simple) or `rounded-xl` (map/rich) per `tokens.md` floating element rules.

---

## Codebase Examples

| Component | Type | File |
|-----------|------|------|
| Map district hover | Rich | `src/features/map/components/MapV2Tooltip.tsx` |
| Icon button title | Simple | (native `title` attribute, see `Navigation/buttons.md`) |
