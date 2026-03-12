# Layouts Component Guide — Design Spec

**Date:** 2026-03-11
**Status:** Draft
**Scope:** Documentation only (no new components)

---

## Goal

Establish a layout pattern system for the Fullmind territory planner. The guide documents blessed Tailwind class combinations for every layout scenario — page-level structure and component-level composition — so developers know exactly which classes to reach for when building new features or updating existing code.

## Decisions

- **Tailwind patterns only** — no wrapper components. Matches the existing codebase and doc conventions (Tables/, Navigation/).
- **Subfolder structure** — `Documentation/UI Framework/Components/Layouts/` with `_foundations.md` + 3 pattern files.
- **8 patterns** across 2 levels (page-level and component-level), grouped into 4 files.
- **Paper companion** — visual reference artboard added to Mapomatic Components page.

## File Structure

```
Documentation/UI Framework/Components/Layouts/
  _foundations.md          # Shared rules all patterns reference
  page-shells.md           # App Shell, Page Shell, Dashboard Shell, Canvas Shell
  sidebar-and-panels.md    # Sidebar+content, floating panels, scrollable containers
  grids-and-composition.md # Card grids, asymmetric columns, toolbars, label+value, badges
```

## Format Convention

Each file follows the established pattern from Tables/ and Navigation/:
- Section intro with "Use when" guidance
- Code snippet with actual Tailwind classes from the codebase
- "Key classes" callout explaining critical classes
- "Rules" list for constraints and gotchas
- Codebase examples (which files use this pattern)
- File reference table at the bottom

All values reference `tokens.md`. No Tailwind grays (`gray-*`) in new code — use plum-derived neutrals.

---

## File 1: `_foundations.md`

### Flex vs Grid Decision Tree

| Reach for | When |
|-----------|------|
| Flex | Single-axis flow — rows, columns, toolbars, stacking sections, sidebar + content |
| Grid | Two-dimensional alignment — card grids, dashboard columns, calendar cells, equal splits |

### Shared Spacing Rules

Applied from `tokens.md` Spacing Rhythm section:

| Context | Gap | Example |
|---------|-----|---------|
| Between sections | `gap-6` or `gap-8` | Space between "Goals" and "Plans" sections |
| Between cards/groups | `gap-3` or `gap-4` | Cards in a list, rows in a group |
| Between elements in a group | `gap-1.5` or `gap-2` | Label + value, icon + text |

### Content Width Capping

- `max-w-6xl mx-auto` — used on all non-map pages (PlansView, HomeView, ActivitiesView)
- Applied to both `<header>` and `<main>` content areas
- Do NOT use on map view or full-bleed layouts

### Responsive Conventions

Three breakpoints from `tokens.md`:
- Base (0+): single column, mobile-first
- `sm:` (640px+): panel appears, mobile drawer hides
- `lg:` or `xl:` (1024px+/1280px+): multi-column grids, sidebar always visible

Layout shifts: `grid-cols-1` at base, `md:grid-cols-2` at tablet, `lg:grid-cols-3` at desktop.

### Full-Height Convention

- Root of every view: `h-full overflow-auto bg-[#FFFCFA]`
- Use `flex-1` to fill remaining space inside a flex parent
- Use `min-h-0` on flex children that contain scrollable content (prevents overflow)
- Use `min-w-0` on flex children that contain truncatable text

### Anti-Patterns

- Arbitrary pixel gaps (`gap-[13px]`, `p-[7px]`) — use Tailwind's 4px grid
- Nested scroll containers — only one scrollable area per view
- `w-screen` / `h-screen` — use `h-full` (views live inside AppShell, not the viewport)
- `shadow-md` or `rounded-sm` / `rounded-md` — not in the elevation scale

---

## File 2: `page-shells.md`

### Pattern 1: App Shell (Root Layout)

The outermost container. Every view renders inside this.

```tsx
<div className="fixed inset-0 flex flex-col bg-[#FFFCFA] overflow-hidden">
  <FilterBar activeTab={activeTab} />
  <div className="flex-1 flex overflow-hidden min-h-0">
    <Sidebar />
    <main className="flex-1 relative overflow-hidden">
      {children}
    </main>
  </div>
</div>
```

Key classes:
- `fixed inset-0` — viewport-filling root
- `flex flex-col` — vertical stack (FilterBar on top, content below)
- `flex-1 flex overflow-hidden min-h-0` — sidebar + content row
- `main flex-1 relative overflow-hidden` — content area fills remaining space

File: `src/features/shared/components/layout/AppShell.tsx`

### Pattern 2: Standard Page Shell

Used by PlansView, TasksView, ActivitiesView — scrollable page with header + content.

