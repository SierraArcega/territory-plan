# New Feature Orchestration System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a multi-agent orchestration system (`/new-feature`) that replaces the old `/feature` skill, adding an iterative design exploration phase with Paper prototyping before execution.

**Architecture:** 4 standalone skills (`new-feature`, `design-explore`, `backend-discovery`, `design-review`) plus a craft enrichment to the existing `frontend-design` skill. The `new-feature` orchestrator owns the full pipeline and uses subagent prompt templates for execution stages. Three prompts are migrated from the old `/feature` skill with targeted updates.

**Tech Stack:** Claude Code skills (SKILL.md files with frontmatter), subagent prompt templates (markdown with `{{TEMPLATE_VARIABLES}}`), Paper MCP for design prototyping, Slack MCP for approval notifications.

**Spec:** `docs/superpowers/specs/2026-03-11-new-feature-orchestration-design.md`

---

## Chunk 1: Foundation Skills

### Task 1: Create `design-explore` skill

The creative exploration skill — takes requirements and builds Paper prototypes for comparison.

**Files:**
- Create: `.claude/skills/design-explore/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p .claude/skills/design-explore
```

- [ ] **Step 2: Write the SKILL.md**

Create `.claude/skills/design-explore/SKILL.md` with:

```markdown
---
name: design-explore
description: Use when exploring design approaches for a new feature. Creates 2-3 Paper prototypes with different architectural and visual directions, presents them for comparison, and iterates on user feedback until a direction is approved.
---

# Design Exploration

The creative heart of the feature pipeline. Takes requirements and component context, generates 2-3 meaningfully different approaches as Paper prototypes, presents them side-by-side, iterates on feedback.

## When to Use

- Invoked by `/new-feature` orchestrator during stages 2-3
- Standalone via `/design-explore` when exploring design directions for any UI work
- When you need to compare multiple architectural approaches visually

## Inputs

Before starting, you need:
- **Feature requirements** — what the feature does, who it's for, constraints
- **UI component candidates** — existing components found via `frontend-design` discovery
- **Backend context** (optional) — data shape and API patterns from `backend-discovery`

If invoked standalone, gather these by asking the user and running the `frontend-design` discovery workflow.

## Process

### 1. Analyze Requirements

Identify the key UX decisions:
- Layout type (panel, page, modal, inline)
- Information hierarchy (what's primary, secondary, tertiary)
- Interaction model (click-to-expand, side-by-side, overlay, tabs)
- Navigation pattern (back button, breadcrumbs, tabs, drill-down)

### 2. Generate 2-3 Approaches

Each approach must be **meaningfully different** — not variations on a theme:
- Different architectural choices (panel vs page, tabs vs scroll, modal vs inline)
- Different information hierarchy (what's prominent vs tucked away)
- Different interaction models (click-to-expand, side-by-side, overlay)

For each approach, write a 2-sentence description before prototyping.

### 3. Prototype in Paper

For each approach:

1. Read the relevant `Documentation/UI Framework/` docs via the `frontend-design` skill discovery workflow
2. Create a new artboard in the Mapomatic Design System file:
   ```
   mcp__paper__create_artboard(title: "[Feature] — Approach [A/B/C]", width: 1440, height: 900)
   ```
3. Build the prototype using `write_html` in small increments (one visual group per call — see Paper MCP instructions)
4. Use brand tokens from `tokens.md` — plum-derived colors, Plus Jakarta Sans, spacing scale
5. Apply craft principles (see Craft Guidance below)
6. Screenshot every 2-3 modifications using the Paper Review Checkpoints

### 4. Present for Comparison

Screenshot each prototype and present with:
- One-line description of the approach
- Key trade-offs (complexity, information density, interaction cost)
- Your recommendation with reasoning

Format:
```
--- Design Exploration Complete ---

Approach A: [description]
  Trade-offs: [pros/cons]

Approach B: [description]
  Trade-offs: [pros/cons]

Approach C: [description]
  Trade-offs: [pros/cons]

Recommended: [A/B/C] because [reasoning]

