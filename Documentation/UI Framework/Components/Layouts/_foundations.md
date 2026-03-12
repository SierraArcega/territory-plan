# Layout Foundations

Shared rules for all layout patterns in the territory planner. Every pattern file in this folder references these foundations. All values come from `tokens.md`. New code uses plum-derived neutrals, not Tailwind grays.

For related component patterns, see sibling files: `page-shells.md`, `sidebar-and-panels.md`, `grids-and-composition.md`.

---

## Flex vs Grid Decision Tree

| Reach for | When |
|-----------|------|
| Flex | Single-axis flow — rows, columns, toolbars, stacking sections, sidebar + content |
| Grid | Two-dimensional alignment — card grids, dashboard columns, calendar cells, equal splits |

---

## Shared Spacing Rules

Applied from `tokens.md` Spacing Rhythm section:

| Context | Gap | Example |
|---------|-----|---------|
| Between sections | `gap-6` or `gap-8` | Space between "Goals" and "Plans" sections |
| Between cards/groups | `gap-3` or `gap-4` | Cards in a list, rows in a group |
| Between elements in a group | `gap-1.5` or `gap-2` | Label + value, icon + text |

---

## Content Width Capping

- `max-w-6xl mx-auto` — used on all non-map pages (PlansView, HomeView, ActivitiesView)
- Applied to both `<header>` and `<main>` content areas
- Do NOT use on map view or full-bleed layouts

---

## Responsive Conventions

Core breakpoints from `tokens.md`: base (0+), `sm:` (640px+), `xl:` (1280px+).

Layout code also uses `md:` (768px+) and `lg:` (1024px+) for grid column shifts — these are standard Tailwind breakpoints used in layout contexts even though they aren't in the core token set:

- Base: `grid-cols-1` (single column)
- `md:`: `grid-cols-2` (two columns on tablet)
- `lg:`: `grid-cols-3` or `grid-cols-5` (full desktop layout)

---

## Full-Height Convention

- Root of every view: `h-full overflow-auto bg-[#FFFCFA]`
- Use `flex-1` to fill remaining space inside a flex parent
- Use `min-h-0` on flex children that contain scrollable content (prevents overflow)
- Use `min-w-0` on flex children that contain truncatable text

---

## Anti-Patterns

- Arbitrary pixel gaps (`gap-[13px]`, `p-[7px]`) — use Tailwind's 4px grid
- Nested scroll containers — only one scrollable area per view
- `w-screen` / `h-screen` — use `h-full` (views live inside AppShell, not the viewport)
- `shadow-md`, `rounded-sm`, or `rounded-md` — not in the elevation scale
  - Exception: `hover:shadow-md` in HomeView calendar buttons — migrate to `hover:shadow-sm` or `hover:shadow-lg`
