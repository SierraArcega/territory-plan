# Display Component Foundations

Shared patterns for all display components. Every component guide in this folder
references these foundations. If a pattern is defined here, the component guide should
not redefine it — just reference this file.

All values come from `tokens.md`. No Tailwind grays (`gray-*`) in display components.

---

## Semantic Color Application

| Semantic | Badge fill | Badge text | Callout bg | Progress bar | Dot indicator |
|----------|-----------|------------|------------|-------------|---------------|
| Error | `bg-[#fef1f0]` | `text-[#c25a52]` | `bg-[#fef1f0]` | `bg-[#F37167]` | `bg-[#F37167]` |
| Warning | `bg-[#fffaf1]` | `text-[#997c43]` | `bg-[#fffaf1]` | `bg-[#D4A84B]` | `bg-[#FFCF70]` |
| Success | `bg-[#EDFFE3]` | `text-[#5f665b]` | `bg-[#F7FFF2]` | `bg-[#69B34A]` | `bg-[#8AA891]` |
| Info | `bg-[#e8f1f5]` | `text-[#4d7285]` | `bg-[#e8f1f5]` | `bg-[#6EA3BE]` | `bg-[#6EA3BE]` |

**Badge fill vs callout bg:** Badge fills and callout backgrounds use the same solid semantic background hex from `tokens.md`, except for Success which uses Mint (`#EDFFE3`) from the brand palette for badge fills — the slightly higher saturation reads better at small badge sizes than `#F7FFF2`.

**Display-specific text colors:** The badge text values (`#c25a52`, `#997c43`, `#5f665b`, `#4d7285`) and Warning progress bar color (`#D4A84B`) are darker contrast-friendly variants of the semantic strong colors, needed for WCAG AA text legibility on light badge backgrounds. These extend the `tokens.md` semantic palette and should be added to `tokens.md` as a "Semantic Text (Dark)" row during implementation.

---

## Display Container

The standard card shell:

```
bg-white rounded-lg border border-[#D4CFE2] shadow-sm
```

Note: This corrects drift in the codebase where some components use `rounded-xl`, `border-gray-100`, or `border-gray-200`.

---

## Status Dot

Pattern: `w-2 h-2 rounded-full flex-shrink-0`

Note: Color comes from the semantic table above or from plan/vendor accent colors.

---

## Number Formatting Conventions

| Input | Output | Currency |
|-------|--------|----------|
| `null` / `undefined` | `"—"` | `"—"` |
| 1,000,000+ | `"1.2M"` | `"$1.2M"` |
| 1,000+ | `"12K"` | `"$12K"` |
| Below 1,000 | `"1,234"` | `"$1,234"` |

Use `toLocaleString()` for comma separation. Strip trailing `.0` from M/K abbreviations.

---

## Transition Timing

| Context | Classes |
|---------|---------|
| Progress bar fill | `transition-all duration-500` |
| Tooltip enter | `tooltip-enter` (150ms, defined in globals.css) |
| Tooltip exit | `tooltip-exit` (80ms, defined in globals.css) |
| Skeleton pulse | `animate-pulse` |
| Color/state changes | `transition-colors duration-100` |
| Expand/collapse | `transition-all duration-150` |

---

## Disabled / Empty Pattern

When a display element has no data:

- **Stat value**: Show `"—"` in `text-[#A69DC0]`
- **Progress bar**: Show empty track only (`bg-[#EFEDF5]`)
- **Badge**: Don't render — hide the element entirely rather than showing an empty badge

---

## Empty State Visuals

Empty states may use either a Lucide icon at the Feature / Empty State size (`w-10 h-10`, `strokeWidth={1.5}`) or a Tier 2 personality emoji — not both on the same surface.

See `iconography.md` for the icon size scale, semantic icon map, and emoji policy (Tier 2 — Personality / Warmth).

---
