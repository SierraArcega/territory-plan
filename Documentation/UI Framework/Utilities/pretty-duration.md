# Pretty Duration

Converts dates to human-readable relative or absolute strings — "just now", "5m ago", "yesterday", or a formatted calendar date.

---

## API

```ts
import { timeAgo, timeUntil } from "@/features/shared/lib/pretty-duration"

timeAgo(date: Date | string): string
timeUntil(date: Date | string): string
```

File: `pretty-duration.ts` (no `"use client"` directive — server-safe).

Both functions accept:
- `Date` objects
- ISO 8601 strings (`"2026-03-11T14:30:00Z"`)
- Date-only strings in `YYYY-MM-DD` format (`"2026-03-11"`) — parsed as local time via `parseLocalDate`

---

## Usage

### `timeAgo`

Returns a string describing how long ago the date was, relative to now.

```ts
timeAgo(new Date())                    // → "just now"
timeAgo(new Date(Date.now() - 45000))  // → "just now"  (< 1 minute)
timeAgo(new Date(Date.now() - 300000)) // → "5m ago"
timeAgo(new Date(Date.now() - 10800000)) // → "3h ago"
timeAgo(yesterday)                     // → "yesterday"
timeAgo("2026-03-06")                  // → "5 days ago"
timeAgo("2026-03-04")                  // → "Mar 4"       (> 7 days, same year)
timeAgo("2025-11-15")                  // → "Nov 15, 2025" (different year)
```

### `timeUntil`

Returns a string describing how far in the future the date is, relative to now. Mirror of `timeAgo`.

```ts
timeUntil(tomorrow)                   // → "tomorrow"
timeUntil(inFiveMinutes)              // → "in 5m"
timeUntil(inThreeHours)               // → "in 3h"
timeUntil("2026-03-18")               // → "in 7 days"
timeUntil("2026-04-01")               // → "Apr 1"
```

### In components

```tsx
import { timeAgo } from "@/features/shared/lib/pretty-duration"

function ActivityItem({ activity }: { activity: Activity }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#6E6390]">{activity.title}</span>
      <span className="text-xs text-[#A69DC0]">{timeAgo(activity.createdAt)}</span>
    </div>
  )
}
```

---

## Output Scale

| Condition | `timeAgo` output | `timeUntil` output |
|-----------|-----------------|-------------------|
| < 60 seconds | "just now" | "just now" |
| 1–59 minutes | "5m ago" | "in 5m" |
| 1–23 hours | "3h ago" | "in 3h" |
| ~24 hours | "yesterday" | "tomorrow" |
| 2–7 days | "5 days ago" | "in 5 days" |
| > 7 days, same year | "Mar 4" | "Apr 1" |
| > 7 days, different year | "Nov 15, 2025" | "Dec 1, 2025" |

---

## Behavior Notes

- `YYYY-MM-DD` strings are parsed as **local time** (midnight of that day) to avoid timezone-related off-by-one errors. ISO strings with a `Z` suffix are parsed as UTC per spec.
- Both functions return `"—"` if the input is an invalid date.
- Absolute dates use `Intl.DateTimeFormat` with `en-US` locale.
- These are snapshot functions — they do not subscribe to time changes. For live-updating relative times, call them inside a `setInterval` or use a separate ticker.

---

## Related

- [formatting.md](./formatting.md) — currency and number formatting
- [_foundations.md](./_foundations.md) — utilities overview
