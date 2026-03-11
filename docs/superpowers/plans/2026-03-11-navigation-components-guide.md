# Navigation Components Guide Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a complete navigation component guide (10 files in `Navigation/` subfolder), restructure the existing `tables.md` into a matching `Tables/` subfolder, create a skill for adding future component guides, and build a Paper artboard showcasing all navigation components.

**Architecture:** Documentation-only deliverable (no code changes). Each component guide follows a shared structure referencing `_foundations.md` for common patterns. The tables restructure extracts existing content into the same subfolder pattern. A skill enforces the methodology for future additions.

**Tech Stack:** Markdown documentation, Superpowers skill system, Paper MCP for artboard

**Spec:** `docs/superpowers/specs/2026-03-11-navigation-components-guide-design.md`

**Key Reference Files:**
- Token system: `Documentation/UI Framework/tokens.md`
- Existing tables guide: `Documentation/UI Framework/Components/tables.md`
- Existing sidebar: `src/features/shared/components/navigation/Sidebar.tsx`
- Existing tabs: `src/features/plans/components/PlanTabs.tsx`
- Existing icon bar: `src/features/map/components/IconBar.tsx`
- Existing filters: `src/features/map/components/explore/ExploreFilters.tsx`
- Existing collapsible: `src/features/map/components/panels/district/signals/SignalCard.tsx`
- Existing global filter bar: `src/features/shared/components/filters/FilterBar.tsx`
- Existing pagination: `src/features/map/components/explore/ExploreTable.tsx`

**Parallelism:** Tasks 2-10 are independent of each other (all depend only on Task 1). Task 11 is fully independent. Tasks 12-13 depend on Tasks 1-11 being complete.

---

## Chunk 1: Navigation Foundations + Component Files

> **Agentic workers — placeholder expansion rule:** Throughout this chunk, bracketed placeholders like `[Classes, use case, code example]` indicate sections to write. For each task, read the spec section named in the task's **Reference** field first, then expand every placeholder into full prose, tables, and TSX code examples using the exact hex values, Tailwind classes, and descriptions from the spec. The spec is the authoritative source for all values. Also read `_foundations.md` (once written) and reference it for shared patterns rather than redefining them.
>
> **Gray-check rule for Migration Notes:** Some component files (side-nav.md, tabs.md) include a "Migration Notes" section documenting current `gray-*` usage that needs to change. `gray-` is acceptable ONLY in Migration Notes. If `grep` finds matches, verify they are all within the `## Migration Notes` heading. No `gray-` should appear above that heading.

### Task 1: Create Navigation/_foundations.md

**Files:**
- Create: `Documentation/UI Framework/Components/Navigation/_foundations.md`

**Dependencies:** None

- [ ] **Step 1: Create the Navigation/ directory**

```bash
mkdir -p "Documentation/UI Framework/Components/Navigation"
```

- [ ] **Step 2: Write _foundations.md**

Write the file with these exact sections, pulling all values from the spec's "Navigation Foundations" section:

```markdown
# Navigation Foundations

Shared patterns for all navigation components. Every component guide in this folder
references these foundations. If a pattern is defined here, the component guide should
not redefine it — just reference this file.

All values come from `tokens.md`. No Tailwind grays (`gray-*`) in navigation components.

---

## Active State System — Coral Accent

[Vertical nav spec: border-l-3, bg-[#fef1f0], text-[#F37167]]
[Horizontal nav spec: h-0.5 bottom line, text-[#F37167]]
[Inactive + hover specs]
[Transition: transition-colors duration-100]

## Focus Ring

[Standard: focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none]
[Applied to: list of element types]

## Size Scale

[3-tier table: Small/Medium/Large with Text, Padding, Icon, Use case columns]

## Icon Conventions

[Stroke-based, strokeWidth 2, viewBox 0 0 24 24, currentColor, gap-2]

## Transition Timing

[5-row table: color, expand, panel, chevron, opacity]

## Disabled State

[opacity-50 cursor-not-allowed pointer-events-none]

## Keyboard Conventions

[5-row table: Enter/Space, Escape, Arrow, Tab, Home/End]
```

