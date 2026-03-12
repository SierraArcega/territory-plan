# Frontend Design Skill Rewrite + Documentation Improvements

**Date:** 2026-03-11
**Status:** Approved

---

## Problem

The `/frontend-design` skill has stale inline specs that contradict the comprehensive `Documentation/UI Framework/` library:

| Skill says | Docs say |
|------------|----------|
| `border border-gray-200` table wrappers | `border border-[#D4CFE2]` |
| `shadow-2xl` modals | `shadow-xl` max (no `shadow-2xl` in scale) |
| `text-[13px]` table cells | Not in type scale — use `text-sm` (14px) |
| `rounded` buttons | `rounded-lg` |
| `bg-gray-50/80` table headers | `bg-[#F7F5FA]` (Surface Raised) |
| `text-gray-500/600` throughout | Plum-derived neutrals only |
| 4 breakpoints | 3 breakpoints (base, sm, xl) |
| References `Docs/components/tables.md` | Path is `Documentation/UI Framework/Components/Tables/` |
| No Paper reference | Paper design system has 6 artboards matching doc categories |

Agents following the skill produce non-conforming output.

---

## Design

### 1. Skill Rewrite — Router Architecture

The skill becomes a **routing layer** that teaches agents how to navigate the documentation and Paper design system. It no longer duplicates component specs.

**Keep inline (can't-violate rules + creative direction):**
- Brand overview + design thinking section
- Critical color rules (warm = negative, Plum = UI, no Tailwind grays)
- Critical typography rules (Plus Jakarta Sans only, 5-tier type scale)
- Figma MCP integration workflow
- Tech stack quick reference
- Common mistakes table (updated to match docs)

**Replace with doc routing:**
- All component patterns (tables, badges, buttons, modals, etc.)
- Spacing scale details
- Data visualization specs
- Responsive breakpoints
- Elevation/shadow/radius details

**Add new:**
- **Documentation Lookup Workflow** — decision tree routing agents to the right doc
- **Paper MCP Integration** — artboard ID map + instructions to screenshot for visual reference
- **Doc reading protocol** — always read `tokens.md` first, then category `_foundations.md`, then specific guide

**Skill structure:**
```
1. When to Use
2. Design Thinking (keep)
3. Documentation System (NEW — routing + lookup workflow)
4. Paper Design System Integration (NEW)
5. Figma Integration (keep, update paths)
6. Critical Brand Rules (condensed from current)
7. Tech Stack Quick Reference (keep)
8. Common Mistakes (updated)
```

### 2. Documentation Improvements

#### 2a. Add Paper Artboard References to _foundations.md Files

Each category `_foundations.md` gets a "Visual Reference" section with its Paper artboard ID:

| Doc | Paper Artboard | ID |
|-----|---------------|-----|
| `Components/Tables/_foundations.md` | Tables | `1CS-0` |
| `Components/forms.md` | Forms | `1PX-1` |
| `Components/Navigation/_foundations.md` | Navigation | `1VO-1` |
| `Components/Layouts/_foundations.md` | Layouts | `22F-1` |
| `Components/Containers/_foundations.md` | Containers | `28W-1` |
| `Components/Display/_foundations.md` | Display | `293-1` |
| `Components/Data Visualization/_foundations.md` | *(none yet)* | — |
| `Patterns/_foundations.md` | *(none yet)* | — |

#### 2b. Fix Non-Conforming Code Examples

`detail-views.md` has canonical code blocks using Tailwind grays (`border-gray-100`, `text-gray-500`, `hover:bg-gray-100`, `stroke="#6B7280"`). The migration notes are good but the **canonical examples should show correct tokens**. Migration notes go in a separate "Migration" section at the bottom (which they already do in some places).

#### 2c. Remove Empty Directories

Delete `Documentation/UI Framework/Content/` and `Documentation/UI Framework/Utilities/` (both empty).

---

## Out of Scope

- No changes to the actual component documentation content (it's solid)
- No new documentation files
- No changes to the codebase components themselves
- No changes to `tokens.md` (it's the authoritative root)

---

## Paper Artboard → Documentation Map

For reference, the full mapping of Paper sections to documentation files:

**Tables artboard (`1CS-0`):**
- Data Table Full Example → `Components/Tables/data-table.md`
- Sorting Indicators → `Components/Tables/data-table.md` § Sorting
- Pagination → `Components/Navigation/pagination.md`
- Actions Overflow → `Components/Tables/data-table.md` § Row Actions
- Loading/Error States → `Components/Tables/_foundations.md` (shared)
- Truncation → `Components/Tables/data-table.md` § Truncation
- Expanding Row → `Components/Tables/data-table.md` § Expanding Rows
- Detail Table → `Components/Tables/detail-table.md`
- Compact Table → `Components/Tables/compact-table.md`
- Data Grid (saved views, filter bar, column picker, bulk actions, accessibility) → `Components/Tables/data-grid.md`

**Forms artboard (`1PX-1`):**
- Input States → `Components/forms.md` § Shared Foundations
- Modal Form → `Components/forms.md` § Modal Form Pattern
- Panel Form → `Components/forms.md` § Panel Form Pattern
- Inline Edit → `Components/forms.md` § Inline Editing Pattern
- Select, Checkbox/Radio, Toggle, Currency, Textarea, Date → `Components/forms.md` § Input Types
- Keyboard Reference → `Components/forms.md` § Keyboard Interactions

**Navigation artboard (`1VO-1`):**
- Buttons → `Components/Navigation/buttons.md`
- Breadcrumbs → `Components/Navigation/breadcrumbs.md`
- Tabs → `Components/Navigation/tabs.md`
- Side Nav → `Components/Navigation/side-nav.md`
- Links → `Components/Navigation/links.md`
- Collapsible → related to `Components/Containers/accordion.md`
- Facets → `Components/Navigation/facets.md`
- Pagination → `Components/Navigation/pagination.md`
- Steps → `Components/Navigation/steps.md`
- Tree View → `Components/Navigation/tree-view.md`

**Layouts artboard (`22F-1`):**
- Foundations → `Components/Layouts/_foundations.md`
- Page Shells → `Components/Layouts/page-shells.md`
- Sidebar & Panels → `Components/Layouts/sidebar-and-panels.md`
- Grids + Composition → `Components/Layouts/grids-and-composition.md`
- App Shell + Map Shell → `Components/Layouts/page-shells.md`

**Containers artboard (`28W-1`):**
- Decision Tree → `Components/Containers/_foundations.md`
- Shared Foundations → `Components/Containers/_foundations.md`
- Card → `Components/Containers/card.md`
- Modal → `Components/Containers/modal.md`
- Popover → `Components/Containers/popover.md`
- Tabs → `Components/Containers/tabs.md`
- Accordion → `Components/Containers/accordion.md`
- Bottom Bar → `Components/Containers/bottom-bar.md`
- Panel + Flyout → `Components/Containers/panel.md` + `Components/Containers/flyout.md`

**Display artboard (`293-1`):**
- Badges → `Components/Display/badges.md`
- Stats → `Components/Display/stats.md`
- Progress → `Components/Display/progress.md`
- Loading → `Components/Display/loading.md`
- Tooltips → `Components/Display/tooltips.md`
- Empty States → `Components/Display/empty-states.md`
- Callouts → `Components/Display/callouts.md`
- Cards → `Components/Display/cards.md`
