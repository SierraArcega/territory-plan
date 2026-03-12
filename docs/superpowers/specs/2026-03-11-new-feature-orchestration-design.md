# New Feature Orchestration System

**Date:** 2026-03-11
**Status:** Approved (Rev 2 — addresses code review feedback)

---

## Overview

A multi-agent orchestration system for building new features end-to-end. Two phases: an iterative **design exploration** phase (stages 1-4, human-gated) and an **execution** phase (stages 5-8, automated with checkpoints). The pipeline is the single path for building features — replacing the previous `/feature` skill.

### Replaces: `/feature` Skill

The existing `/feature` skill (`.claude/worktrees/cross-year-map-comparison/.claude/skills/feature/`) was the previous feature pipeline: PRD writing → agent review → implementation → design QA → tests → code review → ship. `/new-feature` absorbs everything useful from it and adds the design exploration phase that was missing.

**What carries forward from `/feature`:**
- Subagent prompt templates (`implementer.md`, `test-writer.md`, `code-reviewer.md`) — migrated to `.claude/skills/new-feature/prompts/`
- Slack integration pattern (approval requests, dual-channel approval)
- Worktree isolation via `EnterWorktree`
- Config structure (`config.json` for Slack channel, max retries, docs path)

**What gets replaced:**
- `prd-writer.md` / `prd-reviewer.md` → replaced by interactive discovery + Paper prototyping + spec writing (stages 1-4)
- `design-qa.md` → replaced by new `design-review` skill (code-level audit against `Documentation/UI Framework/` docs)
- The `/feature` SKILL.md itself → replaced by `/new-feature` SKILL.md

**Migration:** During implementation, copy the three reusable prompts into `.claude/skills/new-feature/prompts/`, create the new skill, then remove the old `/feature` skill directory.

---

## Pipeline

```
/new-feature "Add district comparison view"

  ┌─── DESIGN EXPLORATION (iterative, human-gated) ───┐
  │                                                     │
  │  1. Discovery                                       │
  │     ├─ Requirements gathering (interactive Q&A)    │
  │     ├─ Frontend discovery → docs + Paper + comps   │
  │     └─ Backend discovery → data models + APIs      │
  │                                                     │
  │  2. Explore Approaches (2-3 directions)             │
  │     ├─ Architectural options (panel vs page, etc.)  │
  │     ├─ Prototype each in Paper (layout fidelity)   │
  │     ├─ Screenshot + present side by side            │
  │     └─ 🔄 GATE: User picks / gives feedback        │
  │                                                     │
  │  3. Refine Chosen Direction                         │
  │     ├─ Detail the selected approach in Paper        │
  │     ├─ Iterate on visual details                    │
  │     └─ 🔄 GATE: User approves final design         │
  │                                                     │
  │  4. Lock Spec                                       │
  │     ├─ Write spec doc (requirements + architecture  │
  │     │   + visual design + backend context)          │
  │     └─ 🔄 GATE: User approves spec                 │
  │                                                     │
  └─────────────────────────────────────────────────────┘

  ┌─── EXECUTION (automated, gated at checkpoints) ────┐
  │                                                     │
  │  5. Plan                                            │
  │     ├─ Write implementation plan (frontend + backend)│
  │     └─ 🔄 GATE: User approves plan                 │
  │                                                     │
  │  6. Implement                                       │
  │     ├─ Implementer subagent + backend context       │
  │     └─ Implementer subagent + Paper refs            │
  │                                                     │
  │  7. Review                                          │
  │     ├─ Design Review → code audit vs docs + Paper   │
  │     ├─ Code Review → code-reviewer subagent         │
  │     └─ 🔄 GATE: User reviews results               │
  │                                                     │
  │  8. Ship                                            │
  │     ├─ Tests → test-writer subagent                 │
  │     ├─ Verification → tests pass, builds clean      │
  │     └─ Branch Completion → PR or merge              │
  │                                                     │
  └─────────────────────────────────────────────────────┘
```

---

## Skill Map

