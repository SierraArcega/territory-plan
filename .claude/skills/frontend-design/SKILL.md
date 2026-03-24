---
name: frontend-design
description: Use when building web components, pages, or interfaces for the Fullmind territory planning product. Ensures Fullmind brand compliance, high design quality, and Figma MCP integration when Figma URLs are provided.
---

# Frontend Design — Fullmind Territory Planner

Create production-grade, brand-compliant interfaces for Fullmind's territory planning tool. The Fullmind brand is colorful, approachable, and energetic — a remote learning company that extends school capacity. Warm plums, soft corals, and mint greens against off-white, with Plus Jakarta Sans typography.

## When to Use

- Building new components, pages, or UI features
- Implementing designs from Figma or Paper
- Creating data tables, charts, forms, calendars, map controls
- Any frontend work where visual consistency matters

---

## Discovery Workflow

Before writing any code, understand what already exists and what the docs specify.

### Step 1 — Read the docs

All specs live in `Documentation/UI Framework/`. This is the **single source of truth**.

| I need to build... | Read first | Then |
|---------------------|------------|------|
| Any component | `tokens.md` (always) | Category `_foundations.md` → specific guide |
| Something with icons | `iconography.md` | Lucide semantic map, size scale, emoji policy |
| A data table or grid | `Components/Tables/_foundations.md` | Specific table type guide |
| A form | `Components/forms.md` | Self-contained — covers modal, panel, and inline |
| Navigation (buttons, tabs, nav, breadcrumbs) | `Components/Navigation/_foundations.md` | Specific component guide |
| A container (card, modal, popover, panel, flyout) | `Components/Containers/_foundations.md` | Specific component guide |
| Display elements (badges, stats, tooltips, empty states) | `Components/Display/_foundations.md` | Specific component guide |
| A chart | `Components/Data Visualization/_foundations.md` | Specific chart guide |
| Page layout or shell | `Components/Layouts/_foundations.md` | Specific layout guide |
| A multi-component pattern | `Patterns/_foundations.md` | Specific pattern guide |

Every `_foundations.md` has a **decision tree** that routes you to the right specific guide. Read it.

### Step 2 — Check existing components

Before creating anything new, search for what already exists. Read
`docs/architecture.md` § "Shared Components" for the full inventory, then:

- `src/features/shared/components/` — shared feature components (DataGrid, InlineEditCell, filters, layout, navigation)
- `src/features/shared/lib/` — shared utilities (format.ts, cn.ts, date-utils.ts)
- `src/features/*/components/` — feature-specific components

Use Glob and Grep to find existing implementations. Reuse and extend before creating.

### Step 2b — Shared Component Gate (HARD REQUIREMENT)

Before building any of the following, check if a shared component already covers the use case:

| Building... | Check first | Location |
|-------------|-------------|----------|
| Any data table | DataGrid | `src/features/shared/components/DataGrid/` |
| Table filters | ExploreFilters pattern | `src/features/map/components/explore/ExploreFilters.tsx` |
| Column picker | ExploreColumnPicker pattern | `src/features/map/components/explore/ExploreColumnPicker.tsx` |
| Sort controls | DataGrid built-in sort (click column headers) | `src/features/shared/components/DataGrid/DataGrid.tsx` |
| Inline editing | InlineEditCell | `src/features/shared/components/InlineEditCell.tsx` |
| Editable currency | EditableCurrencyCell | `src/features/map/components/explore/cellRenderers.tsx` |
| Pagination | DataGrid built-in pagination | `src/features/shared/components/DataGrid/DataGrid.tsx` |

**If a shared component covers 80%+ of the need, you MUST use it.** Do not hand-build tables, pagination, filter toolbars, or sort controls. The only acceptable reasons to skip:
1. The use case is fundamentally different (not just "simpler")
2. The shared component would need breaking changes

When the shared component is coupled to a specific context (e.g., `ExploreEntity`), build a lightweight version that follows the same visual patterns but accepts generic props (e.g., `ColumnDef[]`). Reference the original for exact class names and layout.

### Step 3 — Screenshot the Paper design system

The **Mapomatic Design System** in Paper has visual references for every component category:

| Category | Artboard ID |
|----------|-------------|
| Tables | `1CS-0` |
| Forms | `1PX-1` |
| Navigation | `1VO-1` |
| Layouts | `22F-1` |
| Containers | `28W-1` |
| Display | `293-1` |

```
mcp__paper__get_screenshot(nodeId: "<artboard-id>")
```

