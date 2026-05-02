# Design Tokens

The single source of truth for Fullmind's visual language. Every component guide and new feature references these tokens. If a value isn't here, it shouldn't be in the codebase.

---

## Colors

### Brand Palette

| Token | Hex | Tailwind Class | Role |
|-------|-----|---------------|------|
| Plum | `#403770` | `text-plum`, `bg-plum`, `border-plum` | Primary text, buttons, selected states |
| Coral | `#F37167` | `text-coral`, `bg-coral`, `border-coral` | Accents, primary badges, focus rings |
| Steel Blue | `#6EA3BE` | `text-steel-blue`, `bg-steel-blue` | Links, secondary accents, elementary school dots |
| Robin's Egg | `#C4E7E6` | `bg-[#C4E7E6]` | Selection highlights, light tinted backgrounds |
| Golden | `#FFCF70` | `bg-[#FFCF70]` | High school dots, golden vendor palette |
| Mint | `#EDFFE3` | `bg-mint` | Light success backgrounds |
| Off-White | `#FFFCFA` | `bg-off-white` | Page background, map background |

### Neutrals (Plum-derived)

All neutrals are tints and shades between Off-White and Plum — no generic Tailwind grays. Every neutral has a plum undertone for brand cohesion.

**Surfaces:**
| Token | Hex | Role |
|-------|-----|------|
| Surface | `#FFFCFA` | Page background, map background |
| Surface Raised | `#F7F5FA` | Table headers, footers, subtle card backgrounds |
| Hover | `#EFEDF5` | Hover backgrounds, selected row tints |
| White | `#FFFFFF` | Card surfaces, inputs (pure white for contrast) |

**Borders:**
| Token | Hex | Role |
|-------|-----|------|
| Border Subtle | `#E2DEEC` | Row dividers, inner separators |
| Border Default | `#D4CFE2` | Card edges, section dividers |
| Border Strong | `#C2BBD4` | Inputs, form fields, emphasized edges |

**Text:**
| Token | Hex | Role |
|-------|-----|------|
| Muted | `#A69DC0` | Placeholders, disabled text |
| Secondary | `#8A80A8` | Descriptions, labels, secondary info |
| Body | `#6E6390` | Standard body text |
| Strong | `#544A78` | Headings, emphasis in neutral context |
| Primary | `#403770` | Primary text, links, interactive elements (Plum) |
| Pressed | `#322a5a` | Hover/pressed states (Plum Dark) |
| Inverse | `#FFFFFF` | Text on dark backgrounds (plum, coral) |

### Semantic Colors

All semantic colors are derived from brand palette gradients — not Tailwind defaults.

| Semantic | Background | Text / Border | Strong (buttons) | Source Palette |
|----------|-----------|---------------|-----------------|---------------|
| Error | `#fef1f0` | `#f58d85` | `#F37167` (Coral) | Coral stops |
| Warning | `#fffaf1` | `#ffd98d` | `#FFCF70` (Golden) | Golden stops |
| Success | `#F7FFF2` | `#8AC670` | `#69B34A` (Mint) | Mint stops |
| Info | `#e8f1f5` | `#8bb5cb` | `#6EA3BE` (Steel Blue) | Steel Blue stops |

Usage:
- **Background**: Light container fills, hover states on destructive/success elements
- **Text / Border**: Readable labels, badge borders, icon colors
- **Strong**: Buttons, bold accents, active indicators

### Map Palette Colors

Vendor and signal palettes are defined in `src/features/map/lib/palettes.ts`. Each vendor palette has 7 graduated stops from lightest to darkest. These are configurable by the user — don't hardcode palette stop values in components. Always read from the palette system.

**Special values:**
| Hex | Role |
|-----|------|
| `#FFB347` | Lapsed/churned category across all vendors |

---

## Typography

### Font Family