```tsx
<div className="h-full overflow-auto bg-[#FFFCFA]">
  <header className="bg-white border-b border-gray-200 px-6 py-4">
    <div className="max-w-6xl mx-auto flex items-center justify-between">
      {/* Title + actions */}
    </div>
  </header>
  <main className="max-w-6xl mx-auto px-6 py-8">
    {/* Content sections */}
  </main>
</div>
```

Key classes:
- `h-full overflow-auto` — fills AppShell content area, scrolls vertically
- `bg-[#FFFCFA]` — Off-White page background
- `max-w-6xl mx-auto` — caps content width, centers on wide screens
- Header: `bg-white border-b` with `px-6 py-4`
- Content: `px-6 py-8`

### Pattern 3: Dashboard Shell

Used by HomeView — gradient banner with negative-margin content overlap.

```tsx
<div className="h-full overflow-auto bg-[#FFFCFA]">
  <div className="px-8 pt-8 pb-28"
       style={{ background: "linear-gradient(135deg, #403770 0%, #5c4785 100%)" }}>
    <div className="max-w-6xl mx-auto">
      {/* Greeting, date, stats */}
    </div>
  </div>
  <div className="relative -mt-20 px-8 pb-8">
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Content sections overlap the banner */}
    </div>
  </div>
</div>
```

Key classes:
- Banner: `px-8 pt-8 pb-28` — extra bottom padding creates overlap zone
- Content: `relative -mt-20` — pulls content up into the banner
- Sections: `space-y-6` — consistent vertical rhythm between cards

### Pattern 4: Canvas Shell (Map)

Used by MapV2Shell — full-bleed canvas with floating chrome overlays.

```tsx
<div className="relative w-full h-full overflow-hidden bg-[#F8F7F4]">
  <MapV2Container />          {/* absolute inset-0, behind everything */}
  <FloatingPanel />            {/* absolute top-10 left-12 z-20 */}
  <MultiSelectChip />          {/* absolute, z-10 */}
  <SelectModePill />           {/* absolute top-right, z-10 */}
  <MapSummaryBar />            {/* absolute bottom left/right, z-10 */}
  <LayerBubble />              {/* absolute bottom-right, z-20 */}
</div>
```

Key classes:
- `relative w-full h-full overflow-hidden` — fills parent, no scroll
- Canvas: renders at `absolute inset-0` behind all overlays
- All chrome: absolutely positioned at various z-indices
- Z-layers: `z-10` for map chrome, `z-20` for panels/controls (from `tokens.md`)

Rules:
- No scrolling — canvas handles pan/zoom internally
- All UI elements float above the canvas via absolute positioning
- Dynamic panel widths: `w-[33vw] min-w-[340px] max-w-[520px]`
- Auto-collapse floating panel at `max-width: 1023px`

File: `src/features/map/components/MapV2Shell.tsx`

---

## File 3: `sidebar-and-panels.md`

### Pattern 5: Sidebar + Content

Two-column layout with fixed-width sidebar and flexible main area.

```tsx
<div className="flex h-full">
  <div className="flex-1 flex flex-col min-w-0">
    {/* Main content */}
  </div>
  {panelOpen && (
    <div className="w-[280px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col">
      {/* Sidebar content */}
    </div>
  )}
</div>
```

Key classes:
- Container: `flex h-full`
- Main: `flex-1 flex flex-col min-w-0` — stretches, prevents text overflow
- Sidebar: `w-[280px] flex-shrink-0` — fixed width, never shrinks
- `border-l border-gray-200` — visual separator

Rules:
- `min-w-0` on main area is critical — without it, long content overflows
- Sidebar is conditionally rendered (not hidden with CSS)
- Sidebar always on the right side in current codebase

Examples: CalendarView, PlanDetailView right panel

### Pattern 6: Collapsible Side Panel (Push)

Content area adjusts margin when panel opens, with transition.

```tsx
<main className={`mx-auto px-6 py-4 transition-[margin] duration-300 ${
  panelOpen ? "mr-[420px]" : "max-w-7xl"
}`}>
  {/* Content pushes left when panel opens */}
</main>
{panelOpen && <PanelComponent />}
```

Key classes:
- `transition-[margin] duration-300` — smooth push animation
- `mr-[420px]` — makes room for the panel
- Panel is fixed-position on the right edge

Example: PlanDetailView district panel

### Pattern 7: Scrollable Container

Three-zone panel: fixed header, scrollable body, fixed footer.

```tsx
<div className="flex flex-col h-full">
  <div className="px-4 py-3 border-b border-[#E2DEEC]">
    {/* Fixed header */}
  </div>
  <div className="flex-1 overflow-y-auto">
    {/* Scrollable content */}
  </div>
  <div className="px-4 py-2.5 border-t border-[#E2DEEC] bg-[#F7F5FA]">
    {/* Fixed footer (optional) */}
  </div>
</div>
```

