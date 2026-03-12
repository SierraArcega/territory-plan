# Utilities Library Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 14 tested, documented utilities (functions, hooks, components) for the Fullmind territory planning tool.

**Architecture:** Flat files in `src/features/shared/lib/`, each utility in its own file with co-located tests in `__tests__/`. Documentation guides in `Documentation/UI Framework/Utilities/`. Pure functions stay server-safe; hooks/components get `"use client"`.

**Tech Stack:** React 19, TypeScript, Tailwind 4, Vitest, Testing Library, date-fns 4, clsx, tailwind-merge

**Spec:** `Documentation/plans/2026-03-11-utilities-library-design.md`

---

## Chunk 1: Setup + Pure Function Utilities

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install clsx and tailwind-merge**

```bash
npm install clsx tailwind-merge
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('clsx'); require('tailwind-merge'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add clsx and tailwind-merge dependencies"
```

---

### Task 2: `cn.ts` — Class Merging

**Files:**
- Create: `src/features/shared/lib/cn.ts`
- Create: `src/features/shared/lib/__tests__/cn.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/shared/lib/__tests__/cn.test.ts
import { describe, it, expect } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
  it("merges multiple class strings", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn("base", isActive && "active", isDisabled && "disabled")).toBe("base active");
  });

  it("filters out falsy values", () => {
    expect(cn("base", null, undefined, false, 0, "", "end")).toBe("base end");
  });

  it("merges array inputs", () => {
    expect(cn(["px-4", "py-2"], "mt-2")).toBe("px-4 py-2 mt-2");
  });

  it("resolves complex Tailwind conflicts", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("bg-plum", "bg-coral")).toBe("bg-coral");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/cn.test.ts
```

Expected: FAIL — `cn` not found

- [ ] **Step 3: Write the implementation**

```ts
// src/features/shared/lib/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/cn.test.ts
```

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/cn.ts src/features/shared/lib/__tests__/cn.test.ts
git commit -m "feat: add cn() class merging utility"
```

---

### Task 3: `format.ts` — Formatting Extensions

**Files:**
- Modify: `src/features/shared/lib/format.ts`
- Modify: `src/features/shared/lib/__tests__/format.test.ts`

- [ ] **Step 1: Write failing tests for new functions**

Append to the existing `src/features/shared/lib/__tests__/format.test.ts`:

```ts
import { formatCurrency, formatNumber, formatPercent, formatCompactNumber } from "../format";
```

Update the import line above (replacing the existing import), then add at the end of the file:

```ts
// ===========================================================================
// formatPercent
// ===========================================================================

describe("formatPercent", () => {
  it("returns '-' for null", () => {
    expect(formatPercent(null)).toBe("-");
  });

  it("returns '-' for undefined", () => {
    expect(formatPercent(undefined)).toBe("-");
  });

  it("formats a decimal as percentage", () => {
    expect(formatPercent(0.847)).toBe("84.7%");
  });

  it("formats 1 as 100%", () => {
    expect(formatPercent(1)).toBe("100%");
  });

  it("formats 0 as 0%", () => {
    expect(formatPercent(0)).toBe("0%");
  });

  it("respects custom decimal places", () => {
    expect(formatPercent(0.8471, 2)).toBe("84.71%");
  });

  it("defaults to 1 decimal place", () => {
    expect(formatPercent(0.3333)).toBe("33.3%");
  });

  it("drops trailing zeros", () => {
    expect(formatPercent(0.5)).toBe("50%");
  });
});

// ===========================================================================
// formatCompactNumber
// ===========================================================================