**Plus Jakarta Sans** — the only font. Loaded via Google Fonts with 4 weights.

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
```

No other fonts (Inter, Space Grotesk, JetBrains Mono) are used. If a component needs monospace numbers, use `tabular-nums` class — not a different font.

### Type Scale

5 tiers only. Do not introduce arbitrary sizes outside this scale.

| Tier | Size | Tailwind | Weight | Usage |
|------|------|----------|--------|-------|
| Micro | 10px | `text-[10px]` | `font-medium` | Chips, map chrome, ultra-compact labels |
| Caption | 12px | `text-xs` | `font-medium` or `font-semibold` | Labels, badges, table headers, secondary info |
| Body | 14px | `text-sm` | `font-normal` or `font-medium` | Body text, inputs, primary content, table data |
| Heading | 18px | `text-lg` | `font-semibold` or `font-bold` | Section headings, modal titles |
| Display | 20-24px | `text-xl` / `text-2xl` | `font-bold` | Page titles, hero numbers |

### Weight Scale

| Tailwind | Weight | Role |
|----------|--------|------|
| `font-normal` | 400 | Body text, long-form content |
| `font-medium` | 500 | Default for most UI text — labels, buttons, nav |
| `font-semibold` | 600 | Emphasis — table headers, active states, badges |
| `font-bold` | 700 | Headings, display numbers, strong emphasis |

### Letter Spacing

| Class | When to use |
|-------|------------|
| `tracking-wider` | Uppercase labels (`text-xs uppercase tracking-wider`) |
| `tracking-wide` | Form labels, section headers |
| _(default)_ | Everything else |

### Uppercase Rule

Only use `uppercase` with `text-xs` or `text-[10px]`, always paired with `tracking-wider` or `tracking-wide`. Never uppercase body or heading text.

---

## Elevation

### Shadow Scale

| Level | Class | Element types |
|-------|-------|--------------|
| Flat | _(none)_ | Buttons, inline elements, pills |
| Low | `shadow-sm` | Cards, input containers, table wrappers |
| Medium | `shadow-lg` | Popovers, dropdowns, floating panels |
| High | `shadow-xl` | Modals, dialogs, critical overlays |

Do not use `shadow-md` or `shadow-2xl` in new code. Consolidate to these 4 levels.

### Border Radius

| Class | Element types |
|-------|--------------|
| `rounded-full` | Avatars, pills, chips, dots, circular icons |
| `rounded-lg` | Cards, inputs, buttons, table wrappers |
| `rounded-xl` | Popovers, dropdowns, larger cards |
| `rounded-2xl` | Modals, dialogs |

Do not use `rounded-sm` or `rounded-md` in new code.

### Standard Pairings

| Element | Radius | Shadow | Border |
|---------|--------|--------|--------|
| Card | `rounded-lg` | `shadow-sm` | `border border-[#D4CFE2]` |
| Popover | `rounded-xl` | `shadow-lg` | `border border-[#D4CFE2]/60` |
| Modal | `rounded-2xl` | `shadow-xl` | none |
| Button | `rounded-lg` | none | varies |
| Pill/Chip | `rounded-full` | none | `border border-[#D4CFE2]` |
| Input | `rounded-lg` | none | `border border-[#C2BBD4]` |
| Panel (floating) | `rounded-2xl` | `shadow-lg` | none (blur provides separation) |
| Bottom Bar | `rounded-xl` | `shadow-lg` | none |
| Flyout | none (desktop) / `rounded-t-2xl` (mobile) | `shadow-lg` | `border-l border-[#E2DEEC]` (desktop) |

---

## Borders

### Color Tiers

| Tier | Hex | Usage |
|------|-----|-------|
| Subtle | `#E2DEEC` | Row dividers, inner separators |
| Default | `#D4CFE2` | Card edges, section dividers |
| Strong | `#C2BBD4` | Inputs, form fields, emphasized edges |
| Brand | `#403770` (Plum) | Selected states, active tab indicators |

---

## Z-Index Layers

| Value | Layer | Elements |
|-------|-------|----------|
| `z-10` | Map chrome | Summary bar, floating controls on map |
| `z-20` | Panels | Floating panel, layer bubble |
| `z-30` | Popovers | Dropdowns, tooltips above panels |
| `z-40` | Backdrop | Modal/dialog backdrops |
| `z-50` | Modal | Modals, toasts, top-level overlays |

Never use arbitrary z-index values (`z-[15]`, `z-[100]`). Stick to these 5 tiers.

---

## Spacing Rhythm

Tailwind's 4px grid IS our sizing system. Always use Tailwind spacing values (`gap-4`, `p-6`, `m-2`) — never arbitrary pixel values like `p-[13px]` or `gap-[7px]`. Follow these conventions:

| Context | Gap | Example |
|---------|-----|---------|
| Between sections | `gap-6` or `gap-8` | Space between "Goals" and "Plans" sections |
| Between cards/groups | `gap-3` or `gap-4` | Cards in a list, rows in a group |
| Between elements in a group | `gap-1.5` or `gap-2` | Label + value, icon + text |
| Padding: cards | `p-4` or `p-5` | Card inner padding |
| Padding: compact cards | `p-3` | Tight cards, list items |
| Padding: modals | `p-6` | Modal content area |
| Padding: table cells | `px-4 py-3` | Standard data tables |

---

## Animations

All animations are defined in `globals.css`. Standard timing:

| Animation | Duration | Easing | Class |
|-----------|----------|--------|-------|
| Panel slide-in | 250ms | `cubic-bezier(0.16, 1, 0.3, 1)` | `.panel-v2-enter` |
| Content fade | 200ms | `ease-out` | `.panel-content-enter` |
| Tooltip enter | 150ms | `cubic-bezier(0.16, 1, 0.3, 1)` | `.tooltip-enter` |
| Tooltip exit | 80ms | `ease-out` | `.tooltip-exit` |
| Chip pop | 180ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `.chip-pop` |
| Stagger item | 200ms | `ease-out` | `.stagger-item` |
| Hover transitions | 100-150ms | default | `transition-colors duration-100` |

---

## Responsive Breakpoints

| Prefix | Width | Usage |
|--------|-------|-------|
| _(base)_ | 0+ | Mobile-first defaults |
| `sm:` | 640px+ | Tablet — panel appears, mobile drawer hides |
| `xl:` | 1280px+ | Desktop — step-up sizes for map chrome |

---

## Narrow-Width Resilience

Chrome must stay legible when squeezed — sidebars open, right rails open, smaller laptops, 100% zoom. Apply these rules whenever you build a flex/grid that contains text. Without one of them, flexbox quietly wraps text inside the offending child and produces classic baseline-collision bugs (e.g. "Closed   $141K / lost" stacking onto two lines).

### 1. Plan a wrap behavior — don't leave it ambiguous

Every flex/grid container with growable content (header strips, pill rows, summary tiles, day-card grids) needs an explicit overflow plan. Pick one:

| Goal | Apply |
|------|-------|
| Single-row chrome that should never wrap (deal-summary strips, ribbons) | `whitespace-nowrap` on every text node + parent gets `min-w-0 overflow-x-auto` and children get `flex-shrink-0` |
| Toolbar/header that should drop to a new row when narrow (page headers with title + controls) | `flex flex-wrap` on parent + `gap-y-3` so the wrapped row has breathing room |
| Tile that should keep all content visible at any width (calendar day cells, KPI cards) | Stack content vertically (`flex flex-col items-center`) — never use `justify-between` between two text blocks under ~120px wide |

### 2. Keep label + number + amount on one visual line

Inside a fixed-size pill, stat tile, or chip:

- **Every text span** (count, label, amount) gets `whitespace-nowrap`. Yes, all of them.
- **Avoid `justify-between`** between two competing text spans in cells under ~120px wide — the smaller tier loses the width fight and wraps to a second line, with the larger tier baseline-aligned to the wrong line.
- **Hyphens are line-break points.** `past-due close` wraps at the hyphen with one space of pressure. Reword (`Past due`) or use `whitespace-nowrap`.

### 3. Compact cells: prefer icon + number over text labels

When a cell, pill, or chip is narrower than ~80px, labels like `5 items` / `5 deals` won't fit. Use a Lucide icon + `tabular-nums` count, with the full text in `aria-label`:

```tsx
<div className="inline-flex items-center gap-1 text-[#544A78]"
     aria-label={`${itemCount} items`}>
  <CalendarCheck2 className="w-2.5 h-2.5" aria-hidden /> {itemCount}
</div>
```

Reserve text labels for cells ≥ 120px wide.

### 4. Sanity test before merging

For any new chrome component, mentally check at three widths:

1. **Wide** (everything has room) — should look balanced.
2. **Medium** (sidebar + right rail open, ~700px content area) — labels still on one line, no clipping.
3. **Narrow** (everything squeezed, ~480px) — content either wraps to a new row or scrolls horizontally; never silently overflows or word-by-word stacks.

If case 3 fails, add `flex-wrap` on the parent or `overflow-x-auto` + `whitespace-nowrap` on the children before merging.

---

## File Reference

| What | Where |
|------|-------|
| CSS custom properties | `src/app/globals.css` |
| Font initialization | `src/app/layout.tsx` |
| Map vendor palettes | `src/features/map/lib/palettes.ts` |
| School type colors | `src/features/map/components/LayerBubble.tsx` (lines 65-69) |
| Tailwind theme | `@theme inline` block in `globals.css` |
