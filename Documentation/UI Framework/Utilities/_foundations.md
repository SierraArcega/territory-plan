# Utilities

Shared functions, hooks, and lightweight components consumed by other components. Utilities have no business logic and no knowledge of application domain — they solve general UI and JavaScript problems.

---

## What Utilities Are

- **Pure functions** — stateless transformations (formatting, class merging, color math)
- **React hooks** — encapsulate browser APIs or stateful side effects (resize, scroll, clipboard)
- **Lightweight components** — thin wrappers around DOM primitives (`<Portal>`, `<ScreenReaderOnly>`, `<ErrorBoundary>`)

Utilities live in `src/features/shared/lib/`. They are imported directly by file — there are no barrel exports.

```ts
import { cn } from "@/features/shared/lib/cn"
import { formatCurrency } from "@/features/shared/lib/format"
import { useResizeObserver } from "@/features/shared/lib/use-resize-observer"
```

---

## Decision Tree

Choose a utility by problem domain:

```
What problem are you solving?
│
├── Styling
│   └── Merging/conditionalizing Tailwind classes → class-merging.md (cn)
│
├── Formatting
│   ├── Currency, numbers, percents → formatting.md (formatCurrency, formatNumber, etc.)
│   ├── Relative / absolute time → pretty-duration.md (timeAgo, timeUntil)
│   └── Truncating long strings → text-truncation.md (truncateEnd, truncateMiddle)
│
├── DOM & Layout
│   ├── Measuring element dimensions → resize-observer.md (useResizeObserver)
│   ├── Rendering outside the DOM tree → portal.md (Portal)
│   └── Scrolling to an element or position → scroll.md (useScrollTo, useScrollPosition)
│
├── Interaction
│   ├── Copying text to clipboard → clipboard.md (copyToClipboard, useCopyToClipboard)
│   ├── Detecting clicks outside an element → outside-click.md (useOutsideClick)
│   └── Trapping keyboard focus in a region → focus-trap.md (useFocusTrap)
│
├── Accessibility
│   ├── Visually hidden content for screen readers → screen-reader.md (ScreenReaderOnly)
│   └── Highlighting search matches in text → search-highlighting.md (Highlight)
│
├── Color
│   └── Hex parsing, opacity, WCAG contrast → color-utilities.md (hexToRgb, etc.)
│
└── Error Handling
    └── Catching render-phase exceptions → error-boundary.md (ErrorBoundary)
```

---

## Categories

### Formatting

Stateless. Accept raw data, return display strings. All return `"-"` for null/undefined inputs. All are server-safe.

| File | Exports |
|------|---------|
| `format.ts` | `formatCurrency`, `formatNumber`, `formatPercent`, `formatCompactNumber` |
| `pretty-duration.ts` | `timeAgo`, `timeUntil` |
| `truncate.ts` | `truncateEnd`, `truncateMiddle` |

### DOM & Layout

Browser-dependent. Hooks fire only after mount.

| File | Exports |
|------|---------|
| `use-resize-observer.ts` | `useResizeObserver` |
| `portal.tsx` | `Portal` |
| `use-scroll.ts` | `useScrollTo`, `useScrollPosition` |

### Interaction

Event-driven hooks. Accept `active` flags for conditional attachment.

| File | Exports |
|------|---------|
| `copy.ts` | `copyToClipboard` |
| `use-copy-to-clipboard.ts` | `useCopyToClipboard` |
| `use-outside-click.ts` | `useOutsideClick` |
| `use-focus-trap.ts` | `useFocusTrap` |

### Accessibility

| File | Exports |
|------|---------|
| `screen-reader.tsx` | `ScreenReaderOnly`, `srOnlyClass` |
| `highlight.tsx` | `Highlight` |

### Error Handling

| File | Exports |
|------|---------|
| `error-boundary.tsx` | `ErrorBoundary` |

### Utilities

| File | Exports |
|------|---------|
| `cn.ts` | `cn` |
| `color-utils.ts` | `hexToRgb`, `withOpacity`, `contrastRatio` |

---

## Server / Client Boundary

Files marked `"use client"` attach browser APIs and cannot be imported from Server Components or route handlers.

| File | Directive | Reason |
|------|-----------|--------|
| `cn.ts` | none | Pure string manipulation |
| `format.ts` | none | Pure math / Intl formatting |
| `pretty-duration.ts` | none | Pure date math |
| `truncate.ts` | none | Pure string manipulation |
| `color-utils.ts` | none | Pure math |
| `copy.ts` | none | Clipboard API is runtime-checked, not imported |
| `highlight.tsx` | `"use client"` | Renders React state |
| `truncated-text.tsx` | `"use client"` | Uses DOM ref for overflow detection |
| `use-copy-to-clipboard.ts` | `"use client"` | Hook — uses `useState` |
| `use-resize-observer.ts` | `"use client"` | Hook — uses `ResizeObserver` |
| `use-focus-trap.ts` | `"use client"` | Hook — uses `addEventListener` |
| `use-outside-click.ts` | `"use client"` | Hook — uses `addEventListener` |
| `use-scroll.ts` | `"use client"` | Hook — uses `requestAnimationFrame` |
| `portal.tsx` | `"use client"` | Reads `document.body` |
| `screen-reader.tsx` | `"use client"` | Component (could be server, marked for consistency) |
| `error-boundary.tsx` | `"use client"` | Class component with `componentDidCatch` |

---

## Testing

**Pure functions** — test in `src/features/shared/lib/__tests__/`. Standard Jest unit tests. No DOM needed.

```ts
// __tests__/format.test.ts
import { formatCurrency } from "../format"
expect(formatCurrency(1234.5)).toBe("$1,235")
expect(formatCurrency(null)).toBe("-")
```

**Hooks** — use `@testing-library/react` with `renderHook`. Wrap in `act` for state updates.

```ts
import { renderHook, act } from "@testing-library/react"
import { useCopyToClipboard } from "../use-copy-to-clipboard"

const { result } = renderHook(() => useCopyToClipboard())
await act(async () => { await result.current.copy("hello") })
expect(result.current.copied).toBe(true)
```

**Components** — use `@testing-library/react` with `render`. For portal-based components, ensure `document.body` is available in jsdom.

---

## Related

- [tokens.md](../tokens.md) — brand color and spacing values referenced by several utilities
- [Components/Containers/_foundations.md](../Components/Containers/_foundations.md) — focus trap and outside click are central to container dismiss behavior