| Pipeline Stage | Skill / Prompt | Status |
|----------------|---------------|--------|
| 1a. Requirements | `new-feature` orchestrator (interactive Q&A) | **NEW** |
| 1b. UI context | `frontend-design` skill (discovery workflow) | Exists (add craft section) |
| 1c. Backend context | `backend-discovery` prompt | **NEW** |
| 2-3. Design exploration | **`design-explore`** skill | **NEW** |
| 4. Spec writing | `new-feature` orchestrator (compiles artifacts) | **NEW** |
| 5. Planning | `new-feature` orchestrator (writes plan doc) | **NEW** |
| 6. Implementation | `implementer.md` prompt (migrated from `/feature`) | Migrated |
| 7a. Design QA | **`design-review`** skill | **NEW** (replaces old `design-qa.md`) |
| 7b. Code review | `code-reviewer.md` prompt (migrated from `/feature`) | Migrated |
| 8a. Tests | `test-writer.md` prompt (migrated from `/feature`) | Migrated |
| 8b. Ship | Slack + worktree completion (pattern from `/feature`) | Migrated |
| **Conductor** | **`new-feature`** skill | **NEW** |

---

## New Skills

### 1. `new-feature` (Orchestrator)

**Purpose:** Sequences the entire pipeline. Manages gates, tracks state, dispatches subagents using prompt templates.

**Trigger:** User says `/new-feature` or "let's build a new feature" or similar.

**Setup:**

1. Parse feature description from user input
2. Generate slug (strip filler words, lowercase, hyphenate)
3. Read config from `.claude/skills/new-feature/config.json`
4. Create worktree via `EnterWorktree` with name set to slug
5. Set `DATE` to today

**Subagent dispatch model:**

All subagents are dispatched as Task subagents (`subagent_type: "general-purpose"`). The orchestrator:
- Reads prompt templates from `.claude/skills/new-feature/prompts/`
- Replaces `{{TEMPLATE_VARIABLES}}` with context
- Dispatches and collects results
- Manages iteration loops and gates

**Stage transitions:**

```
Stage 1 (Discovery):
  → Orchestrator asks user 3-6 clarifying questions (one at a time via
    AskUserQuestion) to establish requirements, constraints, and success criteria
  → Invoke frontend-design skill: read Documentation/UI Framework/ docs,
    check Paper design system, find existing components
  → Dispatch backend-discovery subagent: explore models, APIs, patterns
  → Output artifacts:
    - requirements_summary (in conversation context)
    - ui_component_candidates (list of existing components + doc references)
    - backend_context saved to docs/superpowers/specs/[date]-[slug]-backend-context.md

Stage 2-3 (Design Exploration):
  → Invoke design-explore skill with:
    - requirements_summary
    - ui_component_candidates
    - backend_context path
  → design-explore creates 2-3 Paper prototypes (layout fidelity — see
    Prototyping Fidelity section below)
  → Screenshot each, present with trade-offs and recommendation
  → GATE: User picks direction or requests iteration
  → If iteration: loop back with user feedback
  → If converged: refine chosen direction in Paper
  → GATE: User approves final design
  → Output: approved Paper prototype node IDs, architectural decisions

Stage 4 (Lock Spec):
  → Orchestrator writes spec document combining:
    - Requirements from stage 1
    - Approved visual design (Paper artboard/node IDs)
    - Architectural decisions from stage 2-3
    - Backend context from stage 1
  → Format: structured markdown (see Spec Template below)
  → Save to docs/superpowers/specs/[date]-[slug]-spec.md
  → Commit spec
  → GATE: User approves spec before execution begins

Stage 5 (Plan):
  → Orchestrator writes implementation plan:
    - Frontend tasks (referencing Paper nodes + component docs)
    - Backend tasks (referencing backend context doc)
    - Task dependencies and ordering
  → Save to docs/superpowers/plans/[date]-[slug]-plan.md
  → GATE: User approves plan

Stage 6 (Implement):
  → Read implementer.md prompt template
  → Dispatch implementer subagent with:
    - {{PRD_PATH}} = spec path from stage 4
    - {{IMPLEMENTATION_CONTEXT}} = plan path + backend context path +
      Paper node references for frontend work
  → If plan has independent frontend/backend tasks, dispatch parallel agents

Stage 7 (Review):
  → Invoke design-review skill: code-level audit of .tsx files against
    Documentation/UI Framework/ docs + Paper prototype structure
  → Read code-reviewer.md prompt template
  → Dispatch code reviewer subagent with standard template variables
  → GATE: User reviews results
  → If issues: re-dispatch implementer with fix instructions, re-review

Stage 8 (Ship):
  → Read test-writer.md prompt template
  → Dispatch test writer subagent (fix loop up to config.max_test_fix_attempts)
  → Verify: tests pass, build clean
  → Slack notification (if configured)
  → GATE: User chooses merge / PR / manual review / discard
```