→ Pick a direction to refine, request changes, or ask me to explore more options.
```

### 5. Iterate

Based on user feedback:
- "I like A but with the sidebar from B" → refine in Paper
- "None of these — what about X?" → generate new approach
- "A is perfect" → proceed to refine

### 6. Refine

Once direction is chosen:
- Add detail: hover states, loading states, empty states, error states
- Check against component docs for each element used
- Screenshot and present for final approval
- Record the approved Paper artboard/node IDs for the spec

## Prototyping Fidelity

Paper prototypes are **layout and structure explorations**, not pixel-perfect mockups. Their purpose is to:
- Resolve architectural questions (panel vs page, tabs vs scroll)
- Establish information hierarchy (what's prominent, what's secondary)
- Validate component selection (which doc patterns to use)
- Explore interaction models (expand, navigate, overlay)

The prototype is a **contract for structure and hierarchy**, not for pixel measurements. Implementation may differ in spacing details — the prototype locks in the architecture.

## Craft Guidance

When prototyping in Paper, apply these principles within the Fullmind brand:

### Typography Rhythm
- Create clear hierarchy using the 5-tier scale: Display (hero) → Heading (sections) → Body (content) → Caption (metadata) → Micro (chrome)
- Vary weight within a tier for emphasis — `font-medium` vs `font-bold` at Body size creates subtle hierarchy without changing scale
- Use `tracking-wider` + `uppercase` on Caption tier for section labels — visual separation without borders

### Color Composition
- Lead with Plum (`#403770`) + Off-white (`#FFFCFA`) as the foundation
- One accent moment per view is stronger than five. A single Coral badge draws the eye; five compete
- Use plum-derived neutral tints (`#F7F5FA`, `#EFEDF5`) for depth layers instead of shadows
- Robin's Egg at low opacity (`bg-[#C4E7E6]/10`) creates warmth without demanding attention

### Spacing Composition
- Tighter within groups, generous between sections — creates "breathing room" for dense data
- Asymmetric padding (more top than bottom on headers, more left on content) creates visual flow
- Section gaps large enough that you'd never mistake two sections for one group

### Motion Design (noted for implementation, not prototyped)
- Entrance: stagger list items 30-50ms apart for cascade effect
- Hover: `transition-colors duration-100` — responsive without flashing
- Panel transitions: 200-250ms with `cubic-bezier(0.16, 1, 0.3, 1)` for natural deceleration
- Never animate layout shifts (width/height) — only opacity, transform, and color

### Composition Principles
- Hero element gets 40-60% of visual weight. Everything else supports it
- Create vertical rhythm by aligning elements across sections (labels at same x-offset, values at same x-offset)
- When balancing data density and visual appeal, solve for density first, then add warmth through color and spacing — not decoration
```

- [ ] **Step 3: Verify the skill is discoverable**

Run: `ls -la .claude/skills/design-explore/SKILL.md`
Expected: File exists with the content above.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/design-explore/SKILL.md
git commit -m "feat: add design-explore skill for Paper prototyping and design iteration"
```

---

### Task 2: Add craft section to `frontend-design` skill

Ships simultaneously with `design-explore` — the craft section cross-references it.

**Files:**
- Modify: `.claude/skills/frontend-design/SKILL.md` (insert before `## Tech Stack` section)

- [ ] **Step 1: Read the current frontend-design skill**

Read `.claude/skills/frontend-design/SKILL.md` to confirm the `## Tech Stack` section location.

- [ ] **Step 2: Insert the craft section before Tech Stack**

Replace the existing `---` separator (between `### Verification Checklist` and `## Tech Stack`) with this new section:

```markdown
---

## Craft — Design Quality Within Brand

When building or prototyping, apply these craft principles:

- **Typography rhythm**: hierarchy through the 5-tier scale + weight variation within tiers
- **Color composition**: Plum + Off-white foundation, one accent moment per view
- **Spacing composition**: tighter within groups, generous between sections
- **Motion**: staggered entrances (30-50ms), fast hovers (100ms), natural panel transitions (200-250ms)
- **Composition**: hero element gets 40-60% visual weight, vertical rhythm across sections

Full craft guidance with examples is in the `design-explore` skill (`.claude/skills/design-explore/SKILL.md` § Craft Guidance). Read it when prototyping or building new UI.
```

- [ ] **Step 3: Verify the edit**

Read `.claude/skills/frontend-design/SKILL.md` and confirm the craft section appears between Design Quality and Tech Stack.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/frontend-design/SKILL.md
git commit -m "feat: add craft section to frontend-design skill (cross-refs design-explore)"
```

---

### Task 3: Create `design-review` skill

Code-level design QA that audits `.tsx` files against `Documentation/UI Framework/` docs.

**Files:**
- Create: `.claude/skills/design-review/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p .claude/skills/design-review
```

- [ ] **Step 2: Write the SKILL.md**

Create `.claude/skills/design-review/SKILL.md` with:

```markdown
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
```

- [ ] **Step 3: Verify the skill is discoverable**

Run: `ls -la .claude/skills/design-review/SKILL.md`
Expected: File exists.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/design-review/SKILL.md
git commit -m "feat: add design-review skill for code-level design QA against UI Framework docs"
```

---

### Task 4: Create `backend-discovery` skill

Standalone skill that explores backend architecture and produces a context document.

**Files:**
- Create: `.claude/skills/backend-discovery/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p .claude/skills/backend-discovery
```

- [ ] **Step 2: Write the SKILL.md**

Create `.claude/skills/backend-discovery/SKILL.md` with:

```markdown
---
name: backend-discovery
description: Use before implementing backend features to explore the existing architecture. Discovers data models, API patterns, auth patterns, shared utilities, and testing conventions. Produces a structured context document that implementation agents use.
---

# Backend Discovery

Explores the backend architecture before implementation. Produces a structured context document that guides correct backend code.

## When to Use

- Invoked by `/new-feature` orchestrator during stage 1c
- Standalone via `/backend-discovery` before any backend work
- When an implementation agent needs to understand existing backend patterns

## Inputs

- **Feature description** — what the feature needs from the backend
- **Slug and date** (optional) — for naming the output file when invoked by the orchestrator

## Process

### 1. Explore Data Models

Read the database schema to find relevant models:

```bash
# Find schema files
find . -name "schema.prisma" -o -name "schema.ts" -o -name "*.schema.ts" | head -5
```

For each relevant model, document: name, key fields, relationships, and any custom types or enums.

### 2. Explore Existing APIs

Search for API routes, server actions, and tRPC routers related to the feature domain:

```
Grep for route handlers: "export async function (GET|POST|PUT|PATCH|DELETE)"
Grep for server actions: "use server"
Grep for tRPC routers: "router\(" or "publicProcedure" or "protectedProcedure"
```

Document: route pattern, request/response shapes, middleware applied.

### 3. Explore Database Patterns

How are queries structured in this codebase?

- ORM (Prisma, Drizzle, raw SQL?)
- Query patterns (findMany with includes, raw queries, query builders)
- Connection handling (pooling, transactions)
- Migration conventions

### 4. Explore Auth Patterns

How is authentication/authorization handled?

- Session management
- Role/permission checks
- Route-level vs function-level auth guards
- Middleware patterns

### 5. Explore Shared Utilities

Search these directories for relevant helpers:

- `src/lib/` — general utilities
- `src/server/` — server-side utilities
- `src/features/shared/` — shared feature code

Document: what exists, what it does, where it lives.

### 6. Explore Testing Patterns

How are backend tests structured?

- Test framework and conventions
- Fixtures, factories, seed data
- Database setup/teardown patterns
- Mocking conventions

## Output

Save the context document. When invoked by the orchestrator, save to:
`docs/superpowers/specs/[date]-[slug]-backend-context.md`

When invoked standalone, present the output to the user.

```markdown
## Backend Context: [Feature Name]

### Relevant Models
- Model A: [description, key fields, relationships]
- Model B: [description, key fields, relationships]

### Existing API Patterns
- Route pattern: [how routes are structured]
- Auth pattern: [how auth is applied]
- Error handling: [how errors are returned]

### Database Conventions
- ORM: [which one]
- Query patterns: [examples of how queries are written]
- Migration conventions: [how migrations are created]

### Shared Utilities
- [utility]: [purpose, where it lives]

### What Needs to Be Created
- New model/table: [if needed]
- New API route: [endpoint, method, purpose]
- New queries: [what data needs to be fetched/mutated]
```

This document is passed forward through the pipeline:
- Stage 4 (spec writing): referenced in the Backend Design section
- Stage 6 (implementation): passed to the implementer subagent via `{{IMPLEMENTATION_CONTEXT}}`
```

- [ ] **Step 3: Verify**

Run: `ls -la .claude/skills/backend-discovery/SKILL.md`
Expected: File exists.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/backend-discovery/SKILL.md
git commit -m "feat: add backend-discovery skill for pre-implementation backend context"
```

---

## Chunk 2: Orchestrator + Prompt Migration

### Task 5: Create `new-feature` orchestrator directory and config

Set up the directory structure and config file.

**Files:**
- Create: `.claude/skills/new-feature/config.json`
- Create: `.claude/skills/new-feature/prompts/` (directory)

- [ ] **Step 1: Create directories**

```bash
mkdir -p .claude/skills/new-feature/prompts
```

- [ ] **Step 2: Write config.json**

Create `.claude/skills/new-feature/config.json`:

```json
{
  "slack_channel": "C07AEK4HR7U",
  "max_test_fix_attempts": 3,
  "docs_path": "docs/superpowers"
}
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/new-feature/config.json
git commit -m "feat: add new-feature orchestrator config"
```

---

### Task 6: Migrate and update subagent prompts

Copy the three reusable prompts from `/feature` and update them for the new pipeline.

**Files:**
- Create: `.claude/skills/new-feature/prompts/implementer.md` (migrated + updated)
- Create: `.claude/skills/new-feature/prompts/test-writer.md` (migrated + updated)
- Create: `.claude/skills/new-feature/prompts/code-reviewer.md` (migrated + updated)

**Source:** `.claude/worktrees/cross-year-map-comparison/.claude/skills/feature/prompts/`

- [ ] **Step 1: Read the source prompts**

Read all three source files:
- `.claude/worktrees/cross-year-map-comparison/.claude/skills/feature/prompts/implementer.md`
- `.claude/worktrees/cross-year-map-comparison/.claude/skills/feature/prompts/test-writer.md`
- `.claude/worktrees/cross-year-map-comparison/.claude/skills/feature/prompts/code-reviewer.md`

- [ ] **Step 2: Write updated implementer.md**

Create `.claude/skills/new-feature/prompts/implementer.md`.

Changes from the original:
1. Replace `{{PRD_PATH}}` with `{{SPEC_PATH}}` (the spec is richer than a PRD — it includes visual design, component plan, and backend context)
2. Replace the inline brand color list with a reference to `Documentation/UI Framework/tokens.md` and the `frontend-design` skill
3. Add a note about checking the Paper prototype via `mcp__paper__get_tree_summary` for structural reference
4. Keep everything else (self-review, reporting, existing pattern exploration)

Full content:

```markdown
# Implementer Subagent

