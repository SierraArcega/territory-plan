# MapSummaryBar Responsive Refresh

**Date:** 2026-02-24
**Status:** Approved

## Problem

The MapSummaryBar displays up to 12 financial metrics in a horizontal row. On 13" laptop screens (~1280px viewport), the stats row extends beyond comfortable reading width, requiring horizontal scroll.

The bar also uses generic gray styling that doesn't align with the Fullmind brand system.

## Approach

**Approach A: Responsive spacing + compact labels** — Use Tailwind responsive classes to tighten layout at narrower viewports. Combined with a Fullmind brand color refresh.

## Design

### Brand Refresh

Replace generic grays with Fullmind brand tokens:

| Element | Current | Refreshed |
|---------|---------|-----------|
| Background | `bg-white/85` | `bg-[#FFFCFA]/85` (off-white) |
| Stat values | `text-gray-700` | `text-[#403770]` (Plum) |
| Stat labels | `text-gray-400` | `text-[#403770]/50` (Plum 50%) |
| Separators | `bg-gray-200/60` | `bg-[#403770]/10` |
| Close button | `text-gray-300 hover:text-gray-500` | `text-[#403770]/25 hover:text-[#403770]/50` |
| Vendor labels | `text-gray-600` | `text-[#403770]/70` |
| Skeleton pulses | `bg-gray-200` / `bg-gray-100` | `bg-[#C4E7E6]/20` (Robin's Egg) |
| Collapse button | `text-gray-500` | `text-[#403770]/50` |
| Ring | `ring-black/[0.08]` | `ring-[#403770]/[0.06]` |

### Responsive Layout

Two tiers using `xl:` breakpoint (1280px):

**Default (< 1280px) — 13" laptops:**
- Stats row: `gap-3 px-3 py-2.5`
- Stat label: `text-[10px]`
- Stat value: `text-[13px]`
- Separator height: `h-5`
- Vendor rows: `gap-3 px-3 py-1.5`
- Abbreviated labels: Dist, Enroll, Pipe, Book, Inv, Sched Rev, Deliv Rev, Def Rev, Tot Rev, Deliv Take, Sched Take, All Take

**xl: and wider (>= 1280px):**
- Stats row: `gap-5 px-5 py-3` (current sizing)
- Full labels: Districts, Enrollment, Pipeline, Bookings, Invoicing, etc.
- Current text sizes (`text-[11px]`, `text-[15px]`)

### Files Touched

- `MapSummaryBar.tsx` — brand colors, responsive classes, compact label variants

### Unchanged

- ViewActionsBar structure
- Popover positioning and behavior
- Card shape, shadow, backdrop blur
- Horizontal overflow-x-auto as fallback
- Toggle visibility behavior
- Store (no changes)
