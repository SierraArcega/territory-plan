# Portal

Renders children into a different DOM node than the component tree, escaping CSS overflow and stacking contexts.

---

## API

```tsx
import { Portal } from "@/features/shared/lib/portal"

<Portal container?: HTMLElement>
  {children}
</Portal>
```

File: `portal.tsx` (`"use client"`).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Content to render into the target container |
| `container` | `HTMLElement` | `document.body` | Target DOM node |

---

## Usage

### Default — render into `document.body`

```tsx
import { Portal } from "@/features/shared/lib/portal"

function Tooltip({ content, anchor }: TooltipProps) {
  return (
    <Portal>
      <div
        className="fixed z-30 rounded-xl bg-[#403770] px-3 py-1.5 text-xs text-white shadow-lg"
        style={{ top: anchor.bottom, left: anchor.left }}
      >
        {content}
      </div>
    </Portal>
  )
}
```

### Custom container

```tsx
const panelEl = document.getElementById("side-panel")

<Portal container={panelEl ?? undefined}>
  <ContextMenu />
</Portal>
```

### Modal inside a portal

```tsx
function App() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)}>Open modal</button>
      <Portal>
        {open && (
          <Modal onClose={() => setOpen(false)} />
        )}
      </Portal>
    </>
  )
}
```

---

## Behavior Notes

- **SSR-safe**: returns `null` during server render. The portal mounts on the client after hydration. If content must be visible before JS loads, do not use a portal.
- Uses `ReactDOM.createPortal` internally. React context and event bubbling work normally — events bubble through the React tree, not the DOM tree.
- The `container` prop is read once on mount. Changing it after mount has no effect — unmount and remount the component if you need to change the target.
- Portals do not create or manage the target container element. The container must already exist in the DOM before the portal renders.
- For modals and overlays, the portal's z-index must still be set on the rendered content — `document.body` does not establish a stacking context.

---

## Related

- [focus-trap.md](./focus-trap.md) — always trap focus inside portaled overlays
- [error-boundary.md](./error-boundary.md) — wrap portal content in an error boundary for isolated error handling
- [_foundations.md](./_foundations.md) — utilities overview