**Gate behavior:**

At each gate, present a concise status:
```
--- Stage 2 Complete: Design Exploration ---

Explored 3 approaches:
  A. Side-by-side panel layout (recommended)
  B. Tabbed comparison view
  C. Overlay diff mode

Screenshots presented above.

→ Pick a direction to refine, request changes, or ask me to explore more options.
```

**Error handling:**

- Subagent failure → pause, present issue to user via AskUserQuestion (retry / skip / abort)
- Slack MCP unavailable → skip Slack, use terminal-only approval
- Worktree creation failure → fall back to new branch on current repo
- Paper MCP unavailable → fall back to text descriptions of approaches (no prototypes)

**Spec Template** (Stage 4 output):

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
- See: docs/superpowers/specs/[date]-[slug]-backend-context.md
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

---

### 2. `design-explore` (Creative Exploration)

**Purpose:** The creative heart of the system. Takes requirements and component context, generates 2-3 architectural and visual approaches as Paper prototypes, presents them for comparison, iterates on user feedback.

**Trigger:** Invoked by `new-feature` orchestrator during stages 2-3. Can also be invoked standalone via `/design-explore`.

**Inputs:**
- Feature requirements (from discovery)
- UI component candidates (from frontend-design discovery)
- Backend context path (for understanding data shape)

**Process:**

1. **Analyze requirements** — what are the key UX decisions? (layout type, information hierarchy, interaction model, navigation pattern)