Use the exact hex values, Tailwind classes, and descriptions from the spec. Every section must include complete, copy-pasteable class strings.

- [ ] **Step 3: Verify no Tailwind grays**

```bash
grep -n "gray-" "Documentation/UI Framework/Components/Navigation/_foundations.md"
```

Expected: No matches.

- [ ] **Step 4: Verify token values match tokens.md**

Spot check: `#fef1f0`, `#F37167`, `#403770`, `#EFEDF5`, `#6E6390`, `#8A80A8`, `#A69DC0`, `#D4CFE2`, `#E2DEEC` should all appear and match their roles in `Documentation/UI Framework/tokens.md`.

- [ ] **Step 5: Commit**

```bash
git add "Documentation/UI Framework/Components/Navigation/_foundations.md"
git commit -m "docs: add navigation component foundations"
```

---

### Task 2: Create Navigation/buttons.md

**Files:**
- Create: `Documentation/UI Framework/Components/Navigation/buttons.md`
- Reference: spec section "Buttons (`buttons.md`)"

**Dependencies:** Task 1

- [ ] **Step 1: Write buttons.md**

Structure:
```markdown
# Buttons

[One-line description: standard button patterns for the territory planner]
[Reference: "See `_foundations.md` for size scale, focus ring, and disabled state."]

## Variants

### Primary
[Classes, use case, code example]

### Secondary (Outlined)
[Classes, use case, code example]

### Destructive
[Classes, use case, code example]

### Ghost
[Classes, use case, code example]

### Icon-Only
[Classes, destructive variant, aria-label requirement, code example]

### Chip/Toggle
[Inactive/active classes, count badge, code example]

## States
[Default, hover, active/pressed (#322a5a), disabled (ref foundations), loading]

## Loading State
[Spinner spec, disabled during load]

## Button Groups
[Horizontal layout, gap per size tier, alignment rules]

## Codebase Examples
[Table: component name → file path for existing button usage]
```

Each variant section must include a complete TSX code example showing the button with proper classes, matching the spec exactly.

- [ ] **Step 2: Verify no Tailwind grays**

```bash
grep -n "gray-" "Documentation/UI Framework/Components/Navigation/buttons.md"
```

Expected: No matches.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Navigation/buttons.md"
git commit -m "docs: add button component guide"
```

---

### Task 3: Create Navigation/breadcrumbs.md

**Files:**
- Create: `Documentation/UI Framework/Components/Navigation/breadcrumbs.md`
- Reference: spec section "Breadcrumbs (`breadcrumbs.md`)"

**Dependencies:** Task 1

- [ ] **Step 1: Write breadcrumbs.md**

Structure:
```markdown
# Breadcrumbs

[One-line: trail navigation for multi-level page hierarchies]
[Reference foundations]
[Note: New component — not yet in codebase]

## Anatomy
[Home > Section > Subsection > Current Page diagram]