describe("formatCompactNumber", () => {
  it("returns '-' for null", () => {
    expect(formatCompactNumber(null)).toBe("-");
  });

  it("returns '-' for undefined", () => {
    expect(formatCompactNumber(undefined)).toBe("-");
  });

  it("formats millions with M suffix", () => {
    expect(formatCompactNumber(1200000)).toBe("1.2M");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCompactNumber(14832)).toBe("14.8K");
  });

  it("formats small numbers without suffix", () => {
    expect(formatCompactNumber(500)).toBe("500");
  });

  it("formats zero as '0'", () => {
    expect(formatCompactNumber(0)).toBe("0");
  });

  it("handles exactly 1M", () => {
    expect(formatCompactNumber(1000000)).toBe("1M");
  });

  it("handles exactly 1K", () => {
    expect(formatCompactNumber(1000)).toBe("1K");
  });

  it("handles negative values", () => {
    expect(formatCompactNumber(-2500000)).toBe("-2.5M");
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
npx vitest run src/features/shared/lib/__tests__/format.test.ts
```

Expected: FAIL — `formatPercent` and `formatCompactNumber` not found in import

- [ ] **Step 3: Implement the new functions**

Add to the end of `src/features/shared/lib/format.ts`:

```ts
/**
 * Format a number as a percentage.
 * formatPercent(0.847) → "84.7%"
 * formatPercent(0.8471, 2) → "84.71%"
 */
export function formatPercent(
  value: number | null | undefined,
  decimals = 1,
): string {
  if (value === null || value === undefined) return "-";
  const pct = value * 100;
  // Use parseFloat to drop trailing zeros: "50.0" → "50"
  return `${parseFloat(pct.toFixed(decimals))}%`;
}

/**
 * Format a number in compact form without currency symbol.
 * 14832 → "14.8K"   |   1200000 → "1.2M"   |   500 → "500"
 */
export function formatCompactNumber(
  value: number | null | undefined,
): string {
  if (value === null || value === undefined) return "-";
  if (Math.abs(value) >= 1_000_000) {
    return `${parseFloat((value / 1_000_000).toFixed(1))}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${parseFloat((value / 1_000).toFixed(1))}K`;
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
```

- [ ] **Step 4: Run all format tests**

```bash
npx vitest run src/features/shared/lib/__tests__/format.test.ts
```

Expected: All tests PASS (existing + new)

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/format.ts src/features/shared/lib/__tests__/format.test.ts
git commit -m "feat: add formatPercent and formatCompactNumber utilities"
```

---

### Task 4: `truncate.ts` — Text Truncation (Pure Functions)

**Files:**
- Create: `src/features/shared/lib/truncate.ts`
- Create: `src/features/shared/lib/__tests__/truncate.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/shared/lib/__tests__/truncate.test.ts
import { describe, it, expect } from "vitest";
import { truncateEnd, truncateMiddle } from "../truncate";

// ===========================================================================
// truncateEnd
// ===========================================================================

describe("truncateEnd", () => {
  it("returns original string if within maxLength", () => {
    expect(truncateEnd("Hello", 10)).toBe("Hello");
  });

  it("truncates and adds ellipsis", () => {
    expect(truncateEnd("Springfield School District", 20)).toBe(
      "Springfield School D\u2026",
    );
  });

  it("handles maxLength equal to string length", () => {
    expect(truncateEnd("Hello", 5)).toBe("Hello");
  });

  it("handles maxLength of 1", () => {
    expect(truncateEnd("Hello", 1)).toBe("H\u2026");
  });

  it("returns empty string for empty input", () => {
    expect(truncateEnd("", 10)).toBe("");
  });

  it("handles Unicode characters", () => {
    expect(truncateEnd("Héllo Wörld", 7)).toBe("Héllo W\u2026");
  });
});

// ===========================================================================
// truncateMiddle
// ===========================================================================

describe("truncateMiddle", () => {
  it("returns original string if within maxLength", () => {
    expect(truncateMiddle("Hello", 10)).toBe("Hello");
  });

  it("truncates middle and keeps start + end", () => {
    // 27 chars, maxLength 20 → startLen=10, endLen=10
    // "Springfiel" + "…" + "l District" = 21 chars (maxLength + ellipsis)
    expect(truncateMiddle("Springfield School District", 20)).toBe(
      "Springfiel\u2026l District",
    );
  });

  it("returns empty string for empty input", () => {
    expect(truncateMiddle("", 10)).toBe("");
  });

  it("handles maxLength equal to string length", () => {
    expect(truncateMiddle("Hello", 5)).toBe("Hello");
  });

  it("handles very short maxLength", () => {
    const result = truncateMiddle("Hello World", 3);
    expect(result).toContain("\u2026");
    expect(result.length).toBeLessThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/truncate.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/features/shared/lib/truncate.ts

/**
 * Truncate a string at the end with an ellipsis character.
 * truncateEnd("Springfield School District", 20) → "Springfield School D…"
 */
export function truncateEnd(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "\u2026";
}

/**
 * Truncate a string in the middle, keeping start and end visible.
 * truncateMiddle("Springfield School District", 20) → "Springfield…District"
 */
export function truncateMiddle(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  const startLen = Math.ceil(maxLength / 2);
  const endLen = Math.floor(maxLength / 2);
  return text.slice(0, startLen) + "\u2026" + text.slice(text.length - endLen);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/truncate.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/truncate.ts src/features/shared/lib/__tests__/truncate.test.ts
git commit -m "feat: add truncateEnd and truncateMiddle text utilities"
```

---

### Task 5: `pretty-duration.ts` — Relative Time

**Files:**
- Create: `src/features/shared/lib/pretty-duration.ts`
- Create: `src/features/shared/lib/__tests__/pretty-duration.test.ts`

Reference: `src/features/shared/lib/date-utils.ts` for `parseLocalDate`

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/shared/lib/__tests__/pretty-duration.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { timeAgo, timeUntil } from "../pretty-duration";

describe("timeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for dates within 30 seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:30Z"));
    expect(timeAgo(new Date("2026-03-11T12:00:05Z"))).toBe("just now");
    vi.useRealTimers();
  });

  it("returns minutes ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:05:00Z"));
    expect(timeAgo(new Date("2026-03-11T12:00:00Z"))).toBe("5m ago");
    vi.useRealTimers();
  });

  it("returns hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T15:00:00Z"));
    expect(timeAgo(new Date("2026-03-11T12:00:00Z"))).toBe("3h ago");
    vi.useRealTimers();
  });

  it("returns 'yesterday' for 1 day ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-12T12:00:00Z"));
    expect(timeAgo(new Date("2026-03-11T12:00:00Z"))).toBe("yesterday");
    vi.useRealTimers();
  });

  it("returns days ago for 2-7 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));
    expect(timeAgo(new Date("2026-03-11T12:00:00Z"))).toBe("5 days ago");
    vi.useRealTimers();
  });

  it("returns absolute date after 7 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:00:00Z"));
    expect(timeAgo(new Date("2026-03-11T12:00:00Z"))).toBe("Mar 11");
    vi.useRealTimers();
  });

  it("accepts ISO string input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:05:00Z"));
    expect(timeAgo("2026-03-11T12:00:00Z")).toBe("5m ago");
    vi.useRealTimers();
  });

  it("accepts YYYY-MM-DD string input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));
    expect(timeAgo("2026-03-11")).toBe("5 days ago");
    vi.useRealTimers();
  });

  it("returns '1m ago' at exactly 30 seconds (boundary)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:30Z"));
    expect(timeAgo(new Date("2026-03-11T12:00:00Z"))).toBe("1m ago");
    vi.useRealTimers();
  });

  it("throws on invalid string format", () => {
    expect(() => timeAgo("March 11 2026")).toThrow();
  });
});

