# Layouts Component Guide Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `Layouts/` folder in `Documentation/UI Framework/Components/` with 4 markdown files documenting 12 layout patterns used in the Fullmind territory planner.

**Architecture:** Pure documentation — 4 markdown files following the established format from `Tables/_foundations.md`. Each file contains code snippets extracted from the actual codebase, "Key classes" callouts, "Rules" lists, and file reference tables. No code changes, no new components.

**Tech Stack:** Markdown, Tailwind CSS class documentation

**Spec:** `docs/superpowers/specs/2026-03-11-layouts-guide-design.md`

---

## Chunk 1: Foundation and Page Shell Files

### Task 1: Create `_foundations.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Layouts/_foundations.md`

**Reference files to read before writing:**
- `Documentation/UI Framework/tokens.md` (spacing rhythm, breakpoints, elevation, borders)
- `Documentation/UI Framework/Components/Tables/_foundations.md` (format reference)
- `Documentation/UI Framework/Components/Navigation/_foundations.md` (format reference)

- [ ] **Step 1: Create the Layouts directory**

```bash
mkdir -p "Documentation/UI Framework/Components/Layouts"
```

- [ ] **Step 2: Write `_foundations.md`**

Create `Documentation/UI Framework/Components/Layouts/_foundations.md` with the following sections. Content is defined in the spec under "File 1: `_foundations.md`":

1. **Header** — "Layout Foundations" title + intro paragraph stating these are shared rules all layout pattern files reference. Note: "All values come from `tokens.md`. New code uses plum-derived neutrals, not Tailwind grays."
2. **Flex vs Grid Decision Tree** — table with "Reach for" and "When" columns
3. **Shared Spacing Rules** — table referencing tokens.md Spacing Rhythm (gap-6/8 sections, gap-3/4 cards, gap-1.5/2 elements)
4. **Content Width Capping** — `max-w-6xl mx-auto` rule, when to use vs not
5. **Responsive Conventions** — core breakpoints from tokens.md + note that `md:` and `lg:` are used in layout contexts
6. **Full-Height Convention** — `h-full overflow-auto`, `flex-1`, `min-h-0`, `min-w-0` rules
7. **Anti-Patterns** — list of things to avoid (arbitrary gaps, nested scroll, w-screen, shadow-md, rounded-sm/md)

- [ ] **Step 3: Verify the file**

Read the file back and confirm:
- Format matches `Tables/_foundations.md` structure (section headings, tables, rules lists)
- All hex values match `tokens.md`
- No Tailwind gray references except in migration notes

- [ ] **Step 4: Commit**

```bash
git add "Documentation/UI Framework/Components/Layouts/_foundations.md"
git commit -m "docs: add layout foundations — shared spacing, flex/grid, responsive rules"
```

---

### Task 2: Create `page-shells.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Layouts/page-shells.md`

**Reference files to read before writing:**
- `docs/superpowers/specs/2026-03-11-layouts-guide-design.md` (File 2 section)
- `src/features/shared/components/layout/AppShell.tsx` (App Shell pattern)
- `src/features/shared/components/views/HomeView.tsx:360-397` (Dashboard Shell)
- `src/features/shared/components/views/PlansView.tsx:138-170` (Standard Page Shell)
- `src/features/map/components/MapV2Shell.tsx:74-109` (Canvas Shell)

- [ ] **Step 1: Write `page-shells.md`**

Create `Documentation/UI Framework/Components/Layouts/page-shells.md` with 4 patterns from the spec:

**Pattern 1: App Shell (Root Layout)**
- Intro: "The outermost container. Every view renders inside this."
- Code snippet: the `fixed inset-0 flex flex-col` structure from AppShell.tsx
- Key classes: `fixed inset-0`, `flex flex-col`, `flex-1 flex overflow-hidden min-h-0`, `main flex-1 relative overflow-hidden`
- File reference: `AppShell.tsx`

**Pattern 2: Standard Page Shell**
- "Use when" intro: scrollable page with header + content
- Code snippet: `h-full overflow-auto bg-[#FFFCFA]` with header and main
- Key classes with migration note for `border-[#E2DEEC]` (existing code uses `border-gray-200`)
- Examples: PlansView, TasksView, ActivitiesView

**Pattern 3: Dashboard Shell**
- "Use when" intro: gradient banner with overlapping content
- Code snippet: the gradient + `-mt-20` overlap pattern from HomeView
- Key classes including the 4-stop gradient value and dashboard card variant (`rounded-2xl`, `border-gray-100`)
- Example: HomeView

**Pattern 4: Canvas Shell (Map)**
- "Use when" intro: full-bleed canvas with floating chrome
- Code snippet: `relative w-full h-full overflow-hidden` with absolute overlays
- Key classes: z-index layers, dynamic panel widths
- Rules: no scrolling, all chrome absolutely positioned, auto-collapse breakpoint
- File reference: `MapV2Shell.tsx`

End with a **File Reference** table listing AppShell.tsx, HomeView.tsx, PlansView.tsx, MapV2Shell.tsx, FloatingPanel.tsx.

- [ ] **Step 2: Verify the file**

