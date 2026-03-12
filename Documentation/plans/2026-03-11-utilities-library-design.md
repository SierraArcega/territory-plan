# Utilities Library Design

A utilities layer for the Fullmind territory planning tool — reusable functions, hooks, and lightweight components that serve the rest of the codebase. Inspired by Elastic UI's utilities model, scoped to what this project actually needs.

---

## Goals

1. **Consolidate** scattered inline patterns (outside click, class merging, text truncation) into tested, documented utilities
2. **Fill gaps** — clipboard, focus trap, error boundary, relative time, screen reader helpers
3. **Document** every utility in `Documentation/UI Framework/Utilities/` using the same guide format as the existing component docs

## Non-Goals

- Not a general-purpose library — only utilities this project needs
- No barrel exports / index files (avoid Next.js bundle concerns)
- Minimize new dependencies — only `clsx` + `tailwind-merge` (two new production deps)

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| File location | `src/features/shared/lib/` | Matches existing `format.ts`, `date-utils.ts` convention |
| Doc location | `Documentation/UI Framework/Utilities/` | New top-level section parallel to `Components/` |
| Structure | Flat — one file per utility | Project is mid-size; nesting adds ceremony without benefit |
| Dependencies | `clsx` + `tailwind-merge` (new); `date-fns` (existing) | Everything else uses native browser APIs + React primitives |
| Barrel export | None | Avoid tree-shaking issues; direct imports are explicit |
| Hooks in `lib/` not `hooks/` | Co-locate with related pure functions | Existing `useMapSummary` lives in `lib/`; keeps utility + hook together (e.g., `copy.ts` has both `copyToClipboard` and `useCopyToClipboard`) |
| `"use client"` strategy | Files with hooks/browser APIs get `"use client"` directive | Pure-function-only files (`cn.ts`, `format.ts`, `color-utils.ts`, `pretty-duration.ts`) remain server-safe. Files mixing pure functions + hooks (`copy.ts`, `truncate.ts`) are split: pure functions in one file, hook/component in a separate `.tsx` file |

---

## Utility Inventory

### Tier 1 — High Relevance

#### `cn.ts` — Class Merging

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

Merges Tailwind classes with conflict resolution. Replaces manual string concatenation throughout the codebase.

#### `copy.ts` + `use-copy-to-clipboard.ts` — Clipboard

Pure function (server-safe):

```ts
// copy.ts
export async function copyToClipboard(text: string): Promise<boolean>
```

Hook (client-only):

```ts
// use-copy-to-clipboard.ts — "use client"
export function useCopyToClipboard(resetMs?: number): {
  copy: (text: string) => Promise<void>;
  copied: boolean;
  error: Error | null;
}
```

- Uses `navigator.clipboard.writeText` (modern browsers only, no `execCommand` fallback)
- Hook auto-resets `copied` state after `resetMs` (default 2000ms)
- Hook cleans up timeout on unmount
- Split into two files so `copyToClipboard` stays server-safe

#### `format.ts` — Formatting Extensions (existing file)

Add to the existing `format.ts`:

```ts
export function formatPercent(value: number | null | undefined, decimals?: number): string
export function formatCompactNumber(value: number | null | undefined): string
```

- `formatPercent(0.847)` → `"84.7%"`
- `formatCompactNumber(14832)` → `"14.8K"`
- Same null-guarding pattern (`returns "-"`) as existing `formatCurrency`
- Note: `formatCurrency(value, compact: true)` already does compact formatting with `$` prefix. `formatCompactNumber` extracts the shared compact logic without a currency symbol. Consider having `formatCurrency` delegate to it internally to DRY up the logic

#### `truncate.ts` — Text Truncation

```ts
export function truncateEnd(text: string, maxLength: number): string
export function truncateMiddle(text: string, maxLength: number): string
```

- `truncateEnd("Springfield School District", 20)` → `"Springfield School D…"`
- `truncateMiddle("Springfield School District", 20)` → `"Springfield…District"`
- Pure functions live in `truncate.ts` (server-safe)
- `<TruncatedText>` component lives in a separate `truncated-text.tsx` (`"use client"`) — uses CSS `text-overflow: ellipsis` and shows full text in a tooltip on overflow (detects via resize observer)

#### `pretty-duration.ts` — Relative Time

```ts
export function timeAgo(date: Date | string): string
export function timeUntil(date: Date | string): string
```

- Wraps `date-fns` `formatDistanceToNow` (already installed, v4.1.0) with project-specific thresholds
- `CalendarSyncBadge.tsx` already uses `formatDistanceToNow` directly — should migrate to these wrappers for consistency
- Accepted string inputs: ISO 8601 (`2026-03-11T14:30:00Z`) and `YYYY-MM-DD`. Other formats throw
- For `YYYY-MM-DD` strings, uses `parseLocalDate` to avoid timezone shift. For ISO strings with time component, uses `new Date()` directly to preserve time precision for relative calculations
- Returns: "just now", "2m ago", "3h ago", "yesterday", "5 days ago"
- Switches from relative to absolute date display after 7 days (e.g., "Mar 2")

