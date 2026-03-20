# Context Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a three-file context library (CLAUDE.md, architecture.md, prompting-guide.md) and update all 5 existing skills to reference the new docs.

**Architecture:** Documentation-only changes — no code modifications. Three new markdown files at project root and `docs/`, edits to 5 skill SKILL.md files and 1 existing doc file.

**Tech Stack:** Markdown

**Spec:** `Docs/superpowers/specs/2026-03-20-context-library-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `CLAUDE.md` | Always-loaded project identity, conventions, guardrails |
| Create | `docs/architecture.md` | On-demand feature map, patterns, metrics, cross-feature deps |
| Create | `docs/prompting-guide.md` | Non-technical contributor guide with examples |
| Modify | `Documentation/.md Files/TECHSTACK.md` | Remove stale sections, add pointer to architecture.md |
| Modify | `.claude/skills/backend-discovery/SKILL.md` | Add context bootstrapping, fix schema search |
| Modify | `.claude/skills/design-explore/SKILL.md` | Add context bootstrapping |
| Modify | `.claude/skills/design-review/SKILL.md` | Add context bootstrapping |
| Modify | `.claude/skills/frontend-design/SKILL.md` | Update Step 2, fix stale paths |
| Modify | `.claude/skills/new-feature/SKILL.md` | Add context bootstrapping + context maintenance step |

---

### Task 1: Create CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Create CLAUDE.md**

Copy the content from spec Deliverable 1 (lines 36-91) exactly into `CLAUDE.md` at the project root.

- [ ] **Step 2: Verify CLAUDE.md**

Read back the file and confirm:
- It starts with `# Territory Plan Builder`
- "Before You Start" references `docs/architecture.md` and `Documentation/UI Framework/tokens.md`
- "Large Files" section lists store.ts (~1400 lines), layers.ts (688 lines), schema.prisma
- "Skills Available" lists all 5 skills
- "Documentation" section lists all doc paths including the new `docs/architecture.md` and `docs/prompting-guide.md`

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md for agent and contributor orientation"
```

---

### Task 2: Create docs/architecture.md

**Files:**
- Create: `docs/architecture.md`

- [ ] **Step 1: Create docs directory if needed and architecture.md**

Create `docs/architecture.md` with the content from spec Deliverable 2 (lines 103-239).

- [ ] **Step 2: Verify architecture.md**

Read back and confirm:
- Feature Directory Map table has all 15 features (map, plans, districts, activities, tasks, calendar, progress, goals, explore, integrations, home, vacancies, mixmax, admin, shared)
- The `map` feature tree includes `DistrictDetailPanel.tsx` as container/entry point
- store.ts shows `~1400 lines`
- Key Metrics section has all 4 subsections: Sales Funnel, Vendor Financial, Summary Bar, District Education Data
- Shared Components lists: layout/, navigation/, filters/, views/, DataGrid/, format.ts, cn.ts

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: add architecture guide for codebase navigation"
```

---

### Task 3: Create docs/prompting-guide.md

**Files:**
- Create: `docs/prompting-guide.md`

- [ ] **Step 1: Create prompting-guide.md**

Create `docs/prompting-guide.md` with the content from spec Deliverable 3 (lines 251-459).

- [ ] **Step 2: Verify prompting-guide.md**

Read back and confirm:
- 5 examples present: Building a New Feature, Improving an Existing Feature, Fixing a Bug, Exploring a New Idea, Querying the Database
- Each example has a blockquoted prompt and a "Why this works" explanation
- Examples reference real app terms: district detail panel, explore grid, progress dashboard, Pipeline/Bookings/Invoicing metrics, districts table columns
- Key Terms table maps user language to app features (8 rows)
- Available Commands table lists 3 user-facing commands + note about internal commands
- "Things to Know" section at the end

- [ ] **Step 3: Commit**

```bash
git add docs/prompting-guide.md
git commit -m "docs: add prompting guide for non-technical contributors"
```

---

### Task 4: Update TECHSTACK.md

**Files:**
- Modify: `Documentation/.md Files/TECHSTACK.md`

- [ ] **Step 1: Read current TECHSTACK.md**

Read `Documentation/.md Files/TECHSTACK.md` to confirm current line positions of sections to remove.

- [ ] **Step 2: Add architecture.md pointer**

After the Core Framework table (after the row with Next.js/React/TypeScript), add:

```markdown
> For project structure and codebase navigation, see `docs/architecture.md`.
```

- [ ] **Step 3: Remove Store Structure subsection**