You are implementing a feature for the Fullmind Territory Planner — a Next.js 16 + React 19 + TypeScript + Tailwind 4 application with Zustand for UI state, TanStack Query for server state, Prisma ORM with PostgreSQL + PostGIS, and MapLibre GL JS for mapping.

## Approved Spec

Read the spec at: `{{SPEC_PATH}}`

## Context

{{IMPLEMENTATION_CONTEXT}}

## Before You Begin

Read the spec fully. Then explore the codebase files referenced in the spec to understand existing patterns:
- How are similar features structured? Check `src/features/` for the nearest equivalent
- How are API routes structured? Check `src/app/api/` for patterns
- How are stores structured? Check files importing from `zustand`
- How are queries structured? Check files using `@tanstack/react-query`

If you have questions about the requirements, approach, or anything unclear — **ask them now.** Do not guess or make assumptions.

## Your Job

1. **Implement exactly what the spec specifies** — nothing more, nothing less
2. **Follow existing patterns** — match the code style, file structure, and conventions already in the codebase
3. **Write clean, type-safe TypeScript** — no `any` types, no `@ts-ignore`
4. **For UI work:**
   - Read `Documentation/UI Framework/tokens.md` for all color, spacing, elevation, and typography values
   - Read the relevant `_foundations.md` for each component type you build (use the `frontend-design` skill's routing table)
   - If a Paper prototype was created, check its structure via `mcp__paper__get_tree_summary` for layout reference
   - No Tailwind grays (`gray-*`) — use plum-derived tokens from `tokens.md`
   - Check `src/components/` and `src/features/shared/` for existing components before creating new ones
5. **Commit your work** with clear, descriptive commit messages
6. **Self-review** before reporting back (see below)

## Self-Review Before Reporting

Review your work:

**Completeness:**
- Did I implement everything in the spec?
- Did I miss any requirements?
- Are there edge cases I didn't handle?

**Quality:**
- Is the code clean and maintainable?
- Are names clear and accurate?
- No `any` types, no `@ts-ignore`, no `eslint-disable`?

**Design compliance (for UI work):**
- Are all colors from `tokens.md`? No Tailwind grays?
- Does the structure match the Paper prototype (if one exists)?
- Did I follow the component docs for each component type?

**Discipline:**
- Did I avoid overbuilding (YAGNI)?
- Did I only build what was requested?
- Did I follow existing patterns?

If you find issues during self-review, fix them before reporting.

## Report

When done, report:
- What you implemented (file-by-file summary)
- Files created and modified (with paths)
- Any assumptions or decisions you made
- Self-review findings (if any)
- Any concerns or known limitations
```

- [ ] **Step 3: Write updated test-writer.md**

Create `.claude/skills/new-feature/prompts/test-writer.md`.

Changes from the original:
1. Replace `{{PRD_PATH}}` with `{{SPEC_PATH}}`
2. Keep everything else — the test conventions are solid

Full content:

```markdown
# Test Writer Subagent

You are writing and running tests for a feature in the Fullmind Territory Planner. The project uses Vitest with jsdom environment, globals enabled, and Testing Library for React components.

## Spec

Read the spec at: `{{SPEC_PATH}}`

## What Was Implemented

{{IMPLEMENTER_REPORT}}

## Your Job

Write comprehensive tests for all new code, then run the full test suite to verify nothing is broken.

### Before Writing Tests

1. Read the implemented code (all files listed in the implementer report)
2. Read 2-3 existing test files near the implemented code to match conventions:
   - Tests live in `__tests__/` directories alongside implementation
   - Use `describe` and `it` blocks (Vitest style)
   - Import from `vitest`: `{ describe, it, expect, vi, beforeEach }`
   - For React components: `import { render, screen } from '@testing-library/react'`
3. Read the spec's testing strategy section (if present)

### Test Conventions

```typescript
import { describe, it, expect } from "vitest";
// For React components:
// import { render, screen } from '@testing-library/react';

describe("FunctionOrComponent", () => {
  it("does specific thing when given specific input", () => {
    // Arrange
    const input = ...;

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

**Rules:**
- Test behavior, not implementation details
- Each `it` block tests one thing
- Descriptive test names that read as sentences
- No mocking unless absolutely necessary (prefer real implementations)
- Cover: happy path, edge cases, error cases
- For API routes: test request/response shapes
- For UI: test user interactions, not internal state

### What to Test

- **Unit tests**: Pure functions, data transformations, utility functions
- **Integration tests**: API routes (request -> response), store actions
- **Component tests**: User interactions, conditional rendering, error states

### Running Tests

After writing tests:

```bash
npx vitest run
```

Verify:
1. All new tests pass
2. All existing tests still pass
3. No test is skipped or marked `.todo`

### Output Format

```
## Test Results

**New tests written:** N tests across M files
**Test files:**
- `path/to/__tests__/file.test.ts` (N tests)
- ...

**Full suite results:**
- Total: N tests
- Passed: N
- Failed: N (if any — list them with error messages)

**Coverage notes:**
- [What's well covered]
- [What's not covered and why]
```

## Report

Report:
- Test files created (with paths)
- Number of tests written
- Full test suite pass/fail result
- If failures: exact error messages and which tests failed
- Any areas that couldn't be easily tested and why
```

- [ ] **Step 4: Write updated code-reviewer.md**

Create `.claude/skills/new-feature/prompts/code-reviewer.md`.

Changes from the original:
1. Replace `{{PRD_PATH}}` with `{{SPEC_PATH}}`
2. Replace `{{DESIGN_QA_REPORT}}` with `{{DESIGN_REVIEW_REPORT}}` (new skill name)
3. Keep the review checklist and report format — they're solid

Full content:

```markdown
# Code Reviewer Subagent

You are performing a final code review of a completed feature for the Fullmind Territory Planner before it goes to the human reviewer.

## Spec

Read the spec at: `{{SPEC_PATH}}`

## Implementation Summary

{{IMPLEMENTER_REPORT}}

## Design Review Result

{{DESIGN_REVIEW_REPORT}}

## Test Results

{{TEST_REPORT}}

## Your Job

Perform a thorough code review of ALL changes. Run `git diff {{BASE_BRANCH}}` to see every change made.

### Review Checklist

**Spec Compliance:**
- [ ] Every requirement in the spec is implemented
- [ ] Nothing extra was built that wasn't requested (YAGNI)
- [ ] Edge cases from the spec are handled

**Code Quality:**
- [ ] TypeScript types are correct (no `any`, no `@ts-ignore`)
- [ ] Error handling is present where needed
- [ ] No hardcoded values that should be constants or config
- [ ] No dead code or commented-out code
- [ ] Naming is clear and consistent with codebase conventions
- [ ] No overly complex logic (could it be simpler?)

**Security (OWASP Top 10):**
- [ ] No SQL injection risk (Prisma parameterized queries used)
- [ ] No XSS risk (React escaping, no `dangerouslySetInnerHTML`)
- [ ] No command injection (no unsanitized user input in shell commands)
- [ ] API routes validate input
- [ ] No sensitive data exposed in responses

**Performance:**
- [ ] No N+1 query patterns (check Prisma includes/joins)
- [ ] Large lists use pagination or virtualization
- [ ] No unnecessary re-renders (check React component structure)
- [ ] Database queries have appropriate indexes (check schema)

**Consistency:**
- [ ] Code follows existing patterns in the codebase
- [ ] File structure matches the project conventions
- [ ] Import paths are consistent
- [ ] Commit messages are clear and descriptive

### Output: Final Report

Write the final report to `{{DOCS_PATH}}/{{DATE}}-{{SLUG}}-final-report.md`:

```markdown
# Feature Report: [Feature Name]

**Date:** YYYY-MM-DD
**Status:** Ready for Review | Needs Attention

## Summary
[2-3 sentences describing what was built]

## Changes
| File | Action | Lines |
|------|--------|-------|
| path/to/file.ts | Created | +N |
| path/to/other.ts | Modified | +N/-M |

## Test Results
- New tests: N
- Total suite: N passed, N failed
- Coverage: [summary]

## Design Review
[Passed/Issues found — summary]

## Code Review Findings

### Strengths
- [What was done well]

### Issues
| Severity | Description | File | Recommendation |
|----------|-------------|------|----------------|
| Critical | ... | path:line | ... |
| Important | ... | path:line | ... |
| Minor | ... | path:line | ... |

(If no issues: "No issues found.")

## Recommendation
**READY FOR REVIEW** — All tests pass, design review passed, no critical issues.
or
**NEEDS ATTENTION** — [specific concerns that the human reviewer should focus on]
```

## Report

Report:
- Final report file path
- Recommendation: READY FOR REVIEW or NEEDS ATTENTION
- Count of issues by severity
- One-line summary of the feature
```

- [ ] **Step 5: Verify all three prompts exist**

Run: `ls -la .claude/skills/new-feature/prompts/`
Expected: `implementer.md`, `test-writer.md`, `code-reviewer.md` all present.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/new-feature/prompts/
git commit -m "feat: migrate and update subagent prompts from /feature to /new-feature"
```

---

### Task 7: Write the `new-feature` orchestrator SKILL.md

The main orchestrator that sequences the entire pipeline.

**Files:**
- Create: `.claude/skills/new-feature/SKILL.md`

- [ ] **Step 1: Write the SKILL.md**

This is the largest file. Create `.claude/skills/new-feature/SKILL.md` with the full orchestrator logic.

The SKILL.md must cover:
1. Frontmatter (name, description)
2. When to Use
3. Setup (parse input, slug, config, worktree)
4. Pipeline stages 1-8 with exact instructions at each stage
5. Gate behavior
6. Error handling
7. Spec template
8. Slack integration pattern (from `/feature`)

```markdown
---
name: new-feature
description: Use when building a new feature end-to-end. Orchestrates discovery, design exploration with Paper prototyping, spec writing, implementation, design review, code review, testing, and shipping. Replaces the old /feature skill.
---

# New Feature Pipeline

Build features end-to-end through an 8-stage pipeline. Two phases: **design exploration** (stages 1-4, iterative with human gates) and **execution** (stages 5-8, automated with checkpoints).

## When to Use

- User says `/new-feature "description"` or asks to build a new feature
- User wants the full pipeline: discovery → design → spec → plan → implement → review → ship
- NOT for: quick bug fixes, single-file changes, or exploration tasks

## Configuration

Read `.claude/skills/new-feature/config.json`:

| Field | Purpose |
|-------|---------|
| `slack_channel` | Slack channel ID for notifications (empty = skip Slack) |
| `max_test_fix_attempts` | Max test fix loop iterations |
| `docs_path` | Base path for specs, plans, and reports |

**Slack MCP server** (if configured) provides:
- `slack_send_approval` — post approval request with Approve/Reject buttons
- `slack_check_approval` — poll for button click result
- `slack_wait_for_approval` — block until resolved (up to 5 min)
- `slack_send_message` — send a plain message

## Setup

1. Parse the feature description from user input
2. Generate a slug: strip filler words, lowercase, hyphenate (e.g., "add district comparison view" → `district-comparison-view`)
3. Set `DATE` to today (`YYYY-MM-DD`)
4. Read config from `.claude/skills/new-feature/config.json`
5. Create a git worktree: use `EnterWorktree` with name set to the slug
6. All subsequent work happens in this worktree

## Pipeline

Follow these stages in order. Do not skip or reorder.

---

### Stage 1: Discovery

**Goal:** Understand what we're building, what exists, and what we need.

**1a. Requirements gathering:**

Ask the user 3-6 clarifying questions, one at a time via `AskUserQuestion`:
- What problem does this solve?
- Who uses it and how?
- What are the constraints? (performance, data volume, existing UI patterns)
- What does success look like?
- Are there related features to reference?

Compile answers into a `requirements_summary` (keep in conversation context).

**1b. Frontend discovery:**

Invoke the `frontend-design` skill's discovery workflow:
- Read relevant `Documentation/UI Framework/` docs
- Screenshot relevant Paper design system artboards
- Search `src/components/` and `src/features/` for existing components

Output: `ui_component_candidates` — list of existing components + doc references.

**1c. Backend discovery:**

Dispatch a subagent using the `backend-discovery` skill's process:
- Explore data models, APIs, auth patterns, shared utilities, testing patterns
- Save output to `[docs_path]/specs/[DATE]-[SLUG]-backend-context.md`

Output: `backend_context_path` — path to the saved context document.

---

### Stage 2: Design Exploration

**Goal:** Explore 2-3 meaningfully different approaches, prototype in Paper, let the user choose.

Invoke the `design-explore` skill with:
- `requirements_summary` from stage 1a
- `ui_component_candidates` from stage 1b
- `backend_context_path` from stage 1c

The skill will:
1. Create 2-3 Paper prototypes
2. Screenshot and present with trade-offs
3. Wait for user feedback

**🔄 GATE:** Present status and wait for user decision:
```
--- Stage 2 Complete: Design Exploration ---

Explored N approaches:
  A. [description] (recommended)
  B. [description]
  C. [description]

Screenshots presented above.

→ Pick a direction to refine, request changes, or ask me to explore more options.
```

If user requests iteration → loop back to design-explore with feedback.
If user picks a direction → proceed to Stage 3.

---

### Stage 3: Refine Chosen Direction

**Goal:** Detail the chosen approach, iterate on visual details, get final approval.

Continue with `design-explore` in refinement mode:
- Add detail: hover states, loading states, empty states, error states
- Check component docs for each element used
- Screenshot and present

**🔄 GATE:** User approves final design.

Output: `approved_prototype_node_ids` — Paper artboard/node IDs for the approved design.

---

### Stage 4: Lock Spec

**Goal:** Write a structured spec document combining all artifacts.

Write the spec to `[docs_path]/specs/[DATE]-[SLUG]-spec.md`:

```markdown
# Feature Spec: [Feature Name]

**Date:** [DATE]
**Slug:** [SLUG]
**Branch:** [worktree branch]

## Requirements
[From stage 1 discovery]

## Visual Design
- Approved approach: [description]
- Paper prototype: Mapomatic Design System → [artboard name] (node IDs: [list])
- Key architectural decisions: [panel vs page, etc.]

## Component Plan
- Existing components to reuse: [list with doc references]
- New components needed: [list with category + doc spec to follow]
- Components to extend: [list with what changes]

## Backend Design
- See: [backend_context_path]
- New models/tables: [summary]
- New API routes: [summary]
- New queries: [summary]

## States
- Loading: [approach]
- Empty: [approach]
- Error: [approach]

## Out of Scope
[What this feature explicitly does NOT include]
```

Commit the spec.

**🔄 GATE:** User approves spec before execution begins.

---

### Stage 5: Plan

**Goal:** Write a detailed implementation plan with frontend and backend tasks.

Write the plan to `[docs_path]/plans/[DATE]-[SLUG]-plan.md`:
- Frontend tasks (referencing Paper node IDs + component docs)
- Backend tasks (referencing backend context doc)
- Task dependencies and ordering
- Test strategy for each task

**🔄 GATE:** User approves plan.

---

### Stage 6: Implement

**Goal:** Build the feature per the approved plan.

Read the implementer prompt from `.claude/skills/new-feature/prompts/implementer.md`.

Dispatch implementer subagent (`subagent_type: "general-purpose"`) with:
- `{{SPEC_PATH}}` = spec path from stage 4
- `{{IMPLEMENTATION_CONTEXT}}` = plan path + backend context path + Paper node references

If the plan has independent frontend and backend tasks, dispatch parallel agents.

Save the implementer's report for stages 7-8.

---

### Stage 7: Review

**Goal:** Verify the implementation against the design and code standards.

**7a. Design Review:**

Invoke the `design-review` skill:
- Pass the list of `.tsx` files from the implementer report
- Pass the Paper prototype node IDs from stage 3
- Pass the spec path

If blockers found → re-dispatch implementer with fix instructions → re-run design review.

**7b. Code Review:**

Read the code-reviewer prompt from `.claude/skills/new-feature/prompts/code-reviewer.md`.

Dispatch code reviewer subagent with:
- `{{SPEC_PATH}}` = spec path
- `{{IMPLEMENTER_REPORT}}` = implementer's report
- `{{DESIGN_REVIEW_REPORT}}` = design review output
- `{{TEST_REPORT}}` = "pending" (tests run in stage 8)
- `{{DOCS_PATH}}` = config.docs_path
- `{{DATE}}` = today
- `{{SLUG}}` = feature slug
- `{{BASE_BRANCH}}` = `main`

**🔄 GATE:** User reviews results. If issues → re-dispatch implementer, re-review.

---

### Stage 8: Ship

**Goal:** Tests pass, builds clean, ship it.

**8a. Tests:**

Read the test-writer prompt from `.claude/skills/new-feature/prompts/test-writer.md`.

Set `fix_attempt = 0`. Loop:
1. Dispatch test writer subagent with `{{SPEC_PATH}}` and `{{IMPLEMENTER_REPORT}}`
2. If all tests pass → proceed
3. If tests fail and `fix_attempt < max_test_fix_attempts`:
   - Increment fix_attempt
   - Re-dispatch implementer with failing test details
   - Go back to (1)
4. If tests fail and `fix_attempt >= max_test_fix_attempts`:
   - Proceed but flag failures

**8b. Verification:**

```bash
npx vitest run
npm run build
```

Both must succeed.

**8c. Slack notification (if configured):**

If `slack_channel` is not empty, call `slack_send_approval` with:
- `channel`: config.slack_channel
- `title`: "Feature Ready for Review: [Feature Name]"
- `summary`: "[Feature name] implementation complete. [N] tests passing. Code review: [READY/NEEDS ATTENTION]."
- `sections`:
  - "What Was Built" (`text`): 2-3 sentence summary from the spec
  - "Implementation Summary" (`text`): New files + modified files with brief purposes
  - "Quality" (`fields`): Tests [pass/fail], Design review [PASSED/ISSUES/SKIPPED], Code review [READY/NEEDS ATTENTION], Fix attempts [N of max]
  - "Code Review Notes" (`text`): Key findings from code reviewer (3-5 bullets)
  - "Outstanding Issues" (`text`): Flagged issues or "No outstanding issues"
  - "Review Details" (`fields`): Report path, Branch name, Dev server URL, Spec path

Save the returned `approvalId`.

**8d. Dev server:**

```bash
ln -sf /Users/sierrastorm/thespot/territory-plan/.env <worktree-path>/.env
lsof -ti :3005 | xargs kill -9 2>/dev/null
npx next dev -p 3005
```

**🔄 GATE:** Present final report summary. **Dual-channel approval:** if Slack is configured, check `slack_check_approval` before presenting the terminal prompt — the user may have already approved from Slack. Ask user:
- "Merge to main"
- "Create a PR"
- "I'll review the worktree manually"
- "Discard"

Based on choice:
- **Merge**: merge worktree branch into main
- **PR**: `gh pr create` with final report as PR body
- **Manual**: print worktree path and branch
- **Discard**: clean up worktree

## Error Handling

- **Subagent failure** → pause, present to user via AskUserQuestion (retry / skip / abort)
- **Slack MCP unavailable** → skip Slack, terminal-only approval
- **Worktree creation failure** → fall back to new branch on current repo
- **Paper MCP unavailable** → fall back to text descriptions of approaches (no prototypes)
```

- [ ] **Step 2: Verify the skill is discoverable**

Run: `ls -la .claude/skills/new-feature/SKILL.md`
Expected: File exists.

- [ ] **Step 3: Verify the full directory structure**

Run: `find .claude/skills/new-feature -type f | sort`
Expected:
```
.claude/skills/new-feature/SKILL.md
.claude/skills/new-feature/config.json
.claude/skills/new-feature/prompts/code-reviewer.md
.claude/skills/new-feature/prompts/implementer.md
.claude/skills/new-feature/prompts/test-writer.md
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/new-feature/SKILL.md
git commit -m "feat: add new-feature orchestrator skill — replaces /feature with design exploration pipeline"
```

---

## Chunk 3: Cleanup

### Task 8: Remove old `/feature` skill

The old skill lives in a worktree, not the main repo. Check if there's a copy in the main `.claude/skills/` first.

**Files:**
- Delete: `.claude/skills/feature/` (if it exists in the main repo)

- [ ] **Step 1: Check if the old skill exists in main repo**

Run: `ls -la .claude/skills/feature/ 2>/dev/null || echo "Does not exist in main repo"`

If it exists → delete it.
If it doesn't exist → this step is a no-op. The worktree copy at `.claude/worktrees/cross-year-map-comparison/.claude/skills/feature/` will be cleaned up when that worktree is removed.

- [ ] **Step 2: Commit (if deletion happened)**

```bash
git add -A .claude/skills/feature/
git commit -m "chore: remove old /feature skill (replaced by /new-feature)"
```

---

### Task 9: Final verification

- [ ] **Step 1: Verify all new skills are in place**

Run: `find .claude/skills -name "SKILL.md" | sort`

Expected (includes existing + new):
```
.claude/skills/accessibility-testing/SKILL.md
.claude/skills/apply-template/SKILL.md
.claude/skills/backend-discovery/SKILL.md
.claude/skills/create-ticket/SKILL.md
.claude/skills/design-explore/SKILL.md
.claude/skills/design-review/SKILL.md
.claude/skills/fix-bug/SKILL.md
.claude/skills/frontend-design/SKILL.md
.claude/skills/new-feature/SKILL.md
.claude/skills/work-on-ticket/SKILL.md
```

- [ ] **Step 2: Verify frontend-design has the craft section**

Run: `grep -c "Craft — Design Quality Within Brand" .claude/skills/frontend-design/SKILL.md`
Expected: `1`

- [ ] **Step 3: Verify new-feature has all prompts**

Run: `ls .claude/skills/new-feature/prompts/`
Expected: `code-reviewer.md  implementer.md  test-writer.md`

- [ ] **Step 4: Verify config**

Run: `cat .claude/skills/new-feature/config.json`
Expected: JSON with `slack_channel`, `max_test_fix_attempts`, `docs_path`.

- [ ] **Step 5: Verify migrated prompt content correctness**

Run these checks to confirm PRD_PATH→SPEC_PATH and DESIGN_QA→DESIGN_REVIEW migrations:

```bash
# Should find SPEC_PATH in all three prompts
grep -c "SPEC_PATH" .claude/skills/new-feature/prompts/implementer.md    # expect >= 1
grep -c "SPEC_PATH" .claude/skills/new-feature/prompts/test-writer.md    # expect >= 1
grep -c "SPEC_PATH" .claude/skills/new-feature/prompts/code-reviewer.md  # expect >= 1

# Should find zero old PRD_PATH references
grep -c "PRD_PATH" .claude/skills/new-feature/prompts/implementer.md     # expect 0
grep -c "PRD_PATH" .claude/skills/new-feature/prompts/test-writer.md     # expect 0
grep -c "PRD_PATH" .claude/skills/new-feature/prompts/code-reviewer.md   # expect 0

# Should find DESIGN_REVIEW_REPORT, not DESIGN_QA_REPORT
grep -c "DESIGN_REVIEW_REPORT" .claude/skills/new-feature/prompts/code-reviewer.md  # expect 1
grep -c "DESIGN_QA_REPORT" .claude/skills/new-feature/prompts/code-reviewer.md      # expect 0

# Implementer should reference Documentation/UI Framework/
grep -c "Documentation/UI Framework" .claude/skills/new-feature/prompts/implementer.md  # expect >= 1
```

- [ ] **Step 6: Final commit (if any verification fixes were needed)**

If any fixes were made during verification, commit them.
