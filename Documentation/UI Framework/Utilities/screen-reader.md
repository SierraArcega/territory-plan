# Screen Reader

Visually hides content from sighted users while keeping it accessible to screen readers, and exposes the underlying CSS class string for use in Tailwind.

---

## API

```tsx
import { ScreenReaderOnly, srOnlyClass } from "@/features/shared/lib/screen-reader"

<ScreenReaderOnly
  children: React.ReactNode
  as?: keyof JSX.IntrinsicElements
/>

srOnlyClass: string
```

File: `screen-reader.tsx` (`"use client"`).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Content to hide visually but expose to assistive tech |
| `as` | HTML tag name | `"span"` | Rendered element type |

---

## Usage

### Label an icon-only button

```tsx
import { ScreenReaderOnly } from "@/features/shared/lib/screen-reader"

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5] transition-colors"
      aria-label="Close"
    >
      <XIcon className="w-4 h-4" />
      <ScreenReaderOnly>Close</ScreenReaderOnly>
    </button>
  )
}
```

Note: either `aria-label` or `<ScreenReaderOnly>` is sufficient for a button — use whichever reads more naturally in context. Do not use both on the same element.

### Announce status changes

```tsx
<ScreenReaderOnly as="p" aria-live="polite">
  {copied ? "Copied to clipboard" : ""}
</ScreenReaderOnly>
```

### Block-level hidden text

```tsx
<ScreenReaderOnly as="h2">Account details section</ScreenReaderOnly>
```

### Using `srOnlyClass` in Tailwind

When you need the visually-hidden styles on an element you're already rendering (e.g., a label), apply the class string directly:

```tsx
import { srOnlyClass } from "@/features/shared/lib/screen-reader"

<label htmlFor="search" className={srOnlyClass}>
  Search accounts
</label>
```

`srOnlyClass` expands to the equivalent of Tailwind's `sr-only` — the clip-rect technique:

```
absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0
clip-[rect(0,0,0,0)]
```

---

## Behavior Notes

- The clip-rect technique (`clip: rect(0 0 0 0)` or modern `clip-path`) visually hides content without using `display: none` or `visibility: hidden`, which would also hide it from screen readers.
- Content rendered with `<ScreenReaderOnly>` is still in the DOM, participates in focus order if it contains interactive elements, and is read by screen readers in document order.
- Do not place visually important content inside `<ScreenReaderOnly>` — it will be invisible to sighted users including those using screen magnifiers.
- The `as` prop allows semantic correctness: use `"p"` for announcements, `"h2"` for section labels, `"span"` (default) for inline annotations.

---

## Related

- [focus-trap.md](./focus-trap.md) — keyboard navigation for accessible overlays
- [_foundations.md](./_foundations.md) — utilities overview