Remove the "### Store Structure" subsection under "## State Management" — it references the stale path `src/lib/store.ts` and its contents are covered better in `docs/architecture.md`. The subsection starts with `### Store Structure (`src/lib/store.ts`)` and ends before `## Database`.

- [ ] **Step 4: Remove Project Structure section**

Remove the "## Project Structure" section — it contains a stale directory tree with `src/components/` (doesn't exist) and `src/lib/store.ts` (wrong path). Replaced by `docs/architecture.md`.

The section starts with `## Project Structure` and its tree block, ending before `## Development`.

- [ ] **Step 5: Verify TECHSTACK.md**

Read back and confirm:
- Architecture pointer appears after Core Framework table
- No "Store Structure" subsection remains
- No "Project Structure" section remains
- "State Management" section still has its technology table (Zustand, TanStack Query)
- "Development" section and everything after it is intact

- [ ] **Step 6: Commit**

```bash
git add "Documentation/.md Files/TECHSTACK.md"
git commit -m "docs: remove stale structure sections from TECHSTACK.md, add architecture.md pointer"
```

---

### Task 5: Update backend-discovery skill

**Files:**
- Modify: `.claude/skills/backend-discovery/SKILL.md`

- [ ] **Step 1: Read current SKILL.md**

Read `.claude/skills/backend-discovery/SKILL.md` to confirm section positions.

- [ ] **Step 2: Add Context Bootstrapping section**

After the "## Inputs" section (which ends with the slug/date bullet) and before `## Process`, insert:

```markdown
## Context Bootstrapping

Before exploring, read these for a warm start:
- `docs/architecture.md` — feature map, entry points, cross-feature dependencies
- `docs/architecture.md` § "Key Metrics" — Fullmind's sales funnel metrics and how they map to DB columns
- `Documentation/.md Files/TECHSTACK.md` § "Database" and "API Layer" — schema overview, connection patterns, route structure

This gives you the project's conventions before you grep. Your job is to discover **feature-specific** context that these general docs don't cover.
```

- [ ] **Step 3: Replace Step 1 (Explore Data Models)**

Replace the current step 1 content (which includes a `find` command to search for schema files) with:

```markdown
### 1. Explore Data Models

Schema is at `prisma/schema.prisma`. Prisma client at `src/lib/prisma.ts`,
raw SQL pool at `src/lib/db.ts`. Grep the schema for models relevant to
the feature — don't read the whole file.

For each relevant model, document: name, key fields, relationships, and any custom types or enums.
```

- [ ] **Step 4: Verify**

Read back and confirm:
- Context Bootstrapping section appears between Inputs and Process
- Step 1 no longer has a `find` command
- Step 1 references `prisma/schema.prisma`, `src/lib/prisma.ts`, `src/lib/db.ts`

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/backend-discovery/SKILL.md
git commit -m "docs: add context bootstrapping to backend-discovery skill"
```

---

### Task 6: Update design-explore skill

**Files:**
- Modify: `.claude/skills/design-explore/SKILL.md`

- [ ] **Step 1: Read current SKILL.md**

Read `.claude/skills/design-explore/SKILL.md` to confirm section positions.

- [ ] **Step 2: Add Context Bootstrapping section**

After `## Inputs` section (which ends with "If invoked standalone, gather these by asking the user and running the `frontend-design` discovery workflow.") and before `## Process`, insert:

```markdown
## Context Bootstrapping

Before prototyping, read:
- `docs/architecture.md` — understand where this feature fits in the app, what panels/pages exist, cross-feature dependencies
- `docs/architecture.md` § "Key Metrics" — if the feature involves financial data, understand the sales funnel and metric names

This prevents proposing layouts that conflict with the existing app structure.
```

- [ ] **Step 3: Verify**

Read back and confirm Context Bootstrapping section appears between Inputs and Process.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/design-explore/SKILL.md
git commit -m "docs: add context bootstrapping to design-explore skill"
```

---

### Task 7: Update design-review skill

**Files:**
- Modify: `.claude/skills/design-review/SKILL.md`

- [ ] **Step 1: Read current SKILL.md**

Read `.claude/skills/design-review/SKILL.md` to confirm section positions.

- [ ] **Step 2: Add Context Bootstrapping section**

After `## Inputs` section (which ends with the feature spec path bullet) and before `## Process`, insert:

```markdown
## Context Bootstrapping

Before auditing, read:
- `docs/architecture.md` § "Key Patterns" — understand where shared components live so you can check for reuse violations
- `docs/architecture.md` § "Shared Components" — exact paths to DataGrid, filters, format utilities
```

- [ ] **Step 3: Verify**

Read back and confirm Context Bootstrapping section appears between Inputs and Process.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/design-review/SKILL.md
git commit -m "docs: add context bootstrapping to design-review skill"
```

---

### Task 8: Update frontend-design skill

**Files:**
- Modify: `.claude/skills/frontend-design/SKILL.md`

- [ ] **Step 1: Read current SKILL.md**

Read `.claude/skills/frontend-design/SKILL.md` and find "### Step 2 — Check existing components".

- [ ] **Step 2: Replace Step 2 content**

Replace the current Step 2 section (from `### Step 2 — Check existing components` through the line `Use Glob and Grep to find existing implementations. Reuse and extend before creating.`) with:

```markdown
### Step 2 — Check existing components

Before creating anything new, search for what already exists. Read
`docs/architecture.md` § "Shared Components" for the full inventory, then:

- `src/features/shared/components/` — shared feature components (DataGrid, InlineEditCell, filters, layout, navigation)
- `src/features/shared/lib/` — shared utilities (format.ts, cn.ts, date-utils.ts)
- `src/features/*/components/` — feature-specific components

Use Glob and Grep to find existing implementations. Reuse and extend before creating.
```

This removes the stale `src/components/common/` reference.

- [ ] **Step 3: Verify**

Read back and confirm:
- Step 2 references `docs/architecture.md` § "Shared Components"
- No reference to `src/components/common/` exists anywhere in the file
- The `src/features/shared/components/` and `src/features/shared/lib/` paths are listed

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/frontend-design/SKILL.md
git commit -m "docs: update frontend-design skill to reference architecture.md, fix stale paths"
```

---

### Task 9: Update new-feature skill

**Files:**
- Modify: `.claude/skills/new-feature/SKILL.md`

- [ ] **Step 1: Read current SKILL.md**

Read `.claude/skills/new-feature/SKILL.md` and find Stage 1 and Stage 8b.

- [ ] **Step 2: Add context bootstrapping to Stage 1**

In Stage 1 (Discovery), before `**1a. Requirements gathering:**`, insert:

```markdown
**Context bootstrapping:**

Read `docs/architecture.md` before starting discovery. This gives you:
- The feature map (so you know what exists and where things live)
- Key patterns (data fetching, state management, shared components)
- Key metrics (so you understand the business domain)
- Cross-feature dependencies (so you know what your feature touches)

This replaces blind exploration — start from the map, then drill into
specifics for the feature being built.
```

- [ ] **Step 3: Add context maintenance step at Stage 8b½**

After `**8b. Verification:**` (and its content about running vitest and build) and before `**8c. Slack notification (if configured):**`, insert:

```markdown
**8b-1/2. Context documentation:**

After implementation is verified (tests pass, build clean), check whether
the changes require updates to context documentation:

**Check `docs/architecture.md`:**
- New feature directory created? -> Add to the Feature Directory Map table
- New shared component created? -> Add to the Shared Components section
- New cross-feature dependency introduced? -> Update Cross-Feature Dependencies
- New metrics or financial fields added? -> Update Key Metrics section

**Check `Documentation/.md Files/TECHSTACK.md`:**
- New API routes added? -> Add to the API Route Structure section
- New database tables/models? -> Update the Database Schema Overview tree
- New external integration? -> Add to the relevant technology table
- New environment variables required? -> Add to the Environment Variables section

**Check `CLAUDE.md`:**
- Usually no changes needed — it references architecture.md and TECHSTACK.md
  for details. Only update if a new skill was created or a core convention changed.

**Check `docs/prompting-guide.md`:**
- New major feature that users would want to prompt about? -> Add an entry
  to the Key Terms table mapping user language to the new feature

**How to check:** Diff the worktree branch against main to see what was
created. Grep the diff for:
- New directories under `src/features/`
- New files under `src/app/api/`
- New models in `prisma/schema.prisma`
- New exports from `src/features/shared/`

Only update docs that are affected. Don't touch docs for unrelated sections.
Commit context doc updates as a separate commit from the feature code.
```

- [ ] **Step 4: Verify**

Read back and confirm:
- Context bootstrapping appears at the start of Stage 1, before 1a
- 8b½ appears between 8b (Verification) and 8c (Slack notification)
- 8b½ checks all 4 doc files: architecture.md, TECHSTACK.md, CLAUDE.md, prompting-guide.md

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/new-feature/SKILL.md
git commit -m "docs: add context bootstrapping and maintenance step to new-feature skill"
```
