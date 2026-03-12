# Error Boundary

Catches JavaScript errors thrown during rendering and displays a fallback UI instead of crashing the component tree.

---

## API

```tsx
import { ErrorBoundary } from "@/features/shared/lib/error-boundary"

<ErrorBoundary fallback?: ReactNode | (({ error, resetErrorBoundary }: FallbackProps) => ReactNode)>
  {children}
</ErrorBoundary>
```

File: `error-boundary.tsx` (`"use client"`). Implemented as a React class component — `componentDidCatch` is only available in class components.

```ts
type FallbackProps = {
  error: Error
  resetErrorBoundary: () => void
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Component tree to protect |
| `fallback` | `ReactNode \| (props: FallbackProps) => ReactNode` | Default card | Custom error UI |

---

## Usage

### Default fallback

Renders a Fullmind-styled error card with a Plum heading, secondary body text, and a Coral retry button.

```tsx
<ErrorBoundary>
  <DataTable data={rows} />
</ErrorBoundary>
```

### Static custom fallback

```tsx
<ErrorBoundary fallback={<p className="text-sm text-[#F37167]">Failed to load chart.</p>}>
  <RevenueChart />
</ErrorBoundary>
```

### Render function — access to error + reset

```tsx
<ErrorBoundary
  fallback={({ error, resetErrorBoundary }) => (
    <div className="rounded-lg border border-[#D4CFE2] bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-[#403770]">Something went wrong</p>
      <p className="mt-1 text-xs text-[#8A80A8]">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="mt-3 text-xs font-medium text-[#F37167] hover:underline"
      >
        Try again
      </button>
    </div>
  )}
>
  <ActivityFeed />
</ErrorBoundary>
```

### Wrap a portal

```tsx
<Portal>
  <ErrorBoundary>
    <ComplexOverlay />
  </ErrorBoundary>
</Portal>
```

---

## Behavior Notes

- Catches errors thrown in `render`, lifecycle methods, and constructors of class components within the tree. Does **not** catch errors in event handlers, async callbacks, or server-side rendering — use try/catch for those.
- Calling `resetErrorBoundary` resets the boundary's error state and re-renders `children`. If the root cause is not resolved, the same error will be caught again immediately.
- Error boundaries do not catch errors thrown by the boundary itself. Nest boundaries at multiple levels of the tree for granular isolation.
- In development, React re-throws caught errors to the browser's error overlay — the fallback UI is still shown, but the overlay appears on top. This is expected behavior.

---

## Brand Integration

The default fallback uses card standards from [tokens.md](../tokens.md):

| Element | Value |
|---------|-------|
| Card | `rounded-lg shadow-sm border border-[#D4CFE2] bg-white p-5` |
| Heading | `text-sm font-semibold text-[#403770]` (Plum) |
| Body | `text-xs text-[#8A80A8]` (Secondary) |
| Retry button | `text-xs font-medium text-white bg-[#F37167] rounded-lg px-3 py-1.5` (Coral) |

---

## Related

- [portal.md](./portal.md) — wrap portal content in an error boundary
- [tokens.md](../tokens.md) — card styling and brand color references
- [_foundations.md](./_foundations.md) — utilities overview
