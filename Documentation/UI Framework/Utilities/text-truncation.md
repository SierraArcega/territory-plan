# Text Truncation

Shortens strings by cutting from the end or the middle, and a component that handles overflow truncation with a native tooltip.

---

## API

### Pure functions — `truncate.ts` (server-safe)

```ts
import { truncateEnd, truncateMiddle } from "@/features/shared/lib/truncate"

truncateEnd(text: string, maxLength: number): string
truncateMiddle(text: string, maxLength: number): string
```

### Component — `truncated-text.tsx` ("use client")

```tsx
import { TruncatedText } from "@/features/shared/lib/truncated-text"

<TruncatedText
  text: string
  className?: string
/>
```

---

## Usage

### `truncateEnd`

Appends `"…"` when the string exceeds `maxLength`.

```ts
truncateEnd("San Francisco Unified School District", 20)
// → "San Francisco Unifie…"

truncateEnd("Short", 20)
// → "Short"

truncateEnd("Exactly twenty chars", 20)
// → "Exactly twenty chars"
```

### `truncateMiddle`

Preserves the start and end of the string, replacing the middle with `"…"`. Useful for file paths, URLs, and IDs where both ends are meaningful.

```ts
truncateMiddle("src/features/shared/lib/use-resize-observer.ts", 30)
// → "src/features/shared/…observer.ts"

truncateMiddle("abc123def456ghi789", 12)
// → "abc123…i789"

truncateMiddle("Short", 20)
// → "Short"
```

The split is weighted toward the start — roughly 60% prefix, 40% suffix.

### `<TruncatedText>`

CSS-based truncation for single-line display. Uses Tailwind's `truncate` class (`overflow-hidden text-ellipsis whitespace-nowrap`) and a native `title` attribute for the full text on hover.

```tsx
// Fills its container and shows full text on hover
<TruncatedText text="San Francisco Unified School District" />

// With custom styling
<TruncatedText
  text="A very long account name that won't fit"
  className="text-sm font-medium text-[#403770] max-w-[200px]"
/>
```

The component renders a `<span>` by default. It must be placed inside a container with a constrained width — it does not set its own width.

---

## Behavior Notes

- `truncateEnd` and `truncateMiddle` return the original string unchanged when it fits within `maxLength`.
- `maxLength` counts characters, not pixels. Use `<TruncatedText>` when pixel-precise truncation is needed.
- `truncateMiddle` gracefully handles very short `maxLength` values — it will not produce a string longer than `maxLength` even with the ellipsis.
- `<TruncatedText>` relies on CSS and will not show an ellipsis if the container does not constrain the element's width (e.g., `flex-1` without a parent that has a max-width).
- The `title` attribute on `<TruncatedText>` is always set to the full untruncated `text`, enabling the browser's native tooltip.

---

## Related

- [formatting.md](./formatting.md) — format numbers/currency before truncating
- [search-highlighting.md](./search-highlighting.md) — highlight matches inside truncated text
- [_foundations.md](./_foundations.md) — utilities overview