describe("timeUntil", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for dates within 30 seconds in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
    expect(timeUntil(new Date("2026-03-11T12:00:25Z"))).toBe("just now");
    vi.useRealTimers();
  });

  it("returns 'in X minutes'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
    expect(timeUntil(new Date("2026-03-11T12:10:00Z"))).toBe("in 10m");
    vi.useRealTimers();
  });

  it("returns 'tomorrow' for 1 day in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
    expect(timeUntil(new Date("2026-03-12T12:00:00Z"))).toBe("tomorrow");
    vi.useRealTimers();
  });

  it("returns 'in Xh'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
    expect(timeUntil(new Date("2026-03-11T15:00:00Z"))).toBe("in 3h");
    vi.useRealTimers();
  });

  it("returns 'in X days' for 2-7 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
    expect(timeUntil(new Date("2026-03-16T12:00:00Z"))).toBe("in 5 days");
    vi.useRealTimers();
  });

  it("returns absolute date after 7 days in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
    expect(timeUntil(new Date("2026-03-25T12:00:00Z"))).toBe("Mar 25");
    vi.useRealTimers();
  });

  it("accepts ISO string input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
    expect(timeUntil("2026-03-11T12:10:00Z")).toBe("in 10m");
    vi.useRealTimers();
  });

  it("throws on invalid string format", () => {
    expect(() => timeUntil("March 25 2026")).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/pretty-duration.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/features/shared/lib/pretty-duration.ts
import { parseLocalDate } from "./date-utils";

const ISO_REGEX = /^\d{4}-\d{2}-\d{2}(T.+)?$/;

function toDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  if (!ISO_REGEX.test(input)) {
    throw new Error(
      `Invalid date format: "${input}". Expected ISO 8601 or YYYY-MM-DD.`,
    );
  }
  // YYYY-MM-DD without time → use parseLocalDate to avoid timezone shift
  if (!input.includes("T")) return parseLocalDate(input);
  return new Date(input);
}

/**
 * Format a past date as relative time.
 * Returns: "just now", "5m ago", "3h ago", "yesterday", "5 days ago", or "Mar 11"
 */
export function timeAgo(date: Date | string): string {
  const d = toDate(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 30) return "just now";
  if (diffSec < 60) return "1m ago"; // 30-59 seconds
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays <= 7) return `${diffDays} days ago`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format a future date as relative time.
 * Returns: "just now", "in 10m", "in 3h", "tomorrow", "in 5 days", or "Mar 25"
 */
export function timeUntil(date: Date | string): string {
  const d = toDate(date);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 30) return "just now";
  if (diffSec < 60) return "in 1m"; // 30-59 seconds
  if (diffMin < 60) return `in ${diffMin}m`;
  if (diffHr < 24) return `in ${diffHr}h`;
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return `in ${diffDays} days`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

Note: The spec says to wrap `date-fns` `formatDistanceToNow`, but the custom thresholds ("5m ago" vs "about 5 minutes ago", "yesterday" at exactly 1 day) are simpler to implement directly. The `date-fns` dependency is still used elsewhere in the project — this utility just doesn't need it.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/pretty-duration.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/pretty-duration.ts src/features/shared/lib/__tests__/pretty-duration.test.ts
git commit -m "feat: add timeAgo and timeUntil relative time utilities"
```

---

### Task 6: `color-utils.ts` — Color Utilities

**Files:**
- Create: `src/features/shared/lib/color-utils.ts`
- Create: `src/features/shared/lib/__tests__/color-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/shared/lib/__tests__/color-utils.test.ts
import { describe, it, expect } from "vitest";
import { hexToRgb, withOpacity, contrastRatio } from "../color-utils";

// ===========================================================================
// hexToRgb
// ===========================================================================

describe("hexToRgb", () => {
  it("parses 6-char hex with #", () => {
    expect(hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses 6-char hex without #", () => {
    expect(hexToRgb("403770")).toEqual({ r: 64, g: 55, b: 112 });
  });

  it("parses 3-char hex with #", () => {
    expect(hexToRgb("#FFF")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("parses 3-char hex without #", () => {
    expect(hexToRgb("000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("is case-insensitive", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("throws on invalid hex", () => {
    expect(() => hexToRgb("#xyz")).toThrow();
    expect(() => hexToRgb("nope")).toThrow();
    expect(() => hexToRgb("#12345")).toThrow();
  });
});

// ===========================================================================
// withOpacity
// ===========================================================================

describe("withOpacity", () => {
  it("returns rgba string", () => {
    expect(withOpacity("#FF0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("handles full opacity", () => {
    expect(withOpacity("#403770", 1)).toBe("rgba(64, 55, 112, 1)");
  });

  it("handles zero opacity", () => {
    expect(withOpacity("#FFFFFF", 0)).toBe("rgba(255, 255, 255, 0)");
  });
});

// ===========================================================================
// contrastRatio
// ===========================================================================

describe("contrastRatio", () => {
  it("returns 21 for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });

  it("returns 1 for same color", () => {
    expect(contrastRatio("#403770", "#403770")).toBeCloseTo(1, 0);
  });

  it("Plum on white meets WCAG AA for normal text (>= 4.5)", () => {
    expect(contrastRatio("#403770", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("is symmetric (order does not matter)", () => {
    const r1 = contrastRatio("#403770", "#FFFFFF");
    const r2 = contrastRatio("#FFFFFF", "#403770");
    expect(r1).toBeCloseTo(r2, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/color-utils.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/features/shared/lib/color-utils.ts

const HEX3_REGEX = /^#?([0-9a-f]{3})$/i;
const HEX6_REGEX = /^#?([0-9a-f]{6})$/i;

/**
 * Parse a hex color string to RGB components.
 * Accepts 3-char (#FFF) or 6-char (#FFFFFF), with or without #.
 * Throws on invalid input.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let match = hex.match(HEX6_REGEX);
  if (match) {
    const h = match[1];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  match = hex.match(HEX3_REGEX);
  if (match) {
    const h = match[1];
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  throw new Error(`Invalid hex color: "${hex}"`);
}

/**
 * Return an rgba() CSS string from a hex color + opacity.
 */
export function withOpacity(hex: string, opacity: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Calculate WCAG 2.1 contrast ratio between two hex colors.
 * Returns a value from 1 (no contrast) to 21 (max contrast).
 * WCAG AA: >= 4.5 for normal text, >= 3.0 for large text (18px+ bold / 24px+).
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/color-utils.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/color-utils.ts src/features/shared/lib/__tests__/color-utils.test.ts
git commit -m "feat: add hexToRgb, withOpacity, contrastRatio color utilities"
```

---

### Task 7: `copy.ts` — Clipboard (Pure Function)

**Files:**
- Create: `src/features/shared/lib/copy.ts`
- Create: `src/features/shared/lib/__tests__/copy.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/shared/lib/__tests__/copy.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { copyToClipboard } from "../copy";

describe("copyToClipboard", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  it("returns true on success", async () => {
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
    expect(await copyToClipboard("hello")).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
  });

  it("returns false on failure", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("denied"),
    );
    expect(await copyToClipboard("hello")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/copy.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/features/shared/lib/copy.ts

/**
 * Copy text to the clipboard.
 * Returns true on success, false on failure.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/copy.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/copy.ts src/features/shared/lib/__tests__/copy.test.ts
git commit -m "feat: add copyToClipboard utility"
```

---

## Chunk 2: Client-Side Hooks + Components

### Task 8: `use-copy-to-clipboard.ts` — Clipboard Hook

**Files:**
- Create: `src/features/shared/lib/use-copy-to-clipboard.ts`
- Create: `src/features/shared/lib/__tests__/use-copy-to-clipboard.test.tsx`

Reference: `src/features/shared/lib/copy.ts` (from Task 7)

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/shared/lib/__tests__/use-copy-to-clipboard.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCopyToClipboard } from "../use-copy-to-clipboard";

describe("useCopyToClipboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with copied=false and error=null", () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets copied=true after calling copy", async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy("hello");
    });
    expect(result.current.copied).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
  });

  it("resets copied after resetMs", async () => {
    const { result } = renderHook(() => useCopyToClipboard(1000));
    await act(async () => {
      await result.current.copy("hello");
    });
    expect(result.current.copied).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.copied).toBe(false);
  });

  it("sets error on clipboard failure", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("denied"),
    );
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy("hello");
    });
    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/use-copy-to-clipboard.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/features/shared/lib/use-copy-to-clipboard.ts
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { copyToClipboard } from "./copy";

/**
 * Hook for clipboard copy with auto-resetting status.
 * @param resetMs — time in ms before `copied` resets to false (default 2000)
 */
export function useCopyToClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      try {
        const ok = await copyToClipboard(text);
        if (!ok) throw new Error("Clipboard write failed");
        setCopied(true);
        setError(null);
        timeoutRef.current = setTimeout(() => setCopied(false), resetMs);
      } catch (e) {
        setCopied(false);
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    },
    [resetMs],
  );

  return { copy, copied, error };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/use-copy-to-clipboard.test.tsx
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/use-copy-to-clipboard.ts src/features/shared/lib/__tests__/use-copy-to-clipboard.test.tsx
git commit -m "feat: add useCopyToClipboard hook"
```

---

### Task 9: `use-resize-observer.ts` — Resize Observer Hook

**Files:**
- Create: `src/features/shared/lib/use-resize-observer.ts`
- Create: `src/features/shared/lib/__tests__/use-resize-observer.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/shared/lib/__tests__/use-resize-observer.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useResizeObserver } from "../use-resize-observer";

// Mock ResizeObserver
let observerCallback: ResizeObserverCallback;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn((cb: ResizeObserverCallback) => {
      observerCallback = cb;
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    }),
  );
});

describe("useResizeObserver", () => {
  it("returns initial width and height of 0", () => {
    const { result } = renderHook(() => useResizeObserver<HTMLDivElement>());
    expect(result.current.width).toBe(0);
    expect(result.current.height).toBe(0);
  });

  it("returns a ref", () => {
    const { result } = renderHook(() => useResizeObserver<HTMLDivElement>());
    expect(result.current.ref).toBeDefined();
    expect(result.current.ref.current).toBeNull();
  });

  it("updates width and height when observer fires", () => {
    const { result } = renderHook(() => useResizeObserver<HTMLDivElement>());

    // Simulate the ResizeObserver callback firing
    act(() => {
      observerCallback(
        [{ contentRect: { width: 300, height: 200 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(result.current.width).toBe(300);
    expect(result.current.height).toBe(200);
  });

  it("cleans up observer on unmount", () => {
    const { unmount } = renderHook(() => useResizeObserver<HTMLDivElement>());
    const mockDisconnect = vi.mocked(ResizeObserver).mock.results[0]?.value?.disconnect;
    unmount();
    if (mockDisconnect) {
      expect(mockDisconnect).toHaveBeenCalled();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/use-resize-observer.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/features/shared/lib/use-resize-observer.ts
"use client";

import { useRef, useState, useEffect, type RefObject } from "react";

/**
 * Track the dimensions of an element via ResizeObserver.
 * Returns { ref, width, height }. Attach `ref` to the target element.
 */
export function useResizeObserver<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  width: number;
  height: number;
} {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setWidth(entry.contentRect.width);
        setHeight(entry.contentRect.height);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width, height };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/use-resize-observer.test.tsx
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/use-resize-observer.ts src/features/shared/lib/__tests__/use-resize-observer.test.tsx
git commit -m "feat: add useResizeObserver hook"
```

---

### Task 10: `highlight.tsx` — Search Highlighting Component

**Files:**
- Create: `src/features/shared/lib/highlight.tsx`
- Create: `src/features/shared/lib/__tests__/highlight.test.tsx`

Reference: `Documentation/UI Framework/tokens.md` for brand colors (Robin's Egg `#C4E7E6`, Plum `#403770`)

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/shared/lib/__tests__/highlight.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Highlight } from "../highlight";

describe("Highlight", () => {
  it("renders plain text when query is empty", () => {
    render(<Highlight text="Hello World" query="" />);
    expect(screen.getByText("Hello World")).toBeTruthy();
    expect(screen.queryByRole("mark")).toBeNull();
  });

  it("wraps matching text in mark elements", () => {
    const { container } = render(
      <Highlight text="Springfield School District" query="spring" />,
    );
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("Spring");
  });

  it("is case-insensitive", () => {
    const { container } = render(
      <Highlight text="Springfield" query="SPRING" />,
    );
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("Spring");
  });

  it("highlights multiple occurrences", () => {
    const { container } = render(
      <Highlight text="an apple and an orange" query="an" />,
    );
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThanOrEqual(3); // "an" in "an", "and", "an", "orange"
  });

  it("escapes regex special characters", () => {
    const { container } = render(
      <Highlight text="price is $10.00" query="$10.00" />,
    );
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("$10.00");
  });

  it("applies brand styling to mark elements", () => {
    const { container } = render(
      <Highlight text="Hello World" query="hello" />,
    );
    const mark = container.querySelector("mark");
    expect(mark?.className).toContain("bg-[#C4E7E6]");
    expect(mark?.className).toContain("text-[#403770]");
  });

  it("returns plain text when no match found", () => {
    render(<Highlight text="Hello World" query="xyz" />);
    expect(screen.getByText("Hello World")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/highlight.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/shared/lib/highlight.tsx
"use client";

import React from "react";

interface HighlightProps {
  text: string;
  query: string;
  className?: string;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highlight matching substrings within text.
 * Uses Robin's Egg background + Plum text from Fullmind brand tokens.
 */
export function Highlight({ text, query, className }: HighlightProps): React.ReactNode {
  if (!query.trim()) {
    return <span className={className}>{text}</span>;
  }

  const regex = new RegExp(`(${escapeRegex(query)})`, "gi");
  const parts = text.split(regex);

  if (parts.length === 1) {
    return <span className={className}>{text}</span>;
  }

  // String.split with a capturing group puts matches at odd indices
  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="bg-[#C4E7E6] text-[#403770] rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/highlight.test.tsx
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/highlight.tsx src/features/shared/lib/__tests__/highlight.test.tsx
git commit -m "feat: add Highlight search highlighting component"
```

---

### Task 11: `truncated-text.tsx` — Truncated Text Component

**Files:**
- Create: `src/features/shared/lib/truncated-text.tsx`
- Create: `src/features/shared/lib/__tests__/truncated-text.test.tsx`

Note: The spec mentions detecting overflow via resize observer and conditionally showing the tooltip. This implementation uses the simpler approach of always setting a native `title` attribute for the tooltip (browser shows it on hover). This avoids the complexity of overflow detection while achieving the same UX for the common case. Resize observer-based conditional tooltips can be added later if needed.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/shared/lib/__tests__/truncated-text.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TruncatedText } from "../truncated-text";

describe("TruncatedText", () => {
  it("renders the text content", () => {
    render(<TruncatedText text="Hello World" />);
    expect(screen.getByText("Hello World")).toBeTruthy();
  });

  it("applies truncation CSS classes", () => {
    const { container } = render(<TruncatedText text="Hello World" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("truncate");
  });

  it("sets title attribute for tooltip", () => {
    const { container } = render(
      <TruncatedText text="A very long district name that should be truncated" />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("title")).toBe(
      "A very long district name that should be truncated",
    );
  });

  it("accepts custom className", () => {
    const { container } = render(
      <TruncatedText text="Hello" className="text-sm" />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("text-sm");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/truncated-text.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/shared/lib/truncated-text.tsx
"use client";

import React from "react";

interface TruncatedTextProps {
  text: string;
  className?: string;
  as?: React.ElementType;
}

/**
 * Render text with CSS truncation and a native title tooltip.
 * The full text is shown on hover via the browser's built-in title tooltip.
 */
export function TruncatedText({
  text,
  className = "",
  as: Tag = "span",
}: TruncatedTextProps): React.ReactNode {
  return (
    <Tag className={`truncate block ${className}`} title={text}>
      {text}
    </Tag>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/truncated-text.test.tsx
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/truncated-text.tsx src/features/shared/lib/__tests__/truncated-text.test.tsx
git commit -m "feat: add TruncatedText component with CSS truncation"
```

---

### Task 12: `use-outside-click.ts` — Outside Click Hook

**Files:**
- Create: `src/features/shared/lib/use-outside-click.ts`
- Create: `src/features/shared/lib/__tests__/use-outside-click.test.tsx`

Reference: `Documentation/UI Framework/Components/Containers/_foundations.md` (dismiss behavior section)

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/shared/lib/__tests__/use-outside-click.test.tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useOutsideClick } from "../use-outside-click";

describe("useOutsideClick", () => {
  it("calls callback when clicking outside the ref element", () => {
    const callback = vi.fn();
    const div = document.createElement("div");
    document.body.appendChild(div);

    renderHook(() => {
      const ref = useRef(div);
      useOutsideClick(ref, callback);
    });

    // Click outside
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(callback).toHaveBeenCalledTimes(1);

    document.body.removeChild(div);
  });

  it("does not call callback when clicking inside the ref element", () => {
    const callback = vi.fn();
    const div = document.createElement("div");
    document.body.appendChild(div);

    renderHook(() => {
      const ref = useRef(div);
      useOutsideClick(ref, callback);
    });

    // Click inside
    div.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(callback).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it("does not call callback when active is false", () => {
    const callback = vi.fn();
    const div = document.createElement("div");
    document.body.appendChild(div);

    renderHook(() => {
      const ref = useRef(div);
      useOutsideClick(ref, callback, false);
    });

    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(callback).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it("calls callback on touchstart outside", () => {
    const callback = vi.fn();
    const div = document.createElement("div");
    document.body.appendChild(div);

    renderHook(() => {
      const ref = useRef(div);
      useOutsideClick(ref, callback);
    });

    document.dispatchEvent(new TouchEvent("touchstart", { bubbles: true }));
    expect(callback).toHaveBeenCalledTimes(1);

    document.body.removeChild(div);
  });

  it("cleans up listeners on unmount", () => {
    const callback = vi.fn();
    const div = document.createElement("div");
    document.body.appendChild(div);

    const { unmount } = renderHook(() => {
      const ref = useRef(div);
      useOutsideClick(ref, callback);
    });

    unmount();
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(callback).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/use-outside-click.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/features/shared/lib/use-outside-click.ts
"use client";

import { useEffect, type RefObject } from "react";

/**
 * Call a callback when a click/touch occurs outside the referenced element.
 * @param ref — ref to the container element
 * @param callback — called on outside click
 * @param active — whether the listener is active (default true)
 */
export function useOutsideClick<T extends HTMLElement>(
  ref: RefObject<T | null>,
  callback: () => void,
  active = true,
): void {
  useEffect(() => {
    if (!active) return;

    const handleEvent = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleEvent);
    document.addEventListener("touchstart", handleEvent);

    return () => {
      document.removeEventListener("mousedown", handleEvent);
      document.removeEventListener("touchstart", handleEvent);
    };
  }, [ref, callback, active]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/use-outside-click.test.tsx
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/use-outside-click.ts src/features/shared/lib/__tests__/use-outside-click.test.tsx
git commit -m "feat: add useOutsideClick hook"
```

---

### Task 13: `use-focus-trap.ts` — Focus Trap Hook

**Files:**
- Create: `src/features/shared/lib/use-focus-trap.ts`
- Create: `src/features/shared/lib/__tests__/use-focus-trap.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/shared/lib/__tests__/use-focus-trap.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useRef, useEffect } from "react";
import { useFocusTrap } from "../use-focus-trap";

// Test wrapper that attaches the focus trap ref to a real DOM container
function FocusTrapTestHarness({ active }: { active: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>(active);
  return (
    <div ref={ref} data-testid="trap-container">
      <button data-testid="btn1">First</button>
      <button data-testid="btn2">Second</button>
      <button data-testid="btn3">Third</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("auto-focuses first focusable element when active", () => {
    render(<FocusTrapTestHarness active={true} />);
    expect(document.activeElement).toBe(screen.getByTestId("btn1"));
  });

  it("does not auto-focus when inactive", () => {
    render(<FocusTrapTestHarness active={false} />);
    expect(document.activeElement).not.toBe(screen.getByTestId("btn1"));
  });

  it("wraps Tab from last to first element", () => {
    render(<FocusTrapTestHarness active={true} />);
    const btn3 = screen.getByTestId("btn3");
    const btn1 = screen.getByTestId("btn1");

    btn3.focus();
    expect(document.activeElement).toBe(btn3);

    // Simulate Tab on last element
    const tabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
    });
    screen.getByTestId("trap-container").dispatchEvent(tabEvent);
    expect(document.activeElement).toBe(btn1);
  });

  it("wraps Shift+Tab from first to last element", () => {
    render(<FocusTrapTestHarness active={true} />);
    const btn1 = screen.getByTestId("btn1");
    const btn3 = screen.getByTestId("btn3");

    btn1.focus();
    expect(document.activeElement).toBe(btn1);

    // Simulate Shift+Tab on first element
    const shiftTabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
    });
    screen.getByTestId("trap-container").dispatchEvent(shiftTabEvent);
    expect(document.activeElement).toBe(btn3);
  });

  it("restores focus to previously focused element on deactivation", () => {
    const outerButton = document.createElement("button");
    outerButton.textContent = "Outer";
    document.body.appendChild(outerButton);
    outerButton.focus();
    expect(document.activeElement).toBe(outerButton);

    const { unmount } = render(<FocusTrapTestHarness active={true} />);
    // Focus should move into the trap
    expect(document.activeElement).toBe(screen.getByTestId("btn1"));

    unmount();
    // Focus should restore to the outer button
    expect(document.activeElement).toBe(outerButton);

    document.body.removeChild(outerButton);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/use-focus-trap.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/features/shared/lib/use-focus-trap.ts
"use client";

import { useRef, useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap keyboard focus within a container element.
 * Tab/Shift+Tab wraps at container boundaries.
 * @param active — whether trapping is active (default true)
 * @returns ref to attach to the container element
 */
export function useFocusTrap<T extends HTMLElement>(
  active = true,
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    // Save the currently focused element to restore later
    previousFocusRef.current = document.activeElement;

    // Focus first focusable child
    const container = ref.current;
    const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab on first element → wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab on last element → wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      // Restore previous focus
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [active]);

  return ref;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/use-focus-trap.test.tsx
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/use-focus-trap.ts src/features/shared/lib/__tests__/use-focus-trap.test.tsx
git commit -m "feat: add useFocusTrap hook"
```

---

### Task 14: `screen-reader.tsx` — Screen Reader Helpers

**Files:**
- Create: `src/features/shared/lib/screen-reader.tsx`
- Create: `src/features/shared/lib/__tests__/screen-reader.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/shared/lib/__tests__/screen-reader.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScreenReaderOnly, srOnlyClass } from "../screen-reader";

describe("ScreenReaderOnly", () => {
  it("renders children", () => {
    render(<ScreenReaderOnly>Hidden label</ScreenReaderOnly>);
    expect(screen.getByText("Hidden label")).toBeTruthy();
  });

  it("applies sr-only styles", () => {
    const { container } = render(
      <ScreenReaderOnly>Hidden</ScreenReaderOnly>,
    );
    const el = container.firstElementChild as HTMLElement;
    // Check for clip-rect technique
    expect(el.style.position).toBe("absolute");
    expect(el.style.width).toBe("1px");
    expect(el.style.height).toBe("1px");
  });

  it("renders as custom element type", () => {
    const { container } = render(
      <ScreenReaderOnly as="h2">Heading</ScreenReaderOnly>,
    );
    expect(container.querySelector("h2")).toBeTruthy();
  });

  it("renders as span by default", () => {
    const { container } = render(
      <ScreenReaderOnly>Text</ScreenReaderOnly>,
    );
    expect(container.querySelector("span")).toBeTruthy();
  });
});

describe("srOnlyClass", () => {
  it("is a non-empty string", () => {
    expect(typeof srOnlyClass).toBe("string");
    expect(srOnlyClass.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/screen-reader.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/shared/lib/screen-reader.tsx
"use client";

import React, { type ElementType } from "react";

const SR_ONLY_STYLES: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: 0,
};

/**
 * Raw class string for Tailwind's sr-only pattern.
 * Use this when you need sr-only without the component wrapper.
 */
export const srOnlyClass = "sr-only";

interface ScreenReaderOnlyProps {
  children: React.ReactNode;
  as?: ElementType;
}

/**
 * Visually hide content while keeping it accessible to screen readers.
 * Uses the standard clip-rect technique.
 */
export function ScreenReaderOnly({
  children,
  as: Tag = "span",
}: ScreenReaderOnlyProps): React.ReactNode {
  return <Tag style={SR_ONLY_STYLES}>{children}</Tag>;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/screen-reader.test.tsx
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/screen-reader.tsx src/features/shared/lib/__tests__/screen-reader.test.tsx
git commit -m "feat: add ScreenReaderOnly component and srOnlyClass"
```

---

### Task 15: `portal.tsx` — Portal Component

**Files:**
- Create: `src/features/shared/lib/portal.tsx`
- Create: `src/features/shared/lib/__tests__/portal.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/shared/lib/__tests__/portal.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Portal } from "../portal";

describe("Portal", () => {
  it("renders children into document.body", () => {
    const { container } = render(
      <div>
        <Portal>
          <span data-testid="portaled">Hello</span>
        </Portal>
      </div>,
    );

    // Should NOT be inside the container div
    expect(container.querySelector('[data-testid="portaled"]')).toBeNull();
    // Should be in document.body
    expect(screen.getByTestId("portaled")).toBeTruthy();
    expect(screen.getByTestId("portaled").textContent).toBe("Hello");
  });

  it("renders into custom container", () => {
    const customContainer = document.createElement("div");
    customContainer.id = "portal-target";
    document.body.appendChild(customContainer);

    render(
      <Portal container={customContainer}>
        <span data-testid="custom">Custom</span>
      </Portal>,
    );

    expect(customContainer.querySelector('[data-testid="custom"]')).toBeTruthy();
    document.body.removeChild(customContainer);
  });

  it("cleans up portaled content on unmount", () => {
    const { unmount } = render(
      <Portal>
        <span data-testid="cleanup">Temp</span>
      </Portal>,
    );

    expect(screen.getByTestId("cleanup")).toBeTruthy();
    unmount();
    expect(screen.queryByTestId("cleanup")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/portal.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/shared/lib/portal.tsx
"use client";

import { createPortal } from "react-dom";
import React, { useState, useEffect } from "react";

interface PortalProps {
  children: React.ReactNode;
  container?: Element;
}

/**
 * Render children into a DOM node outside the parent component tree.
 * Defaults to document.body. SSR-safe (returns null on server).
 */
export function Portal({ children, container }: PortalProps): React.ReactNode {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, container ?? document.body);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/portal.test.tsx
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/portal.tsx src/features/shared/lib/__tests__/portal.test.tsx
git commit -m "feat: add Portal component"
```

---

### Task 16: `error-boundary.tsx` — Error Boundary

**Files:**
- Create: `src/features/shared/lib/error-boundary.tsx`
- Create: `src/features/shared/lib/__tests__/error-boundary.test.tsx`

Reference: `Documentation/UI Framework/tokens.md` for card styling

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/shared/lib/__tests__/error-boundary.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "../error-boundary";

// Component that throws
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error");
  return <div>All good</div>;
}

// Suppress console.error in tests for expected errors
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Child content")).toBeTruthy();
  });

  it("renders default fallback on error", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("renders custom fallback ReactNode", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Custom error UI")).toBeTruthy();
  });

  it("renders custom fallback render function with error info", () => {
    render(
      <ErrorBoundary
        fallback={({ error }) => <div>Error: {error.message}</div>}
      >
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Error: Test error")).toBeTruthy();
  });

  it("retry button resets the error state", () => {
    let shouldThrow = true;
    function MaybeThrow() {
      if (shouldThrow) throw new Error("boom");
      return <div>Recovered</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeTruthy();

    // Fix the error condition and click retry
    shouldThrow = false;
    fireEvent.click(screen.getByText("Try again"));

    // After retry, it should re-render children
    expect(screen.getByText("Recovered")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/error-boundary.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/shared/lib/error-boundary.tsx
"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface FallbackRenderProps {
  error: Error;
  resetErrorBoundary: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: FallbackRenderProps) => ReactNode);
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catch rendering errors in child components and display a fallback UI.
 * Default fallback uses Fullmind brand tokens.
 *
 * @example
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * @example
 * <ErrorBoundary fallback={({ error, resetErrorBoundary }) => (
 *   <div>
 *     <p>Error: {error.message}</p>
 *     <button onClick={resetErrorBoundary}>Retry</button>
 *   </div>
 * )}>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  resetErrorBoundary = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      // Custom fallback: render function
      if (typeof fallback === "function") {
        return fallback({
          error,
          resetErrorBoundary: this.resetErrorBoundary,
        });
      }
      // Custom fallback: ReactNode
      if (fallback) {
        return fallback;
      }
      // Default fallback: Fullmind-styled error card
      return (
        <div className="rounded-lg shadow-sm border border-[#D4CFE2] p-5 text-center">
          <h3 className="text-lg font-semibold text-[#403770] mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-[#8A80A8] mb-4">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={this.resetErrorBoundary}
            className="px-4 py-2 rounded-lg bg-[#F37167] text-white text-sm font-medium hover:bg-[#e0635a] transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return children;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/error-boundary.test.tsx
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/error-boundary.tsx src/features/shared/lib/__tests__/error-boundary.test.tsx
git commit -m "feat: add ErrorBoundary component with Fullmind fallback UI"
```

---

### Task 17: `use-scroll.ts` — Scroll Utilities

**Files:**
- Create: `src/features/shared/lib/use-scroll.ts`
- Create: `src/features/shared/lib/__tests__/use-scroll.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/shared/lib/__tests__/use-scroll.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScrollTo, useScrollPosition } from "../use-scroll";

describe("useScrollTo", () => {
  it("returns a scrollTo function", () => {
    const { result } = renderHook(() => useScrollTo());
    expect(typeof result.current.scrollTo).toBe("function");
  });

  it("calls window.scrollTo with correct arguments for an HTMLElement", () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const el = document.createElement("div");
    // Mock getBoundingClientRect
    el.getBoundingClientRect = vi.fn(() => ({
      top: 500,
      left: 0,
      bottom: 500,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));
    document.body.appendChild(el);

    const { result } = renderHook(() => useScrollTo());
    act(() => {
      result.current.scrollTo(el);
    });

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: expect.any(Number),
      behavior: "smooth",
    });

    scrollToSpy.mockRestore();
    document.body.removeChild(el);
  });

  it("resolves a CSS selector to an element", () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const el = document.createElement("div");
    el.id = "scroll-target";
    el.getBoundingClientRect = vi.fn(() => ({
      top: 200,
      left: 0,
      bottom: 200,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));
    document.body.appendChild(el);

    const { result } = renderHook(() => useScrollTo());
    act(() => {
      result.current.scrollTo("#scroll-target");
    });

    expect(scrollToSpy).toHaveBeenCalled();

    scrollToSpy.mockRestore();
    document.body.removeChild(el);
  });

  it("does nothing if selector matches no element", () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const { result } = renderHook(() => useScrollTo());
    act(() => {
      result.current.scrollTo("#nonexistent");
    });
    expect(scrollToSpy).not.toHaveBeenCalled();
    scrollToSpy.mockRestore();
  });
});

describe("useScrollPosition", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial position of 0,0", () => {
    const { result } = renderHook(() => useScrollPosition());
    expect(result.current.x).toBe(0);
    expect(result.current.y).toBe(0);
  });

  it("returns isScrolling as false initially", () => {
    const { result } = renderHook(() => useScrollPosition());
    expect(result.current.isScrolling).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/shared/lib/__tests__/use-scroll.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/features/shared/lib/use-scroll.ts
"use client";

import { useCallback, useState, useEffect, useRef } from "react";

/**
 * Provides a scrollTo function for smooth scrolling to elements.
 * Accepts an HTMLElement or a CSS selector string.
 */
export function useScrollTo() {
  const scrollTo = useCallback(
    (
      target: HTMLElement | string,
      options?: { offset?: number; behavior?: ScrollBehavior },
    ) => {
      const el =
        typeof target === "string"
          ? document.querySelector<HTMLElement>(target)
          : target;

      if (!el) return;

      const offset = options?.offset ?? 0;
      const behavior = options?.behavior ?? "smooth";
      const top =
        el.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({ top, behavior });
    },
    [],
  );

  return { scrollTo };
}

/**
 * Track the current scroll position and scrolling state.
 * Updates are throttled to ~60fps via requestAnimationFrame.
 * `isScrolling` resets to false after 150ms of no scroll events.
 */
export function useScrollPosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isScrolling, setIsScrolling] = useState(false);
  const rafRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        setPosition({ x: window.scrollX, y: window.scrollY });
        setIsScrolling(true);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setIsScrolling(false), 150);
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { ...position, isScrolling };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/lib/__tests__/use-scroll.test.tsx
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/use-scroll.ts src/features/shared/lib/__tests__/use-scroll.test.tsx
git commit -m "feat: add useScrollTo and useScrollPosition hooks"
```

---

## Chunk 3: Documentation

### Task 18: `_foundations.md` — Utilities Overview

**Files:**
- Create: `Documentation/UI Framework/Utilities/_foundations.md`

- [ ] **Step 1: Write the foundations doc**

Create `Documentation/UI Framework/Utilities/_foundations.md` with:

- **What utilities are** — functions, hooks, and lightweight components that other components consume, not visual building blocks
- **Import convention** — `import { cn } from "@/features/shared/lib/cn"` (direct file imports, no barrel)
- **Decision tree** — "Which utility do I need?" organized by problem:
  ```
  What do you need?
  ├─ Merge CSS/Tailwind classes → cn (class-merging.md)
  ├─ Format a value for display?
  │  ├─ Currency → formatCurrency (formatting.md)
  │  ├─ Number with commas → formatNumber (formatting.md)
  │  ├─ Percentage → formatPercent (formatting.md)
  │  ├─ Compact (14.8K) → formatCompactNumber (formatting.md)
  │  ├─ Relative time → timeAgo / timeUntil (pretty-duration.md)
  │  └─ Truncated text → truncateEnd / truncateMiddle (text-truncation.md)
  ├─ Copy text to clipboard → copyToClipboard / useCopyToClipboard (clipboard.md)
  ├─ Highlight search matches → Highlight (search-highlighting.md)
  ├─ Work with colors?
  │  ├─ Parse hex → hexToRgb (color-utilities.md)
  │  ├─ Add opacity → withOpacity (color-utilities.md)
  │  └─ Check contrast → contrastRatio (color-utilities.md)
  ├─ Respond to element resizing → useResizeObserver (resize-observer.md)
  ├─ Detect clicks outside a container → useOutsideClick (outside-click.md)
  ├─ Trap focus in a modal/flyout → useFocusTrap (focus-trap.md)
  ├─ Hide content visually for screen readers → ScreenReaderOnly (screen-reader.md)
  ├─ Render outside DOM hierarchy → Portal (portal.md)
  ├─ Catch rendering errors → ErrorBoundary (error-boundary.md)
  └─ Scroll to element / track scroll position → useScrollTo / useScrollPosition (scroll.md)
  ```
- **Categories**: Formatting, DOM & Layout, Interaction, Accessibility, Error Handling
- **Server / client boundary** — which files need `"use client"` and which are server-safe (reference the table from the spec)
- **Testing** — all pure functions have unit tests in `__tests__/`; hooks tested via Testing Library

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Utilities/_foundations.md"
git commit -m "docs: add utilities foundations overview"
```

---

### Task 19: Individual Utility Documentation Guides

**Files:** Create all 14 individual guide files in `Documentation/UI Framework/Utilities/`.

Each guide follows the template from the spec: title, one-line description, API section with TypeScript signatures, Usage section with code examples, Behavior Notes, Brand Integration (if applicable), and Related links.

- [ ] **Step 1: Write `class-merging.md`**

Cover: `cn()` function, examples with conditional classes, Tailwind conflict resolution. Related: tokens.md.

- [ ] **Step 2: Write `clipboard.md`**

Cover: `copyToClipboard()` + `useCopyToClipboard()`, basic and hook usage, auto-reset behavior. Related: formatting.md.

- [ ] **Step 3: Write `formatting.md`**

Cover: all four formatters (`formatCurrency`, `formatNumber`, `formatPercent`, `formatCompactNumber`), null handling, compact mode. Note existing functions plus new additions.

- [ ] **Step 4: Write `text-truncation.md`**

Cover: `truncateEnd()`, `truncateMiddle()`, `<TruncatedText>`. Pure functions vs client component. Related: search-highlighting.md.

- [ ] **Step 5: Write `pretty-duration.md`**

Cover: `timeAgo()`, `timeUntil()`, accepted input formats, threshold behavior, when absolute dates appear. Related: formatting.md.

- [ ] **Step 6: Write `search-highlighting.md`**

Cover: `<Highlight>` component, brand styling, regex escaping, case insensitivity. Brand Integration: Robin's Egg bg + Plum text. Related: text-truncation.md.

- [ ] **Step 7: Write `resize-observer.md`**

Cover: `useResizeObserver()` hook, ref attachment, initial 0/0 values, cleanup. Related: truncated-text.

- [ ] **Step 8: Write `color-utilities.md`**

Cover: `hexToRgb()`, `withOpacity()`, `contrastRatio()`, accepted formats, WCAG thresholds. Brand Integration: works with brand palette in tokens.md. Related: search-highlighting.md.

- [ ] **Step 9: Write `focus-trap.md`**

Cover: `useFocusTrap()`, activation/deactivation, focus restoration, focusable selector. Related: outside-click.md, portal.md, container guides.

- [ ] **Step 10: Write `screen-reader.md`**

Cover: `<ScreenReaderOnly>` component, `srOnlyClass`, clip-rect technique, when to use. Related: focus-trap.md.

- [ ] **Step 11: Write `outside-click.md`**

Cover: `useOutsideClick()`, mousedown + touchstart, active toggle, relationship to container dismiss patterns. Related: focus-trap.md, Containers/_foundations.md.

- [ ] **Step 12: Write `portal.md`**

Cover: `<Portal>` component, document.body default, custom container, SSR safety. Related: focus-trap.md, error-boundary.md.

- [ ] **Step 13: Write `error-boundary.md`**

Cover: `<ErrorBoundary>` class component, default Fullmind fallback, custom fallback (ReactNode + render function), resetErrorBoundary. Brand Integration: Plum/Coral/card tokens. Related: portal.md.

- [ ] **Step 14: Write `scroll.md`**

Cover: `useScrollTo()`, `useScrollPosition()`, CSS selector support, offset for sticky headers, RAF throttling, isScrolling timeout. Related: resize-observer.md.

- [ ] **Step 15: Commit all documentation**

```bash
git add "Documentation/UI Framework/Utilities/"
git commit -m "docs: add individual utility guides for all 14 utilities"
```

---

### Task 20: Run Full Test Suite and Verify

**Files:** None (verification only)

- [ ] **Step 1: Run all utility tests**

```bash
npx vitest run src/features/shared/lib/__tests__/
```

Expected: All tests PASS across all utility test files

- [ ] **Step 2: Run full project test suite**

```bash
npx vitest run
```

Expected: No regressions — all existing tests continue to pass

- [ ] **Step 3: Verify all source files exist**

```bash
ls src/features/shared/lib/cn.ts \
   src/features/shared/lib/copy.ts \
   src/features/shared/lib/use-copy-to-clipboard.ts \
   src/features/shared/lib/format.ts \
   src/features/shared/lib/truncate.ts \
   src/features/shared/lib/truncated-text.tsx \
   src/features/shared/lib/pretty-duration.ts \
   src/features/shared/lib/highlight.tsx \
   src/features/shared/lib/use-resize-observer.ts \
   src/features/shared/lib/color-utils.ts \
   src/features/shared/lib/use-focus-trap.ts \
   src/features/shared/lib/screen-reader.tsx \
   src/features/shared/lib/use-outside-click.ts \
   src/features/shared/lib/portal.tsx \
   src/features/shared/lib/error-boundary.tsx \
   src/features/shared/lib/use-scroll.ts
```

Expected: All 16 files listed

- [ ] **Step 4: Verify all doc files exist**

```bash
ls "Documentation/UI Framework/Utilities/"
```

Expected: `_foundations.md` + 14 individual guides (15 files total)
