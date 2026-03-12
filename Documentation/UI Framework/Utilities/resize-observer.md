# Resize Observer

Tracks the pixel dimensions of a DOM element, updating on every size change.

---

## API

```ts
import { useResizeObserver } from "@/features/shared/lib/use-resize-observer"

useResizeObserver<T extends Element = HTMLElement>(): {
  ref: RefObject<T | null>
  width: number
  height: number
}
```

File: `use-resize-observer.ts` (`"use client"`).

Attach `ref` to the element you want to measure. `width` and `height` start at `0` and update after the first paint.

---

## Usage

### Measure a container

```tsx
import { useResizeObserver } from "@/features/shared/lib/use-resize-observer"

function ResponsiveChart() {
  const { ref, width, height } = useResizeObserver<HTMLDivElement>()

  return (
    <div ref={ref} className="w-full h-64">
      {width > 0 && (
        <ChartCanvas width={width} height={height} />
      )}
    </div>
  )
}
```

### Conditional layout based on width

```tsx
function AdaptiveCard() {
  const { ref, width } = useResizeObserver<HTMLDivElement>()
  const isNarrow = width > 0 && width < 300

  return (
    <div ref={ref} className="flex-1">
      {isNarrow ? <CompactView /> : <ExpandedView />}
    </div>
  )
}
```

### Typed for a non-div element

```tsx
const { ref, width } = useResizeObserver<HTMLCanvasElement>()
// ref is RefObject<HTMLCanvasElement | null>
```

---

## Behavior Notes

- Initial values are `{ width: 0, height: 0 }`. Gate rendering of size-dependent content behind a `width > 0` check to avoid flash of incorrectly sized content.
- Uses `ResizeObserver` internally. The observer is disconnected when the component unmounts.
- Reports the element's `contentBoxSize` (inner dimensions, excluding padding if `box-sizing: border-box` is not in effect — check your global CSS).
- Does not throttle or debounce. For expensive recalculations (e.g., SVG path generation), debounce in the consuming component.
- If `ref` is never attached to a DOM node, `width` and `height` remain `0` indefinitely.
- `ResizeObserver` is available in all modern browsers. No polyfill is bundled — add one at the app entry point if IE11 support is needed.

---

## Related

- [scroll.md](./scroll.md) — scroll position tracking
- [portal.md](./portal.md) — measure portal content after mount
- [_foundations.md](./_foundations.md) — utilities overview
