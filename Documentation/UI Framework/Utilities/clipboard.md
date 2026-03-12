# Clipboard

Copies text to the clipboard as a one-shot async function or a stateful hook with automatic reset.

---

## API

### Pure function — `copy.ts` (server-safe)

```ts
import { copyToClipboard } from "@/features/shared/lib/copy"

copyToClipboard(text: string): Promise<boolean>
```

Returns `true` on success, `false` on failure (e.g., permissions denied, insecure context). Does not throw.

### Hook — `use-copy-to-clipboard.ts` ("use client")

```ts
import { useCopyToClipboard } from "@/features/shared/lib/use-copy-to-clipboard"

useCopyToClipboard(resetMs?: number): {
  copy: (text: string) => Promise<void>
  copied: boolean
  error: Error | null
}
```

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `resetMs` | `number` | `2000` | Milliseconds before `copied` resets to `false` |

---

## Usage

### Pure function

```ts
import { copyToClipboard } from "@/features/shared/lib/copy"

const ok = await copyToClipboard("https://example.com/share/abc123")
if (!ok) {
  console.warn("Clipboard write failed")
}
```

### Hook — basic

```tsx
import { useCopyToClipboard } from "@/features/shared/lib/use-copy-to-clipboard"

function CopyButton({ value }: { value: string }) {
  const { copy, copied } = useCopyToClipboard()

  return (
    <button onClick={() => copy(value)}>
      {copied ? "Copied!" : "Copy link"}
    </button>
  )
}
```

### Hook — with error feedback

```tsx
function ShareButton({ url }: { url: string }) {
  const { copy, copied, error } = useCopyToClipboard(3000)

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => copy(url)}
        className="text-sm font-medium text-[#6EA3BE] hover:text-[#403770] transition-colors"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
      {error && (
        <span className="text-xs text-[#F37167]">Failed to copy</span>
      )}
    </div>
  )
}
```

### Hook — custom reset delay

```tsx
// copied stays true for 5 seconds before resetting
const { copy, copied } = useCopyToClipboard(5000)
```

---

## Behavior Notes

- `copyToClipboard` uses `navigator.clipboard.writeText` when available, falls back to a temporary `<textarea>` + `execCommand("copy")` for older browsers.
- The hook's `copy` function updates `copied` to `true` immediately on success, then schedules a reset via `setTimeout`. The timer is cleared if the component unmounts before it fires.
- Calling `copy` again while `copied` is `true` restarts the reset timer.
- `error` is set when the underlying copy fails; it resets to `null` on the next successful copy.

---

## Related

- [_foundations.md](./_foundations.md) — utilities overview and server/client boundary table
