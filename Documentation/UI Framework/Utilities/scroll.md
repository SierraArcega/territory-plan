# Scroll

Programmatically smooth-scrolls to an element or position, and tracks the current scroll position with an `isScrolling` flag.

---

## API

```ts
import { useScrollTo, useScrollPosition } from "@/features/shared/lib/use-scroll"
```

File: `use-scroll.ts` (`"use client"`).

### `useScrollTo`

```ts
useScrollTo(): (target: HTMLElement | string, options?: ScrollToOptions) => void

type ScrollToOptions = {
  offset?: number      // px to subtract from final scroll position (e.g. for a sticky header)
  behavior?: ScrollBehavior  // "smooth" | "instant" | "auto" — default "smooth"
}
```

`target` accepts an `HTMLElement` reference or a CSS selector string (e.g., `"#section-goals"`).

### `useScrollPosition`

```ts
useScrollPosition(container?: HTMLElement | null): {
  scrollY: number
  scrollX: number
  isScrolling: boolean
}
```

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `container` | `HTMLElement \| null` | `window` | Element to observe. Omit or pass `null` to observe the window |

---

## Usage

### Scroll to a section on click

```tsx
import { useScrollTo } from "@/features/shared/lib/use-scroll"

function TableOfContents() {
  const scrollTo = useScrollTo()

  return (
    <nav className="flex flex-col gap-1">
      <button onClick={() => scrollTo("#section-goals", { offset: 72 })}>
        Goals
      </button>
      <button onClick={() => scrollTo("#section-plans", { offset: 72 })}>
        Plans
      </button>
    </nav>
  )
}
```

### Scroll to a DOM ref

```tsx
const sectionRef = useRef<HTMLDivElement>(null)
const scrollTo = useScrollTo()

<button onClick={() => sectionRef.current && scrollTo(sectionRef.current)}>
  Jump to section
</button>
```

### Track window scroll position

```tsx
import { useScrollPosition } from "@/features/shared/lib/use-scroll"

function StickyHeader() {
  const { scrollY, isScrolling } = useScrollPosition()

  return (
    <header
      className={cn(
        "sticky top-0 z-10 transition-shadow",
        scrollY > 0 ? "shadow-sm" : "shadow-none"
      )}
    >
      {/* header content */}
    </header>
  )
}
```

### Track scroll in a scrollable container

```tsx
function ScrollableList() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollY, isScrolling } = useScrollPosition(containerRef.current)

  return (
    <div ref={containerRef} className="overflow-y-auto h-96">
      {/* list items */}
    </div>
  )
}
```

---

## Behavior Notes

- `useScrollTo` uses `Element.scrollIntoView` with `behavior: "smooth"` when targeting an element, falling back to `window.scrollTo` for coordinate-based scrolling. The `offset` is subtracted from the final `top` position to account for sticky headers.
- CSS selector strings are resolved with `document.querySelector`. If no element matches, the scroll silently no-ops.
- `useScrollPosition` updates on every `scroll` event but throttles state updates via `requestAnimationFrame` — only one state update fires per animation frame regardless of scroll event frequency.
- `isScrolling` is set to `true` on the first scroll event and reset to `false` after **150ms** of inactivity.
- Listeners are attached to the `container` element (or `window`) and removed on unmount or when `container` changes.
- Initial values are `{ scrollY: 0, scrollX: 0, isScrolling: false }` before any scroll occurs.

---

## Related

- [resize-observer.md](./resize-observer.md) — measure element dimensions
- [portal.md](./portal.md) — portaled overlays are unaffected by scroll position of their parent
- [_foundations.md](./_foundations.md) — utilities overview