Read the file back and confirm:
- All 4 patterns present with code snippets
- Gradient has 4 stops matching HomeView
- Migration notes present for gray borders
- File reference table at bottom

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Layouts/page-shells.md"
git commit -m "docs: add page shell patterns — app shell, standard, dashboard, canvas"
```

---

## Chunk 2: Sidebar, Grids, and Composition Files

### Task 3: Create `sidebar-and-panels.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Layouts/sidebar-and-panels.md`

**Reference files to read before writing:**
- `docs/superpowers/specs/2026-03-11-layouts-guide-design.md` (File 3 section)
- `src/features/activities/components/CalendarView.tsx:114-119` (Sidebar + Content)
- `src/features/shared/components/views/PlansView.tsx:426-546` (Push Panel)
- `src/features/map/components/FloatingPanel.tsx` (Scrollable Container)

- [ ] **Step 1: Write `sidebar-and-panels.md`**

Create `Documentation/UI Framework/Components/Layouts/sidebar-and-panels.md` with 3 patterns from the spec:

**Pattern 5: Sidebar + Content**
- Code snippet: `flex h-full` with `flex-1 min-w-0` main and `w-[280px] flex-shrink-0` sidebar
- Key classes with migration note for `border-[#E2DEEC]`
- Rules: `min-w-0` critical, conditionally rendered, always right side
- Examples: CalendarView, PlanDetailView right panel

**Pattern 6: Collapsible Side Panel (Push)**
- Code snippet: `transition-[margin] duration-300` with `mr-[420px]`
- Key classes
- **Composite example callout** for PlanDetailView (combines Page Shell + Push Panel + tab bar)
- Example: PlanDetailView district panel

**Pattern 7: Scrollable Container**
- Code snippet: `flex flex-col h-full` with header/body/footer zones
- Key classes: `flex-1 overflow-y-auto`, `border-b`, `border-t bg-[#F7F5FA]`
- Rules: never nest scrollable containers, footer optional, plum-derived borders
- Examples: FloatingPanel, all panel content areas, unscheduled activities list

End with **File Reference** table.

- [ ] **Step 2: Verify the file**

Read the file back and confirm:
- All 3 patterns present
- PlanDetailView composite callout included
- Scrollable container uses plum-derived borders (`#E2DEEC`)

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Layouts/sidebar-and-panels.md"
git commit -m "docs: add sidebar and panel patterns — sidebar+content, push panel, scrollable"
```

---

### Task 4: Create `grids-and-composition.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Layouts/grids-and-composition.md`

**Reference files to read before writing:**
- `docs/superpowers/specs/2026-03-11-layouts-guide-design.md` (File 4 section)
- `src/features/shared/components/views/HomeView.tsx:477-605` (Grid patterns)
- `src/features/shared/components/views/PlansView.tsx:196-210` (Card grid)

- [ ] **Step 1: Write `grids-and-composition.md`**

Create `Documentation/UI Framework/Components/Layouts/grids-and-composition.md` with two sub-sections and 5 patterns from the spec:

**Sub-section: Grid Layouts**

**Pattern 8: Card Grid (Responsive)**
- Code snippet: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- Variants table: 3-column, 2x3 compact, 4-column

**Pattern 9: Asymmetric Columns**
- Code snippet: `grid grid-cols-1 lg:grid-cols-5 gap-6` with col-span
- Ratios table: 3/2 split, equal split, 7-column fixed
- Example: HomeView plans + tasks

**Sub-section: Inline Composition**

**Pattern 10: Toolbar / Action Bar**
- Code snippet: `flex items-center justify-between`
- Key classes

**Pattern 11: Label + Value Pairs**
- Code snippet: `flex items-center gap-2` with dot separators
- Key classes: `min-w-0`, `truncate`, `flex-shrink-0`

**Pattern 12: Badge / Pill Rows**
- Code snippets: inline (`flex items-center gap-1.5`) and wrapping (`flex flex-wrap gap-2`)
- Key classes

End with **File Reference** table.

- [ ] **Step 2: Verify the file**

Read the file back and confirm:
- "Grid Layouts" and "Inline Composition" sub-headings present
- All 5 patterns with code snippets
- Variants/ratios documented

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Layouts/grids-and-composition.md"
git commit -m "docs: add grid and composition patterns — card grids, columns, toolbars, badges"
```

---

### Task 5: Final verification and summary commit

**Files:**
- Verify all 4 files exist in `Documentation/UI Framework/Components/Layouts/`

- [ ] **Step 1: Verify folder structure**

```bash
ls -la "Documentation/UI Framework/Components/Layouts/"
```

Expected output: 4 files — `_foundations.md`, `page-shells.md`, `sidebar-and-panels.md`, `grids-and-composition.md`

- [ ] **Step 2: Cross-reference check**

Verify that:
- `_foundations.md` is referenced by the other 3 files (each should say "see `_foundations.md` for shared rules")
- All hex values match `tokens.md`
- All file paths in File Reference tables resolve to actual files
- Pattern numbering is consistent (1-12) across all files

- [ ] **Step 3: Fix any issues found and commit if needed**

If cross-reference issues are found, fix them and commit:

```bash
git add "Documentation/UI Framework/Components/Layouts/"
git commit -m "docs: cross-reference fixes for layout guide"
```