Key classes:
- Container: `flex flex-col h-full`
- Header: `border-b` — stays pinned
- Body: `flex-1 overflow-y-auto` — scrolls independently
- Footer: `border-t bg-[#F7F5FA]` — stays pinned

Rules:
- Never nest scrollable containers inside each other
- Footer is optional — omit for panels without actions
- Header and footer use plum-derived borders (`#E2DEEC`), not `gray-200`

Examples: FloatingPanel, all panel content areas, unscheduled activities list

---

## File 4: `grids-and-composition.md`

### Pattern 8: Card Grid (Responsive)

Responsive grid that adapts from 1 to 3 columns.

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id} />)}
</div>
```

Variants:
- 3-column: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` (PlansListView)
- 2×3 compact: `grid-cols-2 md:grid-cols-3 gap-3` (HomeView plan cards)
- 4-column: `grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6` (goal donut charts)

### Pattern 9: Asymmetric Columns

Weighted column splits for primary + secondary content.

```tsx
<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
  <div className="lg:col-span-3">{/* Primary */}</div>
  <div className="lg:col-span-2">{/* Secondary */}</div>
</div>
```

Ratios:
- 3/2 split: `lg:grid-cols-5` with `col-span-3` / `col-span-2` — primary + secondary (HomeView plans + tasks)
- Equal split: `lg:grid-cols-2 gap-4` — equal weight (indicator panels)
- 7-column fixed: `grid grid-cols-7` — calendar day grid

### Pattern 10: Toolbar / Action Bar

Horizontal flex row with title left, actions right.

```tsx
<div className="flex items-center justify-between">
  <div>
    <h2 className="text-base font-semibold text-[#403770]">Section Title</h2>
    <p className="text-sm text-[#8A80A8]">Description</p>
  </div>
  <div className="flex items-center gap-2">
    <button>{/* Secondary action */}</button>
    <button>{/* Primary action */}</button>
  </div>
</div>
```

Key classes:
- `flex items-center justify-between` — space between left and right groups
- Action group: `flex items-center gap-2`
- Tighter controls: `gap-1.5`

### Pattern 11: Label + Value Pairs

Inline metadata with dot separators.

```tsx
<div className="flex items-center gap-2">
  <span className="text-sm font-medium text-[#403770]">Sarah Johnson</span>
  <span className="text-[#A69DC0]">&middot;</span>
  <span className="text-xs text-[#8A80A8]">3 districts</span>
  <span className="text-[#A69DC0]">&middot;</span>
  <span className="text-xs text-[#8A80A8]">FY26</span>
</div>
```

Key classes:
- `flex items-center gap-2` for dot-separated metadata
- `flex items-center gap-1.5` for icon + text pairs
- `min-w-0` + `truncate` on flexible text elements
- `flex-shrink-0` on fixed-size elements (icons, badges)

### Pattern 12: Badge / Pill Rows

Inline or wrapping lists of tags and status indicators.

```tsx
{/* Inline (no wrap) */}
<div className="flex items-center gap-1.5 flex-shrink-0">
  <Badge />
  <Badge />
</div>

{/* Wrapping */}
<div className="flex flex-wrap gap-2">
  <Pill />
  <Pill />
  <Pill />
</div>
```

Key classes:
- Inline: `flex items-center gap-1.5 flex-shrink-0`
- Wrapping: `flex flex-wrap gap-2`
- Each badge/pill: `rounded-full` per elevation tokens

---

## Paper Companion

Visual reference artboard added to the Mapomatic file (Components page, "Layouts" artboard). Contains wireframe diagrams for all patterns with annotated Tailwind classes. Intended as a quick visual lookup — the markdown files are the canonical source of truth.

## File Reference

| What | Where |
|------|-------|
| App Shell | `src/features/shared/components/layout/AppShell.tsx` |
| FilterBar | `src/features/shared/components/filters/FilterBar.tsx` |
| Sidebar | `src/features/shared/components/navigation/Sidebar.tsx` |
| MapV2Shell | `src/features/map/components/MapV2Shell.tsx` |
| FloatingPanel | `src/features/map/components/FloatingPanel.tsx` |
| HomeView | `src/features/shared/components/views/HomeView.tsx` |
| PlansView | `src/features/shared/components/views/PlansView.tsx` |
| CalendarView | `src/features/activities/components/CalendarView.tsx` |
| ActivitiesView | `src/features/shared/components/views/ActivitiesView.tsx` |
| TasksView | `src/features/shared/components/views/TasksView.tsx` |
| Design tokens | `Documentation/UI Framework/tokens.md` |
