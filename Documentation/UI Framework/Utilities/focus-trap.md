# Focus Trap

Confines keyboard focus within a container element while active, required for accessible modals, dialogs, and drawers.

---

## API

```ts
import { useFocusTrap } from "@/features/shared/lib/use-focus-trap"

useFocusTrap<T extends HTMLElement = HTMLElement>(active?: boolean): RefObject<T | null>
```

File: `use-focus-trap.ts` (`"use client"`).

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `active` | `boolean` | `true` | When `false`, focus trap is disabled and all listeners are removed |

Returns a `RefObject` to attach to the container element that should trap focus.

---

## Usage

### Modal with focus trap

```tsx
import { useFocusTrap } from "@/features/shared/lib/use-focus-trap"

function Modal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const trapRef = useFocusTrap<HTMLDivElement>(open)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={trapRef}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6"
      >
        <h2 className="text-lg font-semibold text-[#403770] mb-4">Confirm</h2>
        <p className="text-sm text-[#6E6390] mb-6">Are you sure?</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose}>Cancel</button>
          <button>Confirm</button>
        </div>
      </div>
    </div>
  )
}
```

### Conditional activation

```tsx
// Trap only when the panel is open
const trapRef = useFocusTrap<HTMLDivElement>(isPanelOpen)
```

### Combining with outside click

```tsx
const trapRef = useFocusTrap<HTMLDivElement>(isOpen)
useOutsideClick(trapRef, () => setIsOpen(false), isOpen)
```

The same ref can be shared with `useOutsideClick` — both hooks read from it without conflicting.

---

## Behavior Notes

- When `active` becomes `true`, the hook focuses the first focusable element inside the container (buttons, inputs, links, elements with `tabindex`). If no focusable element exists, the container itself receives focus if it has a `tabindex`.
- Tab and Shift+Tab keypresses that would move focus outside the container are intercepted and wrapped to the last or first focusable element respectively.
- When `active` becomes `false` (or the component unmounts), focus is restored to the element that was focused before the trap activated.
- Focusable element detection uses a standard selector covering `a[href]`, `button`, `input`, `select`, `textarea`, and `[tabindex]:not([tabindex="-1"])`. Disabled elements are excluded.
- The event listener is attached to the container element, not `document`, to avoid conflicts with nested traps.

---

## Related

- [outside-click.md](./outside-click.md) — pair with focus trap for complete dismiss behavior
- [portal.md](./portal.md) — focus trap works inside portals; attach ref to the portal content
- [Components/Containers/_foundations.md](../Components/Containers/_foundations.md) — container dismiss and keyboard behavior patterns
- [_foundations.md](./_foundations.md) — utilities overview