Drill into sections with `get_children` → `get_screenshot` on the specific section. Use `get_computed_styles` if you need exact values from the design.

### Step 4 — Check Figma (when URL provided)

The Fullmind Design System in Figma: `fileKey: f7z1zvLNqckMsYoZGCyb9j`

1. `get_design_context` with `nodeId` and `fileKey` (convert `-` to `:` in node IDs)
2. `get_variable_defs` for token definitions
3. `get_code_connect_map` for existing component mappings
4. `get_screenshot` for layout precision
5. Adapt output to project conventions — never use Figma output verbatim

---

## Design Decisions

### Choosing the Right Component

Each `_foundations.md` has a decision tree. Follow it. Common decision points:

**Tables:** Start with Data Grid unless you're sure you won't need column management, filters, or 8+ columns. It's easier to disable features than retrofit them.

**Containers:** Does it block the page? → Modal. Contextual to a trigger? → Popover (small) or Flyout (large). Persistent layout? → Panel or Card. Switchable views? → Tabs. Reveal/hide in place? → Accordion.

**Forms:** Full entity create/edit → Modal Form. In-map editing → Panel Form. Quick single-value edit → Inline Edit.

**Charts:** Parts of a whole → Donut. Comparing categories → Bar. Trends over time → Line. Magnitude + trend → Combo.

### When to Create New Components

Create a new component when:
- No existing component matches the use case (checked `src/components/` and `src/features/shared/`)
- The pattern will be reused in 2+ places
- The doc spec defines a pattern that hasn't been implemented yet

When creating new:
- Follow the doc spec exactly — tokens, spacing, elevation, radius, all from `tokens.md`
- Place shared components in `src/features/shared/components/`
- Place feature-specific components in `src/features/*/components/`
- Never introduce values not in the token system

### When to Extend Existing Components

Prefer extending when:
- An existing component covers 80%+ of the use case
- The new variant fits the same API surface
- The doc spec describes a variant of an existing pattern (e.g., compact vs standard table)

---

## Design Quality

### Brand Aesthetic

Fullmind is warm and professional — not sterile, not playful. Think "trusted educational partner." The brand palette (plum, coral, mint, golden, steel blue, robin's egg) against off-white IS the creative direction.

- **Typography**: Plus Jakarta Sans with careful weight contrast and size hierarchy
- **Motion**: `transition-colors duration-100` for hover, CSS transitions preferred, staggered entrance animations for lists
- **Space**: Generous negative space, aligned to the spacing rhythm in `tokens.md`
- **Depth**: Layered shadows per the elevation scale, robin's egg tinted backgrounds for subtle layering
- **Texture**: Off-white backgrounds create warmth. Semi-transparent brand colors for layering

**Never**: Generic system fonts, stark white page backgrounds, Tailwind grays, purple-gradient cliches, uniform gray everything, cookie-cutter layouts.

### Verification Checklist

Before considering frontend work complete:

- [ ] All color values come from `tokens.md` — no Tailwind grays, no arbitrary hex
- [ ] Type scale uses only the 5 defined tiers — no arbitrary sizes
- [ ] Elevation uses only `shadow-sm`, `shadow-lg`, `shadow-xl` — no `shadow-md` or `shadow-2xl`
- [ ] Border radius uses only `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full`
- [ ] Icons are from Lucide, use `currentColor`, follow the semantic map
- [ ] Screenshot matches the Paper design system reference
- [ ] Existing components were checked and reused where possible
- [ ] Plus Jakarta Sans is the only font in use

---

## Craft — Design Quality Within Brand

When building or prototyping, apply these craft principles:

- **Typography rhythm**: hierarchy through the 5-tier scale + weight variation within tiers
- **Color composition**: Plum + Off-white foundation, one accent moment per view
- **Spacing composition**: tighter within groups, generous between sections
- **Motion**: staggered entrances (30-50ms), fast hovers (100ms), natural panel transitions (200-250ms)
- **Composition**: hero element gets 40-60% visual weight, vertical rhythm across sections

Full craft guidance with examples is in the `design-explore` skill (`.claude/skills/design-explore/SKILL.md` § Craft Guidance). Read it when prototyping or building new UI.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Styling | Tailwind CSS 4 with brand tokens |
| UI State | Zustand |
| Server State | TanStack Query |
| Charts | Recharts 3 |
| Maps | MapLibre GL JS 5 |
| Icons | Lucide React |
| Tables | TanStack React Table |
| Testing | Vitest + Testing Library |
