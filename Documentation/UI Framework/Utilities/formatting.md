# Formatting

Locale-aware number, currency, percent, and compact number formatters. All return `"-"` for null or undefined inputs.

---

## API

```ts
import { formatCurrency, formatNumber, formatPercent, formatCompactNumber } from "@/features/shared/lib/format"
```

All functions are server-safe. File: `format.ts` (no `"use client"` directive).

```ts
formatCurrency(value: number | null | undefined, compact?: boolean): string
formatNumber(value: number | null | undefined): string
formatPercent(value: number | null | undefined, decimals?: number): string
formatCompactNumber(value: number | null | undefined): string
```

### Parameters

| Function | Param | Type | Default | Description |
|----------|-------|------|---------|-------------|
| `formatCurrency` | `value` | `number \| null \| undefined` | — | Dollar amount |
| | `compact` | `boolean` | `false` | Use compact notation (`$1.2M`) |
| `formatPercent` | `value` | `number \| null \| undefined` | — | Decimal value (0–1) or percentage (0–100) |
| | `decimals` | `number` | `1` | Decimal places in output |

---

## Usage

### Currency

```ts
formatCurrency(1234567)        // → "$1,234,567"
formatCurrency(1234567, true)  // → "$1.2M"
formatCurrency(500)            // → "$500"
formatCurrency(0)              // → "$0"
formatCurrency(null)           // → "-"
formatCurrency(undefined)      // → "-"
```

### Numbers

```ts
formatNumber(12345)     // → "12,345"
formatNumber(0)         // → "0"
formatNumber(null)      // → "-"
```

### Percents

```ts
formatPercent(0.752)         // → "75.2%"
formatPercent(0.752, 0)      // → "75%"
formatPercent(0.752, 2)      // → "75.20%"
formatPercent(1)             // → "100.0%"
formatPercent(null)          // → "-"
```

Values are multiplied by 100 before display — pass `0.75` for 75%, not `75`.

### Compact numbers

```ts
formatCompactNumber(1200)       // → "1.2K"
formatCompactNumber(1500000)    // → "1.5M"
formatCompactNumber(999)        // → "999"
formatCompactNumber(null)       // → "-"
```

---

## Behavior Notes

- All formatters use `Intl.NumberFormat` with `en-US` locale for consistent output across environments.
- `formatCurrency` rounds to the nearest dollar (no cents shown).
- `formatCompactNumber` uses compact notation with 1 significant decimal, trimming trailing zeros.
- `formatPercent` accepts values in the range 0–1. Values outside that range display as-is (e.g., `1.5` → `"150.0%"`). Validate before formatting if needed.
- None of these functions throw. They are safe to call in render without a try/catch.

---

## Related

- [pretty-duration.md](./pretty-duration.md) — time and date formatting
- [text-truncation.md](./text-truncation.md) — truncating formatted strings for display
- [_foundations.md](./_foundations.md) — utilities overview
