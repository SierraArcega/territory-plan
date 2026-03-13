---
name: design-review
description: Use after frontend implementation to audit code against Documentation/UI Framework/ specs and Paper prototype structure. Code-level design QA — reads .tsx files and checks Tailwind classes, not browser screenshots.
---

# Design Review

Post-implementation design QA. Audits the built code against the `Documentation/UI Framework/` docs (single source of truth) and the approved Paper prototype structure.

This is a **code-level audit** — it reads `.tsx` files and checks Tailwind classes. It does not take browser screenshots.

## When to Use

- After frontend implementation, before code review
- Invoked by `/new-feature` orchestrator during stage 7a
- Standalone via `/design-review` for any frontend work
- Replaces the old `design-qa.md` prompt (which used outdated Tailwind gray values)

## Inputs

- **Files to review** — list of `.tsx` files created or modified (from implementer report, or from `git diff --name-only`)
- **Paper prototype node IDs** (optional) — if a Paper prototype was created during design exploration
- **Feature spec path** (optional) — for understanding what was intended

## Process

### 1. Read the Implemented Code

Read every `.tsx` file that was created or modified. Focus on:
- Tailwind class values (colors, spacing, elevation, radius, borders)
- Component structure and JSX patterns
- Typography classes (font sizes, weights, tracking)
- Icon usage (library, sizing, color binding)

### 2. Read the Relevant Docs

**Always read:** `Documentation/UI Framework/tokens.md`

Then read the `_foundations.md` and specific guides for each component type found in the code:

| Found in code | Read |
|---------------|------|
| Tables, grids, data lists | `Components/Tables/_foundations.md` → specific guide |
| Forms, inputs, selects | `Components/forms.md` |
| Buttons, tabs, nav, breadcrumbs | `Components/Navigation/_foundations.md` → specific guide |
| Cards, modals, popovers, panels | `Components/Containers/_foundations.md` → specific guide |
| Badges, stats, tooltips, empty states | `Components/Display/_foundations.md` → specific guide |
| Charts | `Components/Data Visualization/_foundations.md` → specific guide |
| Page layouts, shells | `Components/Layouts/_foundations.md` → specific guide |
| Multi-component patterns | `Patterns/_foundations.md` → specific guide |
| Icons, emojis | `iconography.md` |

### 3. Check Paper Prototype Structure (if available)

If Paper prototype node IDs were provided:
```
mcp__paper__get_tree_summary(nodeId: "<prototype-node-id>")
```

Compare the structural hierarchy (component nesting, information order, layout type) — not pixel measurements.

### 4. Audit Against Rubric

| Category | Check | Source of Truth |
|----------|-------|----------------|
| Token compliance | All colors, spacing, elevation, radius, borders from token system — no Tailwind grays (`gray-*`), no arbitrary hex | `tokens.md` |
| Typography | 5-tier scale only, correct weights, Plus Jakarta Sans | `tokens.md` § Typography |
| Layout structure | Component hierarchy matches Paper prototype (if available) | `get_tree_summary` on prototype |
| Component correctness | Each component follows its doc spec | Category `_foundations.md` + specific guide |
| States | Loading, empty, error states implemented per docs | `Patterns/_foundations.md`, component guides |
| Icons | Lucide only, `currentColor`, correct size tier, semantic map | `iconography.md` |
| Component reuse | Tables use DataGrid, toolbars use standard filter/sort/column patterns, forms use shared form primitives — no hand-built equivalents | `Tables/_foundations.md` § Standard Foundation, shared component inventory |
| Accessibility | ARIA labels, keyboard nav, focus rings | `Navigation/_foundations.md` § Focus Ring |

### 5. Report

```markdown
## Design Review: [Feature Name]

### Overall: PASS / ISSUES FOUND / BLOCKERS

### Files Reviewed
- [file:lines] — [what it contains]

### Findings
1. [BLOCKER] file.tsx:42 — Table header uses `bg-gray-50` instead of `bg-[#F7F5FA]`
   Source: tokens.md § Surface colors
   Fix: Replace `bg-gray-50` with `bg-[#F7F5FA]`

2. [WARNING] file.tsx:87 — Card uses `rounded-xl` but doc spec says `rounded-lg`
   Source: Containers/_foundations.md § Border Radius
   Fix: Replace `rounded-xl` with `rounded-lg`

3. [NIT] file.tsx:120 — List items could use staggered entrance animation
   Source: design-explore craft guidance § Motion design
   Suggestion: Add `animation-delay` cascade (30-50ms per item)

### Doc References Checked
- tokens.md (colors, typography, spacing, elevation)
- [relevant _foundations.md files]
- [relevant specific guides]
```

### 6. Iterate

If blockers found:
- Provide exact fix instructions (file, line, old value → new value)
- After implementer applies fixes, re-audit the changed files
- Repeat until no blockers remain

## Severity Levels

- **Blocker:** Token violation (Tailwind gray instead of plum-derived, wrong font, wrong shadow tier), structural mismatch with prototype, missing required states
- **Warning:** Spacing slightly off from doc spec, minor structural discrepancy, missing responsive behavior
- **Nit:** Animation timing, minor alignment, could be more polished

## Common Violations

These are the most frequently caught issues. Check for them first:

| Violation | Wrong | Right | Source |
|-----------|-------|-------|--------|
| Gray text | `text-gray-500` | `text-[#8A80A8]` | tokens.md § Text colors |
| Gray border | `border-gray-200` | `border-[#D4CFE2]` | tokens.md § Borders |
| Gray hover | `hover:bg-gray-100` | `hover:bg-[#EFEDF5]` | tokens.md § Surface colors |
| Wrong shadow | `shadow-md` or `shadow-2xl` | `shadow-sm`, `shadow-lg`, or `shadow-xl` | tokens.md § Elevation |
| Wrong radius | varies | `rounded-lg`, `rounded-xl`, `rounded-2xl`, or `rounded-full` | tokens.md § Border Radius |
| White background | `bg-white` (page) | `bg-[#FFFCFA]` | tokens.md § Surface colors |
| Non-Lucide icons | any other library | Lucide React only | iconography.md |
| Wrong font | system fonts | Plus Jakarta Sans (already configured) | tokens.md § Typography |
| Hand-built table | Custom `<table>` with manual thead/tbody/pagination | `DataGrid` with `ColumnDef[]` | Tables/_foundations.md § Standard Foundation |
| Hand-built filters | Custom filter chips, raw `<select>`/`<input>` for filtering | Composable filter builder (ExploreFilters pattern) | Toolbar pattern in ExploreOverlay |
| Hand-built pagination | Custom Previous/Next buttons with page state | `DataGrid` built-in pagination | `DataGrid.tsx` footer section |
