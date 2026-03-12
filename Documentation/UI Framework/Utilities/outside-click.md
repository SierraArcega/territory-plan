# Outside Click

Fires a callback when the user clicks or taps outside a referenced element.

---

## API

```ts
import { useOutsideClick } from "@/features/shared/lib/use-outside-click"

useOutsideClick<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null>,
  callback: () => void,
  active?: boolean
): void
```

File: `use-outside-click.ts` (`"use client"`).

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `ref` | `RefObject<T \| null>` | — | Ref attached to the element to watch |
| `callback` | `() => void` | — | Called when a click/tap occurs outside the element |
| `active` | `boolean` | `true` | When `false`, listeners are removed and the hook is inert |

---

## Usage

### Dismiss a dropdown

```tsx
import { useRef } from "react"
import { useOutsideClick } from "@/features/shared/lib/use-outside-click"

function Dropdown({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, onClose, open)

  if (!open) return null

  return (
    <div
      ref={ref}
      className="absolute top-full mt-1 w-56 rounded-xl border border-[#D4CFE2] bg-white shadow-lg z-30"
    >
      {/* dropdown items */}
    </div>
  )
}
```

### Shared ref with focus trap

```tsx
const containerRef = useRef<HTMLDivElement>(null)

// Both hooks read the same ref
useFocusTrap<HTMLDivElement>(isOpen)   // returns its own ref — use separate refs, or
useOutsideClick(containerRef, onClose, isOpen)
```

When combining with `useFocusTrap`, use the ref returned by `useFocusTrap` and also pass it to `useOutsideClick`:

```tsx
const trapRef = useFocusTrap<HTMLDivElement>(isOpen)
useOutsideClick(trapRef, onClose, isOpen)
```

### Conditional activation

```tsx
// Hook only listens when the panel is open; no listener overhead when closed
useOutsideClick(panelRef, () => setOpen(false), isOpen)
```

---

## Behavior Notes

- Listens on `mousedown` and `touchstart` (not `click`) so the callback fires before `blur` events, maintaining correct event order with focus management.
- The check is `!ref.current?.contains(event.target)`. Clicks inside nested portals that are children of the referenced element work correctly as long as the portal's DOM node is a descendant.
- If a portal (e.g., a tooltip inside a dropdown) is rendered outside the container's DOM subtree, those clicks will incorrectly trigger the outside-click callback. Pass a second ref to exclude portal content, or set `active` to `false` while the portal is open.
- Listeners are added to `document`. They are removed when `active` becomes `false` or the component unmounts.
- `active` defaults to `true`. If you always want the hook active, you can omit it: `useOutsideClick(ref, onClose)`.

---

## Related

- [focus-trap.md](./focus-trap.md) — keyboard focus containment, pairs with outside click for full dismiss behavior
- [Components/Containers/_foundations.md](../Components/Containers/_foundations.md) — container dismiss patterns
- [_foundations.md](./_foundations.md) — utilities overview