2. **Generate 2-3 approaches** — each should be meaningfully different:
   - Different architectural choices (panel vs page, tabs vs scroll, modal vs inline)
   - Different information hierarchy (what's primary, secondary, tertiary)
   - Different interaction models (click-to-expand, side-by-side, overlay)

3. **Prototype in Paper** — for each approach:
   - Create a new artboard in the Mapomatic Design System file
   - Build the prototype using Paper MCP (`write_html` in small increments)
   - Follow the Fullmind design system (read docs via `frontend-design` skill, use brand tokens)
   - Apply craft principles (see Craft Guidance below)

4. **Present for comparison** — screenshot each prototype, present with:
   - One-line description of the approach
   - Key trade-offs (complexity, information density, interaction cost)
   - Your recommendation with reasoning

5. **Iterate** — based on user feedback:
   - "I like A but with the sidebar from B" → refine in Paper
   - "None of these — what about X?" → generate new approach
   - "A is perfect" → proceed to refine details

6. **Refine** — once direction is chosen:
   - Add detail: hover states, loading states, empty states, error states
   - Check against component docs for each element used
   - Screenshot and present for final approval

### Prototyping Fidelity

Paper prototypes are **layout and structure explorations**, not pixel-perfect mockups. Their purpose is to:
- Resolve architectural questions (panel vs page, tabs vs scroll, etc.)
- Establish information hierarchy (what's prominent, what's secondary)
- Validate component selection (which doc patterns to use)
- Explore interaction models (expand, navigate, overlay)

The prototypes use brand tokens (colors, typography, spacing from `tokens.md`) to feel right, but implementation may differ in details. The prototype is a **contract for structure and hierarchy**, not for pixel measurements.

### Craft Guidance

When prototyping in Paper, apply these principles within the Fullmind brand:

*Typography rhythm:*
- Create clear hierarchy using the 5-tier scale. Display for the hero element, Heading for sections, Body for content, Caption for metadata, Micro for chrome.
- Vary weight within a tier for emphasis — `font-medium` vs `font-bold` at Body size creates subtle hierarchy without changing scale.
- Use `tracking-wider` + `uppercase` on Caption tier for section labels — it creates visual separation without needing a border.

*Color composition:*
- Lead with Plum + Off-white as the foundation. Introduce brand colors sparingly and purposefully.
- One accent moment per view is stronger than five. A single Coral badge draws the eye; five compete.
- Use plum-derived neutral tints (`#F7F5FA`, `#EFEDF5`) to create depth layers rather than relying on shadows alone.
- Robin's Egg at low opacity (`bg-[#C4E7E6]/10`) creates warmth without demanding attention.

*Spacing composition:*
- Vary spacing deliberately — tighter within groups, generous between sections. This creates visual "breathing room" that makes dense data feel manageable.
- Asymmetric padding (more top than bottom on headers, more left on content areas) creates subtle visual flow.
- The gap between sections should be large enough that you'd never mistake two sections for one group.

*Motion design (noted for implementation, not prototyped):*
- Entrance: stagger list items 30-50ms apart for a cascade effect.
- Hover: `transition-colors duration-100` is fast enough to feel responsive without flashing.
- Panel transitions: 200-250ms with `cubic-bezier(0.16, 1, 0.3, 1)` for natural deceleration.
- Never animate layout shifts (width/height changes) — only opacity, transform, and color.

*Composition principles:*
- Hero element gets 40-60% of visual weight. Everything else supports it.
- Create vertical rhythm by aligning elements across sections (labels at the same x-offset, values at the same x-offset).
- When a view has both data density and visual appeal as goals, solve for density first, then add warmth through color and spacing — not decoration.

---

### 3. `backend-discovery` (Backend Context)

**Purpose:** Explores the backend architecture before implementation. Produces a context document that implementation agents use to write correct backend code.

**Trigger:** Invoked by `new-feature` orchestrator during stage 1c. Can also be invoked standalone via `/backend-discovery`.

**Process:**

1. **Explore data models** — read Prisma/Drizzle schema, find relevant models for the feature
2. **Explore existing APIs** — find API routes, server actions, tRPC routers related to the feature domain
3. **Explore database patterns** — how are queries structured? What ORM patterns are used? Connection pooling? Transactions?
4. **Explore auth patterns** — how is authentication/authorization handled? Role checks? Permission guards?
5. **Explore shared utilities** — what helpers exist in `src/lib/`, `src/server/`, `src/features/shared/`?
6. **Explore testing patterns** — how are backend tests structured? What fixtures/factories exist?

**Output and handoff:**

The context document is saved to `docs/superpowers/specs/[date]-[slug]-backend-context.md` and its path is passed forward through the pipeline:
- Stage 4 (spec writing): referenced in the Backend Design section
- Stage 6 (implementation): passed to the implementer subagent via `{{IMPLEMENTATION_CONTEXT}}`

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
- ORM: [Prisma/Drizzle/etc]
- Query patterns: [examples of how queries are written]
- Migration conventions: [how migrations are created]

### Shared Utilities
- [utility]: [purpose, where it lives]

### What Needs to Be Created
- New model/table: [if needed]
- New API route: [endpoint, method, purpose]
- New queries: [what data needs to be fetched/mutated]
```

---

### 4. `design-review` (Post-Implementation Design QA)

**Purpose:** After frontend implementation, audits the built code against the Documentation/UI Framework/ specs and the approved Paper prototype structure. This is a **code-level audit** — it reads `.tsx` files and checks Tailwind classes, not browser screenshots.

**Trigger:** Invoked by `new-feature` orchestrator during stage 7a. Can also be invoked standalone via `/design-review`.

**Replaces:** The old `design-qa.md` prompt (from the former `/feature` skill), which used outdated values (Tailwind grays instead of plum-derived tokens). The new design-review skill uses `Documentation/UI Framework/` as the single source of truth.

**Process:**

1. **Read the implemented code** — all `.tsx` files created or modified, focusing on Tailwind classes, component structure, and JSX patterns
2. **Read the relevant docs** — `tokens.md` always, plus the `_foundations.md` and specific guides for each component type used
3. **Check Paper prototype structure** — use `mcp__paper__get_tree_summary` on the approved prototype nodes to compare structural hierarchy (not pixel comparison)
4. **Audit against rubric** — check each element against the quality rubric below
5. **Report** — list issues with severity and exact fix instructions
6. **Iterate** — if blockers found, provide fixes; re-audit after implementer applies them

**Quality Rubric:**

| Category | Check | Source of Truth |
|----------|-------|----------------|
| Token compliance | All colors, spacing, elevation, radius, borders from token system — no Tailwind grays, no arbitrary hex | `Documentation/UI Framework/tokens.md` |
| Typography | 5-tier scale only, correct weights, Plus Jakarta Sans | `tokens.md` § Typography |
| Layout structure | Component hierarchy matches approved Paper prototype | `mcp__paper__get_tree_summary` on prototype nodes |
| Component correctness | Each component follows its doc spec (decision tree → specific guide) | Category `_foundations.md` + specific guide |
| States | Loading, empty, error states implemented per docs | `Patterns/_foundations.md`, component guides |
| Icons | Lucide only, `currentColor`, correct size tier, semantic map compliance | `iconography.md` |
| Accessibility | ARIA labels, keyboard nav, focus rings per docs | `Navigation/_foundations.md` § Focus Ring |

**Severity levels:**

- **Blocker:** Token violation (Tailwind gray instead of plum-derived, wrong font, wrong shadow tier), structural mismatch with prototype, missing required states
- **Warning:** Spacing slightly off from doc spec, minor structural discrepancy, missing responsive behavior
- **Nit:** Animation timing, minor alignment, could be more polished

**Output:** A review report:
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

---

## Enrichment: `frontend-design` Craft Section

Add a craft section to the existing `frontend-design` skill. This ensures craft principles are accessible during both design exploration AND implementation. **Ship this enrichment simultaneously with the `design-explore` skill creation.**

Addition to `frontend-design` SKILL.md (append before Tech Stack section):

```markdown
## Craft — Design Quality Within Brand

When building or prototyping, apply these craft principles:

- **Typography rhythm**: hierarchy through the 5-tier scale + weight variation within tiers
- **Color composition**: Plum + Off-white foundation, one accent moment per view
- **Spacing composition**: tighter within groups, generous between sections
- **Motion**: staggered entrances (30-50ms), fast hovers (100ms), natural panel transitions (200-250ms)
- **Composition**: hero element gets 40-60% visual weight, vertical rhythm across sections

Full craft guidance with examples is in the `design-explore` skill (`/.claude/skills/design-explore/SKILL.md` § Craft Guidance). Read it when prototyping or building new UI.
```

---

## File Locations

| File | Path |
|------|------|
| `new-feature` skill | `.claude/skills/new-feature/SKILL.md` |
| `new-feature` config | `.claude/skills/new-feature/config.json` |
| Backend discovery prompt | `.claude/skills/new-feature/prompts/backend-discovery.md` |
| Implementer prompt | `.claude/skills/new-feature/prompts/implementer.md` (migrated from `/feature`) |
| Test writer prompt | `.claude/skills/new-feature/prompts/test-writer.md` (migrated from `/feature`) |
| Code reviewer prompt | `.claude/skills/new-feature/prompts/code-reviewer.md` (migrated from `/feature`) |
| `design-explore` skill | `.claude/skills/design-explore/SKILL.md` |
| `design-review` skill | `.claude/skills/design-review/SKILL.md` |
| `frontend-design` (enrichment) | `.claude/skills/frontend-design/SKILL.md` (existing, add craft section) |

**Note:** `backend-discovery` is a subagent prompt dispatched by the `new-feature` orchestrator, not a standalone skill. The three migrated prompts (`implementer.md`, `test-writer.md`, `code-reviewer.md`) are copied from the old `/feature` skill and updated as needed.

---

## Implementation Order

1. **`design-explore` skill + `frontend-design` craft enrichment** (ship together — the craft section references design-explore)
2. **`design-review` skill** (standalone, can be used independently via `/design-review`)
3. **`new-feature` orchestrator** — create skill, config, migrate prompts from `/feature`, add `backend-discovery` prompt
4. **Remove old `/feature` skill** — delete `.claude/skills/feature/` (the worktree copy at `.claude/worktrees/cross-year-map-comparison/.claude/skills/feature/` is separate and can be cleaned up when that worktree is removed)

---

## Out of Scope

- Changes to existing superpowers skills (brainstorming, writing-plans, etc.)
- Backend framework changes
- New documentation files (the existing 51 docs are sufficient)
- Changes to Paper artboards (those are design artifacts, not code)
