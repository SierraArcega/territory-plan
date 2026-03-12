# Color Utilities

Parse hex colors, apply opacity, and calculate WCAG 2.1 contrast ratios for accessibility checks.

---

## API

```ts
import { hexToRgb, withOpacity, contrastRatio } from "@/features/shared/lib/color-utils"
```

File: `color-utils.ts` (no `"use client"` directive — server-safe).

```ts
hexToRgb(hex: string): { r: number; g: number; b: number } | null

withOpacity(hex: string, opacity: number): string

contrastRatio(hex1: string, hex2: string): number
```

All functions accept 3-character or 6-character hex strings, with or without a leading `#`.

---

## Usage

### `hexToRgb`

Parses a hex color into its RGB components.

```ts
hexToRgb("#403770")   // → { r: 64, g: 55, b: 112 }
hexToRgb("403770")    // → { r: 64, g: 55, b: 112 }
hexToRgb("#F37")      // → { r: 255, g: 51, b: 119 }  (3-char expanded)
hexToRgb("invalid")   // → null
```

### `withOpacity`

Returns a CSS `rgba()` string with the given opacity applied.

```ts
withOpacity("#403770", 1)    // → "rgba(64, 55, 112, 1)"
withOpacity("#403770", 0.5)  // → "rgba(64, 55, 112, 0.5)"
withOpacity("#F37167", 0.15) // → "rgba(243, 113, 103, 0.15)"
```

Useful when Tailwind's arbitrary opacity syntax (`bg-[#403770]/50`) is not available — for example, in inline styles, Canvas 2D drawing, or dynamic CSS custom properties.

```tsx
// In a dynamic inline style
<div style={{ backgroundColor: withOpacity("#C4E7E6", 0.4) }} />
```

### `contrastRatio`

Calculates the WCAG 2.1 contrast ratio between two hex colors. Returns a value from 1 (no contrast, same color) to 21 (maximum contrast, black on white).

```ts
contrastRatio("#403770", "#FFFCFA")  // → ~9.8  (Plum on Off-White — AAA pass)
contrastRatio("#F37167", "#FFFCFA")  // → ~3.4  (Coral on Off-White — AA large only)
contrastRatio("#A69DC0", "#FFFCFA")  // → ~2.8  (Muted — fails AA)
contrastRatio("#403770", "#403770")  // → 1     (same color)
```

WCAG 2.1 thresholds:

| Level | Normal text (< 18pt) | Large text (≥ 18pt or bold ≥ 14pt) |
|-------|---------------------|-------------------------------------|
| AA | ≥ 4.5 | ≥ 3.0 |
| AAA | ≥ 7.0 | ≥ 4.5 |

```ts
function isAccessible(fg: string, bg: string, largeText = false): boolean {
  const ratio = contrastRatio(fg, bg)
  return largeText ? ratio >= 3.0 : ratio >= 4.5
}
```

---

## Behavior Notes

- `hexToRgb` returns `null` for unparseable input rather than throwing. Callers should guard against null when using the result.
- `withOpacity` calls `hexToRgb` internally; returns `"rgba(0, 0, 0, 0)"` as a safe fallback if the hex is invalid.
- `contrastRatio` uses the WCAG 2.1 relative luminance formula with gamma correction (`sRGB` color space). Returns `1` if either color is unparseable.
- These functions operate on hex only. CSS named colors and `hsl()`/`rgb()` strings are not supported.

---

## Brand Integration

Reference values from [tokens.md](../tokens.md) for all color arguments:

| Token | Hex |
|-------|-----|
| Plum | `#403770` |
| Coral | `#F37167` |
| Steel Blue | `#6EA3BE` |
| Robin's Egg | `#C4E7E6` |
| Off-White | `#FFFCFA` |

---

## Related

- [tokens.md](../tokens.md) — brand color definitions
- [search-highlighting.md](./search-highlighting.md) — uses Robin's Egg as highlight background
- [_foundations.md](./_foundations.md) — utilities overview
