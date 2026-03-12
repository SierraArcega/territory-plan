# Container Foundations

Shared patterns for all container components. Every container guide in this folder
references these foundations. If a pattern is defined here, the component guide should
not redefine it — just reference this file.

All values come from `tokens.md`. No Tailwind grays (`gray-*`) in container components.

---

## Which Container?

Use this decision tree to pick the right container type:

1. **Does it need to block interaction with the rest of the page?**
   → Yes = [Modal](modal.md)

2. **Is it contextual to a specific trigger element?**
   → Small/single-purpose = [Popover](popover.md)
   → Large/multi-step = [Flyout](flyout.md)

3. **Does it persist as part of the page layout?**
   → Navigable, multi-section = [Panel](panel.md)
   → Static content block = [Card](card.md)

4. **Does it organize content into switchable views?**
   → [Tabs](tabs.md)

5. **Does it reveal/hide sections of content in place?**
   → [Accordion](accordion.md)

6. **Does it float at the viewport edge for bulk/persistent actions?**
   → [Bottom Bar](bottom-bar.md)

---

## Border Tiers

| Tier | Hex | Usage |
|------|-----|-------|
| Subtle | `#E2DEEC` | Inner dividers within containers, row separators, section borders |
| Default | `#D4CFE2` | Card edges, panel section dividers, outer container borders |
| Strong | `#C2BBD4` | Inputs inside containers, form field borders |
| Brand | `#403770` | Selected/active state borders |

---

## Radius Tiers

| Class | Pixel | Container types |
|-------|-------|-----------------|
| `rounded-lg` | 8px | Cards, panels, buttons, inputs |
| `rounded-xl` | 12px | Popovers, dropdowns |
| `rounded-2xl` | 16px | Modals, dialogs, floating panel shell |

Do not use `rounded-sm` or `rounded-md` in new code.

---

## Shadow Scale

| Class | Elevation | Container types |
|-------|-----------|-----------------|
| `shadow-sm` | Low | Cards, panels (inline) |
| `shadow-lg` | Medium | Popovers, flyouts, floating panels |
| `shadow-xl` | High | Modals, dialogs |

No `shadow-md` or `shadow-2xl` in new code.

---

## Close Button

The close icon is the Lucide `X` icon — see `iconography.md` for the canonical icon map. Import: `import { X } from 'lucide-react';`

Two sizes, one pattern:

| Size | Classes | Used by |
|------|---------|---------|
| Compact | `w-6 h-6 rounded-lg` | Popovers, right panels, flyouts |
| Standard | `w-8 h-8 rounded-lg` | Modals, dialogs |

Shared styling: `flex items-center justify-center hover:bg-[#EFEDF5] transition-colors`

Icon color: `text-[#A69DC0]` default, `hover:text-[#403770]`. SVG uses `stroke="currentColor"` to inherit. Always `rounded-lg` — never `rounded-full`.

```tsx
{/* Standard close button (modal/dialog) */}
<button
  onClick={onClose}
  aria-label="Close"
  className="flex items-center justify-center w-8 h-8 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
</button>

{/* Compact close button (popover/panel/flyout) */}
<button
  onClick={onClose}
  aria-label="Close"
  className="flex items-center justify-center w-6 h-6 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
</button>
```

**Migration note:** `PlanFormModal` uses `rounded-full` close button, `RightPanel` uses `stroke="#9CA3AF"` (Tailwind gray). Both should migrate to this pattern.

---

## Backdrop

| Context | Classes |
|---------|---------|
| Modal | `fixed inset-0 z-40 bg-black/40` |
| Flyout (optional) | `fixed inset-0 z-40 bg-black/20` |
| Mobile drawer | `absolute inset-0 z-10 bg-black/20` |

All backdrops are click-to-dismiss.

---

## Dismiss Behavior

| Container | Escape | Click-outside | Close button |
|-----------|--------|---------------|--------------|
| Modal | Yes | Yes (backdrop) | Yes |
| Popover | Yes | Yes | No |
| Flyout | Yes | Yes | Yes |
| Panel | No | No | Yes |
| Bottom Bar | No | No | Yes (dismiss X) |

Canonical dismiss pattern:

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  const handleClickOutside = (e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      onClose();
    }
  };
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("mousedown", handleClickOutside);
  return () => {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [onClose]);
```

---

## Padding Rhythm

| Container | Padding | Notes |
|-----------|---------|-------|
| Card (standard) | `p-4` | 16px all sides |
| Card (compact) | `p-3` | 12px all sides |
| Modal header/footer | `px-6 py-4` | Generous horizontal |
| Modal body | `p-6` | 24px content area |
| Popover | `px-3 py-2` | Tight contextual |
| Panel content | `p-3` (tight) or `p-4` (standard) | Context-dependent |
| Accordion trigger | `px-4 py-3` | Consistent with table cells |
| Accordion content | Inherits parent padding | No extra wrapper padding |

---

## Header Pattern

Canonical layout for containers with headers:

```
flex items-center justify-between [padding] border-b border-[#E2DEEC]
```

- Title left: `text-lg font-semibold text-[#403770]` (modal) or `text-xs font-medium uppercase tracking-wider text-[#A69DC0]` (panel)
- Actions right: close button, optional secondary actions
- Border separator on modals and panels, not on cards (cards use padding instead)

```tsx
{/* Modal header */}
<div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DEEC]">
  <h2 className="text-lg font-semibold text-[#403770]">Modal Title</h2>
  {/* Close button — see Close Button section */}
</div>

{/* Panel header */}
<div className="flex items-center justify-between px-3 py-2 border-b border-[#E2DEEC]">
  <h3 className="text-xs font-medium uppercase tracking-wider text-[#A69DC0]">Section</h3>
  {/* Close button or actions */}
</div>
```