## Styling
[Clickable ancestors: text-[#6EA3BE] hover:text-[#403770] hover:underline]
[Current page: text-sm font-medium text-[#403770], not clickable]
[Separator: chevron-right w-3 h-3 text-[#A69DC0], gap-1.5]
[Container: flex items-center gap-1.5 text-sm]

## Truncation
[> 4 levels: middle items collapse to ellipsis button]
[Ellipsis dropdown spec]

## Code Example
[Complete TSX example]

## Keyboard
[Tab through ancestors, Enter/Space on ellipsis]

## Migration Note
[PlansView back-button → breadcrumbs when depth > 1]
```

- [ ] **Step 2: Verify no Tailwind grays**

```bash
grep -n "gray-" "Documentation/UI Framework/Components/Navigation/breadcrumbs.md"
```

Expected: No matches.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Navigation/breadcrumbs.md"
git commit -m "docs: add breadcrumb component guide"
```

---

### Task 4: Create Navigation/collapsible-views.md

**Files:**
- Create: `Documentation/UI Framework/Components/Navigation/collapsible-views.md`
- Reference: spec section "Collapsible Views"
- Codebase reference: `src/features/map/components/panels/district/signals/SignalCard.tsx`

**Dependencies:** Task 1

- [ ] **Step 1: Write collapsible-views.md**

Structure:
```markdown
# Collapsible Views

[One-line: expand/collapse patterns for sections, cards, and sidebar]
[Reference foundations]

## Trigger Anatomy
[Chevron w-3 h-3, rotation, label text-xs, layout flex]

## Patterns

### Card Section Expand
[SignalCard style — footer trigger, border-t separator, code example]

### Section Header Expand (Accordion)
[Heading-as-trigger, chevron left of heading, code example]

### Accordion Variant
[Only one open at a time, behavior spec]

### Sidebar Collapse
[w-[140px] ↔ w-14, toggle button spec]
[Collapsed tooltip: bg-[#403770] text-white text-sm rounded-lg shadow-lg px-2 py-1 z-50]

## States
[Collapsed, expanded, hover on trigger, disabled]

## Keyboard
[Enter/Space toggles, Tab between triggers]

## Codebase Examples
[SignalCard, Sidebar, FloatingPanel, data viz cards]
```

- [ ] **Step 2: Verify no Tailwind grays**

```bash
grep -n "gray-" "Documentation/UI Framework/Components/Navigation/collapsible-views.md"
```

Expected: No matches.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Navigation/collapsible-views.md"
git commit -m "docs: add collapsible views component guide"
```

---

### Task 5: Create Navigation/facets.md

**Files:**
- Create: `Documentation/UI Framework/Components/Navigation/facets.md`
- Reference: spec section "Facets"
- Codebase reference: `src/features/map/components/explore/ExploreFilters.tsx`, `src/features/shared/components/filters/FilterBar.tsx`

**Dependencies:** Task 1

- [ ] **Step 1: Write facets.md**

Structure:
```markdown
# Facets

[One-line: filtering patterns from simple chips to advanced builders]
[Reference foundations]

## Tier 1 — Filter Chips
[Pill toggles, chip/toggle button from buttons.md, gap-2, multi-active]
[Code example]

## Tier 2 — Dropdown Filters
[Trigger button spec, dropdown popover spec, select items]
[Multi-select variant with checkboxes]
[Code example]

## Tier 3 — Advanced Filter Builder
[3-step picker: Column > Operator > Value]
[Picker popover: w-56, border-[#D4CFE2], rounded-lg, shadow-lg]
[Step group labels: text-[10px] font-semibold uppercase tracking-wider text-[#A69DC0]]
[Step items: px-3 py-1.5 text-[13px] text-[#6E6390] hover:bg-[#C4E7E6]/15 hover:text-[#403770]]
[Back button: text-xs text-[#8A80A8] hover:text-[#403770]]
[Apply button: bg-[#403770] text-white text-xs px-3 py-1 rounded-md]
[Value inputs by type: text, enum, number, date, tags, relation]
[Code example]

## Active Filter Display
[Pills: bg-[#C4E7E6]/30 border border-[#C4E7E6]/50 text-[#403770] text-xs rounded-full px-2 py-0.5]
[Remove button: hover:bg-[#C4E7E6]/50, X icon w-3 h-3]
[Clear all: text-xs text-[#8A80A8] hover:text-[#403770]]

## Saved Views
[Save/load/delete, localStorage pattern]

## Keyboard
[Per-tier keyboard interactions]

## Codebase Examples
[FilterBar (global), PlanTabs FilterBar, ExploreFilters]
```

- [ ] **Step 2: Verify no Tailwind grays**

```bash
grep -n "gray-" "Documentation/UI Framework/Components/Navigation/facets.md"
```

Expected: No matches.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Navigation/facets.md"
git commit -m "docs: add facets component guide"
```

---

### Task 6: Create Navigation/links.md

**Files:**
- Create: `Documentation/UI Framework/Components/Navigation/links.md`
- Reference: spec section "Links"

**Dependencies:** Task 1

- [ ] **Step 1: Write links.md**

Structure:
```markdown
# Links

[One-line: text link patterns for inline content and navigation]
[Reference foundations for focus ring]

## Inline Link
[text-[#6EA3BE] hover:underline, inherits font size]
[Use cases: email, phone, URLs in body text]
[Code example]

## Nav Link
[text-[#403770] hover:text-[#F37167], no underline]
[Often paired with icon, flex items-center gap-2]
[Use cases: action navigation]
[Code example]

## External Link
[Inline link + external icon w-3 h-3, target="_blank" rel="noopener noreferrer"]
[Code example]

## Rules
[Focus ring from foundations, cursor-pointer]
[Never text-decoration: none on inline links]

## Codebase Examples
[DistrictDetailsCard phone link, PlansView "Add from Map" nav link]
```

- [ ] **Step 2: Verify no Tailwind grays**

```bash
grep -n "gray-" "Documentation/UI Framework/Components/Navigation/links.md"
```

Expected: No matches.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Navigation/links.md"
git commit -m "docs: add links component guide"
```

---

### Task 7: Create Navigation/pagination.md

**Files:**
- Create: `Documentation/UI Framework/Components/Navigation/pagination.md`
- Reference: spec section "Pagination"

**Dependencies:** Task 1

- [ ] **Step 1: Write pagination.md**

Structure:
```markdown
# Pagination

[One-line: page controls for data collections]
[Note: canonical source — tables docs reference this file]
[Reference foundations]

## Layout
[Flex row, justify-between, mt-3 from content]

## Result Summary (Left)
[text-xs text-[#8A80A8], format strings for normal/filtered]

## Page Controls (Right)
[Full table: container, prev/next, page numbers, active, disabled, ellipsis]
[Code example]

## Items Per Page Selector
[Trigger spec, options: 10/25/50/100, position]

## Keyboard
[Arrow keys, Enter, Tab between selector and controls]

## Codebase Examples
[ExploreTable pagination]
```

- [ ] **Step 2: Verify no Tailwind grays**

```bash
grep -n "gray-" "Documentation/UI Framework/Components/Navigation/pagination.md"
```

Expected: No matches.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Navigation/pagination.md"
git commit -m "docs: add pagination component guide"
```

---

### Task 8: Create Navigation/side-nav.md

**Files:**
- Create: `Documentation/UI Framework/Components/Navigation/side-nav.md`
- Reference: spec section "Side Navigation"
- Codebase reference: `src/features/shared/components/navigation/Sidebar.tsx`, `src/features/map/components/IconBar.tsx`

**Dependencies:** Task 1

- [ ] **Step 1: Write side-nav.md**

Structure:
```markdown
# Side Navigation

[One-line: vertical navigation patterns for app shell and panels]
[Reference foundations for active states, size scale]

## App Sidebar
[Container: bg-white border-r border-[#D4CFE2]]
[Expanded/collapsed widths, transition]
[Nav items: Large size tier, coral active system]
[Divider, collapse toggle, collapsed tooltips]
[Code example — full sidebar component structure]

## Icon Bar (Panel Strip)
[Container: flex flex-col items-center py-3 gap-1 w-[56px] border-r border-[#E2DEEC]]
[Items: w-9 h-9 rounded-xl, Medium icon size]
[Active: bg-[#fef1f0] tint]
[Inactive hover: hover:bg-[#EFEDF5]]
[Quick action button at bottom: bg-[#403770] text-white rounded-xl hover:bg-[#322a5a] shadow-sm]
[Code example]

## Migration Notes
[Sidebar.tsx: border-gray-200 → border-[#D4CFE2]]
[Sidebar.tsx: hover:bg-gray-50 → hover:bg-[#EFEDF5]]
[IconBar.tsx: text-gray-300/400 → text-[#A69DC0]]

## Keyboard
[Arrow keys between items, Tab enters/exits group]

## Codebase Examples
[Sidebar.tsx, IconBar.tsx, AppShell.tsx]
```

- [ ] **Step 2: Verify no Tailwind grays in prescriptive sections**

```bash
grep -n "gray-" "Documentation/UI Framework/Components/Navigation/side-nav.md"
```

Note: `gray-` may appear in Migration Notes section (documenting current state). That's acceptable. It should NOT appear in the prescriptive styling sections above that heading.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Navigation/side-nav.md"
git commit -m "docs: add side navigation component guide"
```

---

### Task 9: Create Navigation/steps.md

**Files:**
- Create: `Documentation/UI Framework/Components/Navigation/steps.md`
- Reference: spec section "Steps"

**Dependencies:** Task 1

- [ ] **Step 1: Write steps.md**

Structure:
```markdown
# Steps

[One-line: stepper/wizard indicators for multi-step flows]
[Note: New component — not yet in codebase]
[Reference foundations]

## Anatomy
[Horizontal stepper: numbered circles + connector lines + labels]

## Circle States
[Table: Completed/Active/Upcoming with circle, text, icon specs]
[Completed: bg-[#403770] text-white, checkmark]
[Active: border-2 border-[#F37167] text-[#F37167]]
[Upcoming: border border-[#D4CFE2] text-[#8A80A8]]

## Connector Lines
[Default: h-0.5 bg-[#D4CFE2] flex-1]
[Completed: h-0.5 bg-[#403770] flex-1]

## Labels
[text-xs font-medium mt-2, color matches circle state]

## Layout
[flex items-center, gap-0, connectors flex-1]

## Compact Variant
[No labels, circles and lines only]

## Code Example
[Complete TSX for 4-step stepper with mixed states]

## Keyboard
[Arrow keys between steps, Enter activates]
```

- [ ] **Step 2: Verify no Tailwind grays**

```bash
grep -n "gray-" "Documentation/UI Framework/Components/Navigation/steps.md"
```

Expected: No matches.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Navigation/steps.md"
git commit -m "docs: add steps component guide"
```

---

### Task 10: Create Navigation/tabs.md

**Files:**
- Create: `Documentation/UI Framework/Components/Navigation/tabs.md`
- Reference: spec section "Tabs"
- Codebase reference: `src/features/plans/components/PlanTabs.tsx`

**Dependencies:** Task 1

- [ ] **Step 1: Write tabs.md**

Structure:
```markdown
# Tabs

[One-line: horizontal and vertical tabbed navigation]
[Reference foundations for active states]

## Horizontal Tabs
[Container: flex items-center border-b border-[#E2DEEC], nav element]
[Tab button: Medium size tier, px-6 py-3]
[Active: coral bottom indicator + text-[#F37167]]
[Inactive: text-[#8A80A8], hover text-[#403770]]
[Icon: optional, w-4 h-4, active text-[#F37167], inactive text-[#A69DC0], inactive hover text-[#6EA3BE]]
[Count badge: active bg-[#403770] text-white text-xs font-semibold, inactive bg-[#EFEDF5] text-[#8A80A8]]
[aria-current="page" on active]
[Code example]

## Vertical Tabs
[Container: flex flex-col gap-1]
[Coral left border active system from foundations]
[Large size tier]
[Code example]

## Migration Notes
[PlanTabs: border-gray-200 → border-[#E2DEEC]]
[PlanTabs: text-gray-500 → text-[#8A80A8]]
[PlanTabs: bg-gray-100 → bg-[#EFEDF5] for inactive badges]

## Keyboard
[Arrow keys between tabs, Home/End, Tab exits group]

## Codebase Examples
[PlanTabs.tsx]
```

- [ ] **Step 2: Verify no Tailwind grays in prescriptive sections**

```bash
grep -n "gray-" "Documentation/UI Framework/Components/Navigation/tabs.md"
```

Note: `gray-` may appear in Migration Notes section (documenting current state). That's acceptable. It should NOT appear in the prescriptive styling sections above that heading.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Navigation/tabs.md"
git commit -m "docs: add tabs component guide"
```

---

### Task 11: Create Navigation/tree-view.md

**Files:**
- Create: `Documentation/UI Framework/Components/Navigation/tree-view.md`
- Reference: spec section "Tree View"

**Dependencies:** Task 1

- [ ] **Step 1: Write tree-view.md**

Structure:
```markdown
# Tree View

[One-line: hierarchical tree navigation for nested data]
[Note: New component — not yet in codebase]
[Reference foundations]

## Node Anatomy
[flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-[#6E6390]]
[Hover: bg-[#EFEDF5]]
[Selected: coral accent — bg-[#fef1f0] text-[#F37167] border-l-3 border-[#F37167]]

## Expand/Collapse
[Chevron w-3.5 h-3.5 text-[#8A80A8], rotation]
[Leaf nodes: no chevron, spacer for alignment]

## Indentation
[pl-6 per nesting level]

## Connector Lines (Optional)
[Vertical: border-l border-[#E2DEEC]]
[Horizontal: border-t border-[#E2DEEC] stub]

## Node Icon (Optional)
[w-4 h-4 between chevron and label, currentColor]

## Code Example
[Complete TSX for 3-level tree with mixed states]

## Keyboard
[Up/Down between nodes, Right expand/child, Left collapse/parent]
[Home/End first/last visible, Enter select]
```

- [ ] **Step 2: Verify no Tailwind grays**

```bash
grep -n "gray-" "Documentation/UI Framework/Components/Navigation/tree-view.md"
```

Expected: No matches.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Navigation/tree-view.md"
git commit -m "docs: add tree view component guide"
```

---

## Chunk 2: Tables Restructure

### Task 12: Split tables.md into Tables/ subfolder

**Files:**
- Read: `Documentation/UI Framework/Components/tables.md`
- Create: `Documentation/UI Framework/Components/Tables/_foundations.md`
- Create: `Documentation/UI Framework/Components/Tables/data-table.md`
- Create: `Documentation/UI Framework/Components/Tables/detail-table.md`
- Create: `Documentation/UI Framework/Components/Tables/compact-table.md`
- Delete: `Documentation/UI Framework/Components/tables.md`

**Dependencies:** None (fully independent of navigation tasks)

- [ ] **Step 1: Create Tables/ directory**

```bash
mkdir -p "Documentation/UI Framework/Components/Tables"
```

- [ ] **Step 2: Read tables.md and identify section boundaries**

Read `Documentation/UI Framework/Components/tables.md`. The file has these sections:

| Lines (approx) | Section | Target file |
|----------------|---------|-------------|
| 1-35 | Header + Table Types overview | `_foundations.md` |
| 36-91 | Shared Foundations | `_foundations.md` |
| 92-576 | Data Table (all subsections) | `data-table.md` |
| 577-603 | Detail Table | `detail-table.md` |
| 604-643 | Compact/Inline Table | `compact-table.md` |
| File Reference table | Component paths | `_foundations.md` |

- [ ] **Step 3: Write Tables/_foundations.md**

Extract lines 1-91 (header, table types overview, shared foundations) and the File Reference table (lines 630-643) into `_foundations.md`.

Add a note at the top:
```markdown
# Table Component Foundations

Standard styling for all data tables in the territory planner. Three table types cover
every use case. All patterns use the Fullmind design token system (`tokens.md`).

For pagination controls, see `Navigation/pagination.md` (canonical source).
```

Keep all content exactly as-is — this is a restructure, not a rewrite.

- [ ] **Step 4: Write Tables/data-table.md**

Extract the "Data Table" section (lines ~92-576) into `data-table.md`.

Add header:
```markdown
# Data Table

Browse, sort, filter, and act on a collection of records. The workhorse table.

See `_foundations.md` for shared wrapper, cell text sizing, and cell padding specs.
```

Replace the inline Pagination section with a reference:
```markdown
### Pagination

See `Navigation/pagination.md` for the canonical pagination spec.
Lives below the table footer, outside the table card. Separated by `mt-3`.
```

- [ ] **Step 5: Write Tables/detail-table.md**

Extract the "Detail Table" section into `detail-table.md`.

Add header:
```markdown
# Detail Table

Display structured attributes of a single entity. Key-value pairs.

See `_foundations.md` for shared wrapper, cell text sizing, and cell padding specs.
```

- [ ] **Step 6: Write Tables/compact-table.md**

Extract the "Compact/Inline Table" section into `compact-table.md`.

Add header:
```markdown
# Compact/Inline Table

Small table embedded within a larger context — a card, panel, or expanded row.

See `_foundations.md` for shared wrapper, cell text sizing, and cell padding specs.
```

- [ ] **Step 7: Verify all content preserved**

```bash
# Count total non-empty lines in original
grep -c '.' "Documentation/UI Framework/Components/tables.md"

# Count total non-empty lines across new files
cat "Documentation/UI Framework/Components/Tables/"*.md | grep -c '.'
```

New total should be >= original (headers added, nothing removed).

- [ ] **Step 8: Delete original tables.md**

```bash
git rm "Documentation/UI Framework/Components/tables.md"
```

- [ ] **Step 9: Commit**

```bash
git add "Documentation/UI Framework/Components/Tables/"
git commit -m "refactor: restructure tables.md into Tables/ subfolder"
```

---

## Chunk 3: Skill + Paper Artboard

### Task 13: Create add-component-guide skill

**Files:**
- Create: `.claude/skills/add-component-guide.md`

**Dependencies:** Tasks 1-12 (needs to see final file structure)

- [ ] **Step 1: Verify skills directory exists**

```bash
ls .claude/skills/ 2>/dev/null || mkdir -p .claude/skills/
```

- [ ] **Step 2: Write the skill file**

```markdown
---
name: add-component-guide
description: Use when adding new component documentation to Documentation/UI Framework/Components/. Enforces subfolder + _foundations.md + individual file methodology.
---

# Add Component Guide

Enforces the standard methodology for adding component documentation to the UI Framework.

## Trigger

When the user asks to add a new component guide, component documentation, or UI pattern
to `Documentation/UI Framework/Components/`.

## Process

### 1. Determine Category

Check existing subfolders in `Documentation/UI Framework/Components/`:
- `Navigation/` — buttons, links, tabs, sidebar, breadcrumbs, pagination, etc.
- `Tables/` — data tables, detail tables, compact/inline tables

Ask the user: does this component belong in an existing category, or does it need a new one?

### 2. If New Category

Create the subfolder and a `_foundations.md` file:

```
Documentation/UI Framework/Components/<Category>/
├── _foundations.md
└── <component>.md
```

The `_foundations.md` must define shared patterns for the category:
- Common states (active, hover, disabled)
- Shared sizing/spacing conventions
- Shared interaction patterns (keyboard, transitions)
- Reference to `tokens.md` for all color/spacing values

### 3. If Existing Category

Read the category's `_foundations.md` to understand shared patterns the new component
must follow.

### 4. Write the Component Guide

Every component file MUST follow this structure. All styling must include complete, copy-pasteable Tailwind class strings with token hex values — not just descriptions.

```markdown
# Component Name

[One-line description of what this component is for]

See `_foundations.md` for [list relevant shared patterns].

---

## Use When
[When to use this component vs alternatives]

## Anatomy
[Visual breakdown of the component's parts]

## Variants
[Each variant with complete Tailwind class strings and TSX code examples]

## States
[Default, hover, active, disabled, focus, loading — as applicable]
[Reference _foundations.md for shared states like disabled and focus ring]

## Keyboard
[All keyboard interactions]

## Codebase Examples
[Table mapping component names to file paths in src/]
```

### 5. Validate

Before committing, verify:
- [ ] No Tailwind grays (`gray-*`) in prescriptive styling — use plum-derived tokens
- [ ] All hex values and shared patterns are traceable to `tokens.md` and `_foundations.md` — no ad-hoc values or redefinitions
- [ ] TSX code examples are complete and copy-pasteable
- [ ] Keyboard interactions are documented
- [ ] File paths in Codebase Examples are accurate

### 6. Commit

```bash
git add "Documentation/UI Framework/Components/<Category>/<component>.md"
git commit -m "docs: add <component> component guide"
```
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/add-component-guide.md
git commit -m "feat: add component guide authoring skill"
```

---

### Task 14: Create Paper artboard for navigation components

**Files:**
- Paper MCP artboard in Mapomatic components file

**Dependencies:** Tasks 1-11 (needs component specs as reference)

- [ ] **Step 1: Get Paper file info**

Use `mcp__paper__get_basic_info` to understand the current file structure and find the components page.

- [ ] **Step 2: Check available fonts**

Use `mcp__paper__get_font_family_info` for "Plus Jakarta Sans" to confirm available weights.

- [ ] **Step 3: Create the artboard**

Use `mcp__paper__create_artboard` with dimensions appropriate for a component specimen page (1440px wide, height to fit).

Title: "Navigation Components"

- [ ] **Step 4: Design tokens reference**

Use these tokens and typography specs for all artboard content:

**Typography (Plus Jakarta Sans throughout):**
- Page title: `24px`, weight 700, color `#403770`
- Page subtitle: `14px`, weight 400, color `#8A80A8`
- Section headers: `18px`, weight 600, color `#403770`
- Component labels: `14px`, weight 500, color `#6E6390`
- Inter-section spacing: `48px`
- Header-to-content gap: `24px`

**Color system:**
- Background: `#FFFCFA`
- Section labels: `#403770` (Plum)
- Body text: `#6E6390`
- Borders: `#D4CFE2`
- Active states: `#F37167` (Coral) + `#fef1f0` (tint)

- [ ] **Step 5: Write header section**

```html
<div style="margin-bottom: 48px;">
  <h1 style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 24px; font-weight: 700; color: #403770; margin: 0 0 8px 0;">Navigation Components</h1>
  <p style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 400; color: #8A80A8; margin: 0;">Reference sheet — Fullmind territory planner</p>
</div>
```

- [ ] **Step 6: Write buttons section**

All 6 variants in Medium size, showing default + hover + active states. One `write_html` call.

- [ ] **Step 7: Write breadcrumbs section**

Example trail with 4 levels. One `write_html` call.

- [ ] **Step 8: Write tabs section**

Horizontal tabs with 4 items (one active, one hovered). One `write_html` call.

- [ ] **Step 9: Write side nav section**

Sidebar snippet showing expanded state with active item. One `write_html` call.

- [ ] **Step 10: Write links section**

All 3 types (inline, nav, external) inline. One `write_html` call.

- [ ] **Step 11: Write collapsible section**

One collapsed, one expanded. One `write_html` call.

- [ ] **Step 12: Write facets section**

Filter chips row + one active filter pill. One `write_html` call.

- [ ] **Step 13: Write pagination section**

Page controls with active page. One `write_html` call.

- [ ] **Step 14: Write steps section**

4-step stepper with completed/active/upcoming states. One `write_html` call.

- [ ] **Step 15: Write tree view section**

3-level tree with expanded/collapsed/selected nodes. One `write_html` call.

- [ ] **Step 16: Review checkpoint**

Use `mcp__paper__get_screenshot` to evaluate against the review checklist:
- Spacing: consistent gaps between sections
- Typography: clear hierarchy, readable sizes
- Contrast: all text readable
- Alignment: components aligned in clean columns
- Clipping: nothing cut off

Fix any issues found.

- [ ] **Step 17: Finish**

Use `mcp__paper__finish_working_on_nodes` to complete the artboard.

> **Note:** No git commit needed for this task — the artboard lives in Paper, not in the repository.