#### `highlight.ts` — Search Highlighting

```tsx
export function Highlight({ text, query, className }: {
  text: string;
  query: string;
  className?: string;
}): React.ReactNode
```

- Wraps matched substrings in `<mark>` tags
- Brand styling: `bg-[#C4E7E6] text-[#403770] rounded-sm px-0.5` (Robin's Egg bg, Plum text)
- Case-insensitive matching
- Escapes regex special characters in the query string
- Returns plain text if query is empty

#### `use-resize-observer.ts` — Resize Observer

```ts
export function useResizeObserver<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  width: number;
  height: number;
}
```

- Uses native `ResizeObserver` API
- Cleans up observer on unmount
- Returns 0/0 before first measurement

#### `color-utils.ts` — Color Utilities

```ts
export function hexToRgb(hex: string): { r: number; g: number; b: number }
export function withOpacity(hex: string, opacity: number): string  // returns rgba()
export function contrastRatio(hex1: string, hex2: string): number
```

- Supports the palette system in `palettes.ts`
- `hexToRgb` accepts 3-char (`#FFF`) and 6-char (`#FFFFFF`) hex, with or without `#` prefix. Throws on invalid input
- `contrastRatio` implements WCAG 2.1 relative luminance formula. Returns a value from 1 to 21. WCAG AA thresholds: 4.5:1 for normal text, 3:1 for large text (18px+ bold or 24px+ regular)
- Useful for runtime accessibility checks against brand colors

### Tier 2 — Moderate Relevance

#### `use-focus-trap.ts` — Focus Trap

```ts
export function useFocusTrap<T extends HTMLElement>(active?: boolean): RefObject<T | null>
```

Note: React 19 `useRef` returns `RefObject<T | null>` when initialized with `null`. The `| null` is required in the return type.

- When `active` is true, traps Tab/Shift+Tab within the container
- Auto-focuses first focusable element on activation
- Restores focus to previously focused element on deactivation
- For modals, flyouts, and dialogs

#### `screen-reader.tsx` — Screen Reader Helpers

```tsx
export function ScreenReaderOnly({ children, as?: ElementType }: Props): React.ReactNode
export const srOnlyClass: string
```

- Visually hidden but accessible — standard `clip-rect` technique
- `srOnlyClass` exported as a raw string for use without the component wrapper
- For providing context to screen readers (e.g., "Opens in new tab", "Selected")

#### `use-outside-click.ts` — Outside Click Detection

```ts
export function useOutsideClick<T extends HTMLElement>(
  ref: RefObject<T>,
  callback: () => void,
  active?: boolean
): void
```

- Extracts the inline pattern from `Documentation/UI Framework/Components/Containers/_foundations.md`
- Listens on `mousedown` + `touchstart`
- `active` parameter (default true) allows conditional activation
- Cleans up listeners on unmount

#### `portal.tsx` — Portal

```tsx
export function Portal({ children, container?: Element }): React.ReactNode
```

- Renders children into `document.body` (or custom container) via `createPortal`
- For tooltips and popovers that need to escape overflow clipping
- SSR-safe: returns null during server render

#### `error-boundary.tsx` — Error Boundary

```tsx
export function ErrorBoundary({ children, fallback? }: Props): React.ReactNode
```

- React class component (required by React's error boundary API)
- Default fallback: Fullmind-styled error card using brand tokens
  - Plum heading, Secondary body text, Coral retry button
  - `rounded-lg shadow-sm border border-[#D4CFE2]` per card standards
- Accepts custom `fallback` prop (ReactNode or render function receiving `{ error: Error, resetErrorBoundary: () => void }`)
- `resetErrorBoundary` clears the error state via internal state reset, re-rendering children
- File requires `"use client"` directive

#### `use-scroll.ts` — Scroll Utilities

```ts
export function useScrollTo(): {
  scrollTo: (element: HTMLElement | string, options?: { offset?: number; behavior?: ScrollBehavior }) => void;
}

export function useScrollPosition(): {
  x: number;
  y: number;
  isScrolling: boolean;
}
```

- `scrollTo` accepts an element or CSS selector, smooth-scrolls with configurable offset (useful for sticky headers)
- `useScrollPosition` throttles updates to ~60fps via `requestAnimationFrame`
- `isScrolling` resets to false after 150ms of no scroll events

---

## Documentation

### Location

`Documentation/UI Framework/Utilities/`

### Files

| File | Covers |
|------|--------|
| `_foundations.md` | Overview, decision tree, import conventions, testing expectations, categories |
| `class-merging.md` | `cn()` |
| `clipboard.md` | `copyToClipboard()` + `useCopyToClipboard()` |
| `text-truncation.md` | `truncateEnd()`, `truncateMiddle()`, `<TruncatedText>` |
| `pretty-duration.md` | `timeAgo()` / `timeUntil()` |
| `search-highlighting.md` | `<Highlight>` component |
| `resize-observer.md` | `useResizeObserver()` |
| `formatting.md` | All formatters — existing + new |
| `color-utilities.md` | `hexToRgb()`, `withOpacity()`, `contrastRatio()` |
| `focus-trap.md` | `useFocusTrap()` |
| `screen-reader.md` | `<ScreenReaderOnly>` + `srOnlyClass` |
| `outside-click.md` | `useOutsideClick()` |
| `portal.md` | `<Portal>` |
| `error-boundary.md` | `<ErrorBoundary>` |
| `scroll.md` | `useScrollTo()` + `useScrollPosition()` |

### Guide Template

Each guide follows this structure (consistent with existing component docs):

```
# Utility Name

One-line description. When to reach for it.

See `_foundations.md` for import conventions.

---

## API
Function/hook signatures with TypeScript types.

## Usage
### Basic
Most common use case.

### With [Variant]
Additional patterns.

## Behavior Notes
Edge cases, defaults, cleanup behavior, null handling.

## Brand Integration
Connection to Fullmind tokens (if applicable).

## Related
Links to related guides or utilities.
```

### `_foundations.md` Contents

- **What utilities are**: Functions, hooks, and lightweight components that other components consume — not visual building blocks
- **Import convention**: `import { cn } from "@/features/shared/lib/cn"` (direct file imports, no barrel)
- **Decision tree**: "Which utility do I need?" organized by problem domain
- **Categories**: Formatting, DOM & Layout, Interaction, Accessibility, Error Handling
- **Testing**: All pure functions have unit tests in `__tests__/`; hooks tested via Testing Library

---

## Testing

Every utility gets tests in `src/features/shared/lib/__tests__/`:

| Test file | Covers |
|-----------|--------|
| `cn.test.ts` | Class conflict resolution, conditional classes, falsy values |
| `copy.test.ts` | Success/failure paths, hook state transitions, timeout cleanup |
| `format.test.ts` | Existing tests + new `formatPercent`, `formatCompactNumber` |
| `truncate.test.ts` | Boundary lengths, empty strings, Unicode |
| `pretty-duration.test.ts` | Edge thresholds (59s→1m, 23h→yesterday, 7d→absolute) |
| `highlight.test.tsx` | Case insensitivity, special chars, empty query |
| `use-resize-observer.test.tsx` | Mock ResizeObserver, cleanup |
| `color-utils.test.ts` | Hex parsing, opacity output, WCAG contrast formula |
| `use-focus-trap.test.tsx` | Tab cycling, activation/deactivation, focus restoration |
| `screen-reader.test.tsx` | Renders visually hidden, accessible to screen readers |
| `use-outside-click.test.tsx` | Inside vs outside clicks, touch events, active toggle |
| `portal.test.tsx` | Renders into body, custom container, SSR safety |
| `error-boundary.test.tsx` | Catches errors, renders fallback, retry resets |
| `use-scroll.test.tsx` | Scroll position updates, throttling, isScrolling timeout |

---

## Dependencies

```
npm install clsx tailwind-merge
```

No other new packages. All utilities use native browser APIs (ResizeObserver, Clipboard API) and React primitives (`createPortal`, `useRef`, `useEffect`). `pretty-duration.ts` wraps the existing `date-fns` dependency.

---

## Server / Client Boundary

Files that contain hooks or browser APIs require `"use client"`. Files that export only pure functions remain server-safe.

| File | Directive | Reason |
|------|-----------|--------|
| `cn.ts` | _(none — server-safe)_ | Pure function |
| `copy.ts` | _(none — server-safe)_ | Pure async function |
| `use-copy-to-clipboard.ts` | `"use client"` | Hook |
| `format.ts` | _(none — server-safe)_ | Pure functions |
| `truncate.ts` | _(none — server-safe)_ | Pure functions |
| `truncated-text.tsx` | `"use client"` | Component with hooks |
| `pretty-duration.ts` | _(none — server-safe)_ | Pure functions |
| `highlight.tsx` | `"use client"` | React component |
| `use-resize-observer.ts` | `"use client"` | Hook + browser API |
| `color-utils.ts` | _(none — server-safe)_ | Pure functions |
| `use-focus-trap.ts` | `"use client"` | Hook + DOM API |
| `screen-reader.tsx` | `"use client"` | React component |
| `use-outside-click.ts` | `"use client"` | Hook + DOM API |
| `portal.tsx` | `"use client"` | `createPortal` + DOM |
| `error-boundary.tsx` | `"use client"` | Class component + DOM |
| `use-scroll.ts` | `"use client"` | Hook + DOM API |

---

## What This Does NOT Include

- **No barrel exports** — direct file imports avoid bundle bloat
- **No EUI utilities we don't need** — auto sizer, container queries, delay, HTML ID generator, i18n, inner text, mutation observer, overlay mask, provider, text diff, window events
- **No refactoring existing components** — that's a separate task after utilities exist
- **No new design tokens** — utilities use existing brand tokens from `tokens.md`
