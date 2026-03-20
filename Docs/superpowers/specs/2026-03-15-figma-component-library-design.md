# Figma Component Library — Design Spec

**Date:** 2026-03-15
**Figma File:** [Territory Planner Library](https://www.figma.com/design/gv1NLgfonae2cju9SSBNqo/Territory-Planner-Library)

---

## Goal

Build a reusable Figma component library for the Fullmind territory planning app. Start with foundations + ~10 core primitives so that all future page design is faster and consistent.

## Approach

1. Build styled HTML showcase pages that render each foundation and component exactly per the UI Framework token specs
2. Capture each page into the Figma file via `generate_figma_design` MCP tool (outputMode: `existingFile`)
3. User converts captured frames into native Figma components afterward

## Source of Truth

All visual specs come from `Documentation/UI Framework/`:
- `tokens.md` — colors, typography, elevation, spacing, borders, z-index, animations
- `iconography.md` — Lucide icons, size scale, semantic map
- Component specs under `Components/` subdirectories

---

## Deliverable 1: Foundations Page

A single HTML page organized as labeled reference boards.

### Color Swatches

**Brand Palette (7 colors):**
| Token | Hex |
|-------|-----|
| Plum | `#403770` |
| Coral | `#F37167` |
| Steel Blue | `#6EA3BE` |
| Robin's Egg | `#C4E7E6` |
| Golden | `#FFCF70` |
| Mint | `#EDFFE3` |
| Off-White | `#FFFCFA` |

**Neutral Surfaces (4):**
| Token | Hex |
|-------|-----|
| Surface | `#FFFCFA` |
| Surface Raised | `#F7F5FA` |
| Hover | `#EFEDF5` |
| White | `#FFFFFF` |

**Neutral Borders (3):**
| Token | Hex |
|-------|-----|
| Border Subtle | `#E2DEEC` |
| Border Default | `#D4CFE2` |
| Border Strong | `#C2BBD4` |

**Neutral Text (7):**
| Token | Hex |
|-------|-----|
| Muted | `#A69DC0` |
| Secondary | `#8A80A8` |
| Body | `#6E6390` |
| Strong | `#544A78` |
| Primary | `#403770` |
| Pressed | `#322a5a` |
| Inverse | `#FFFFFF` |

**Semantic Colors (4 × 3 stops each):**
| Semantic | Background | Text/Border | Strong |
|----------|-----------|-------------|--------|
| Error | `#fef1f0` | `#f58d85` | `#F37167` |
| Warning | `#fffaf1` | `#ffd98d` | `#FFCF70` |
| Success | `#F7FFF2` | `#8AC670` | `#69B34A` |
| Info | `#e8f1f5` | `#8bb5cb` | `#6EA3BE` |

### Typography Scale

Font: Plus Jakarta Sans (400, 500, 600, 700)

| Tier | Size | Weight | Example text |
|------|------|--------|-------------|
| Micro | 10px | 500 | Chip label, map chrome |
| Caption | 12px | 500/600 | Table header, badge |
| Body | 14px | 400/500 | Body text, input value |
| Heading | 18px | 600/700 | Section heading |
| Display | 24px | 700 | Page title |

Show each tier in primary text color (#403770) with weight variations.

### Elevation

**Shadows:** flat (none), low (shadow-sm), medium (shadow-lg), high (shadow-xl) — each as a white card on off-white background.

**Border Radius:** rounded-full, rounded-lg, rounded-xl, rounded-2xl — shown on sample shapes.

**Standard Pairings:** Card, Popover, Modal, Button, Pill/Chip, Input — each rendered with its specified radius + shadow + border combo.

### Spacing Rhythm

Visual blocks showing the spacing scale:
- `gap-1.5` / `gap-2` (element spacing)
- `gap-3` / `gap-4` (group spacing)
- `gap-6` / `gap-8` (section spacing)
- `p-3`, `p-4`, `p-5`, `p-6` (padding tiers)

### Iconography

Key Lucide icons from the semantic map at each size tier (Compact 14px, Inline 16px, Default 20px, Heading 24px, Feature 40px). Show ~15 representative icons covering Navigation, Territory, Schools, Data, and Status categories.

---

## Deliverable 2: Core Components Page

A single HTML page with each component rendered in all its key states.

### 1. Buttons
- **Variants:** Primary (plum bg), Secondary (plum outline), Ghost (no border), Destructive (coral outline, fills on hover), Icon-Only (square, icon centered), Chip/Toggle (pill shape, active/inactive)
- **States:** Default, Hover, Disabled
- **Sizes:** Small (text-xs, px-3 py-1.5), Default (text-sm, px-4 py-2), Large (text-sm, px-5 py-2.5)
- **With icon:** Leading icon variant for Primary, Secondary, Ghost

### 2. Text Input
- **States:** Default, Focused (coral ring `#F37167`), Error (coral ring + error message), Disabled
- **Anatomy:** Label (caption tier, uppercase tracking-wider) + Input + Helper text
- **Variant:** With leading icon (Search)

### 3. Select / Dropdown
- **Native Select:** Closed default, Closed with selection, Open with options list
- **Multi-Select trigger:** With chip tags, search input
- **Styling:** Same input treatment (rounded-lg, border-strong, coral focus ring)

### 4. Badges
- **Signal Badges:** Growing (green), Stable (blue), At Risk (golden), Declining (coral)
- **Status Badges:** Active, Planning, Stale, Archived
- **Count/Label Badge:** Plum bg, used for numeric counts
- **Recency Badge:** Active, Slowing, Stale, No Activity
- **Style:** rounded-full, text-xs font-semibold, semantic bg + text color per category

### 5. Cards
- **Standard card:** rounded-lg, shadow-sm, border border-[#D4CFE2], p-4, white bg
- **Compact card:** Same shell, p-3 padding
- **Show with:** Header text, body text, and a footer action to demonstrate content structure

### 6. Tooltips
- **Simple/Dark:** Plum bg, white text, rounded-lg, shadow-lg, with arrow
- **Rich/Map:** White bg with backdrop-blur, rounded-xl, shadow-lg — entity name, metadata, category indicator
- **Positions:** Top, right (show arrow placement)

### 7. Toggle / Switch
- **States:** Off (neutral), On (plum), Disabled
- **With label:** Paired with body-tier secondary text (`text-sm text-[#8A80A8]`)

### 8. Checkbox & Radio
- **Checkbox states:** Unchecked, Checked (plum), Indeterminate, Disabled
- **Radio states:** Unselected, Selected (plum), Disabled
- **With label:** Paired with body-tier label text (`text-sm text-[#403770]`)

### 9. Data Table
- **Header row:** Surface-raised bg, `text-[11px]` uppercase text, sort indicators
- **Data rows:** Body tier text, hover state, border-subtle dividers
- **Show:** 4-5 columns, 3-4 data rows, one sorted column
- **Cell types:** Text, number (tabular-nums), badge, action icon

### 10. Tabs
- **Style:** Horizontal tab bar, active tab with coral bottom border (`h-0.5 bg-[#F37167]`) + coral text, inactive with secondary text
- **States:** Active, Inactive, Hover

---

## Capture Strategy

1. Build two HTML files: `foundations.html` and `components.html`
2. Serve locally via a simple HTTP server
3. Capture each page into the Figma file as a separate page/frame using `generate_figma_design` with `outputMode: existingFile`
4. Each major section should be a clearly labeled frame for easy componentizing
5. After capture, verify output against HTML source — manually adjust any rendering artifacts (backdrop-blur, complex shadows, etc.)

## Post-Capture (User Responsibility)

After capture, the user will:
- Set up Figma color variables matching the token values
- Set up Figma text styles matching the type scale
- Convert component frames into Figma components with variants
- Organize into Figma pages (Foundations, Components)
