# Search Highlighting

Wraps query matches in a text string with a styled `<mark>` element using brand highlight colors.

---

## API

```tsx
import { Highlight } from "@/features/shared/lib/highlight"

<Highlight
  text: string
  query: string
  className?: string
/>
```

File: `highlight.tsx` (`"use client"`).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | — | Full text to display |
| `query` | `string` | — | Search term to highlight |
| `className` | `string` | — | Class applied to the outer `<span>` wrapper |

---

## Usage

### Basic

```tsx
<Highlight text="San Francisco Unified School District" query="unified" />
```

Renders:
```html
<span>
  San Francisco <mark class="bg-[#C4E7E6] text-[#403770] rounded-sm px-px">Unified</mark> School District
</span>
```

### Inside a list

```tsx
function SearchResults({ results, query }: { results: string[], query: string }) {
  return (
    <ul>
      {results.map((item) => (
        <li key={item} className="px-3 py-2 text-sm text-[#6E6390]">
          <Highlight text={item} query={query} />
        </li>
      ))}
    </ul>
  )
}
```

### With custom wrapper class

```tsx
<Highlight
  text={account.name}
  query={searchQuery}
  className="font-medium text-[#403770]"
/>
```

### Empty or no match

```tsx
// query is empty — renders text unchanged, no mark elements
<Highlight text="Full text here" query="" />

// query doesn't match — renders text unchanged
<Highlight text="Full text here" query="zzz" />
```

---

## Behavior Notes

- Matching is **case-insensitive**. The highlighted text preserves the original casing from `text`.
- Special regex characters in `query` are escaped before matching — searching for `"C++"` or `"(foo)"` is safe.
- Splits text into segments, alternating between plain text nodes and `<mark>` elements. This preserves surrounding text exactly.
- When `query` is an empty string or whitespace-only, the component renders `text` as a plain string with no marks.
- Multiple non-overlapping matches in the same string are all highlighted.
- Does not highlight across line breaks or HTML tags — `text` is treated as a flat string.

---

## Brand Integration

| Element | Value |
|---------|-------|
| `<mark>` background | Robin's Egg `#C4E7E6` |
| `<mark>` text color | Plum `#403770` |
| `<mark>` shape | `rounded-sm px-px` — subtle pill, not distracting |

These values align with the Robin's Egg selection highlight role defined in [tokens.md](../tokens.md).

---

## Related

- [text-truncation.md](./text-truncation.md) — truncate text before highlighting
- [tokens.md](../tokens.md) — Robin's Egg and Plum token definitions
- [_foundations.md](./_foundations.md) — utilities overview
