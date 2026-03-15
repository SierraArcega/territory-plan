---
name: new-feature
description: Use when building a new feature end-to-end. Orchestrates discovery, design exploration, spec writing, implementation, design review, code review, testing, and shipping. Replaces the old /feature skill.
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
- Search `src/components/` and `src/features/` for existing components

Output: `ui_component_candidates` — list of existing components + doc references.

**1c. Backend discovery:**

Dispatch a subagent using the `backend-discovery` skill's process:
- Explore data models, APIs, auth patterns, shared utilities, testing patterns
- Save output to `[docs_path]/specs/[DATE]-[SLUG]-backend-context.md`

Output: `backend_context_path` — path to the saved context document.

---

### Stage 2: Design Exploration

**Goal:** Explore 2-3 meaningfully different approaches, present trade-offs, let the user choose.

Present 2-3 design directions with:
- `requirements_summary` from stage 1a
- `ui_component_candidates` from stage 1b
- `backend_context_path` from stage 1c

For each direction, describe:
1. Layout and interaction approach
2. Component architecture (existing vs new)
3. Trade-offs (complexity, performance, extensibility)

**GATE:** Present status and wait for user decision:
```
--- Stage 2 Complete: Design Exploration ---

Explored N approaches:
  A. [description] (recommended)
  B. [description]
  C. [description]

→ Pick a direction to refine, request changes, or ask me to explore more options.
```

If user requests iteration → revise directions with feedback.
If user picks a direction → proceed to Stage 3.

---

### Stage 3: Refine Chosen Direction

**Goal:** Detail the chosen approach, iterate on specifics, get final approval.

Refine the chosen direction:
- Add detail: hover states, loading states, empty states, error states
- Check component docs for each element used
- Describe interaction patterns and responsive behavior

**GATE:** User approves final design direction.

Output: `approved_design_description` — detailed description of the approved approach.

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

**GATE:** User approves spec before execution begins.

---

### Stage 5: Plan

**Goal:** Write a detailed implementation plan with frontend and backend tasks.

Write the plan to `[docs_path]/plans/[DATE]-[SLUG]-plan.md`:
- Frontend tasks (referencing approved design + component docs)
- Backend tasks (referencing backend context doc)
- Task dependencies and ordering
- Test strategy for each task

**GATE:** User approves plan.

---

### Stage 6: Implement

**Goal:** Build the feature per the approved plan.

Read the implementer prompt from `.claude/skills/new-feature/prompts/implementer.md`.

Dispatch implementer subagent (`subagent_type: "general-purpose"`) with:
- `{{SPEC_PATH}}` = spec path from stage 4
- `{{IMPLEMENTATION_CONTEXT}}` = plan path + backend context path + approved design description

If the plan has independent frontend and backend tasks, dispatch parallel agents.

Save the implementer's report for stages 7-8.

---

### Stage 7: Review

**Goal:** Verify the implementation against the design and code standards.

**7a. Design Review:**

Invoke the `design-review` skill:
- Pass the list of `.tsx` files from the implementer report
- Pass the approved design description from stage 3
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

**GATE:** User reviews results. If issues → re-dispatch implementer, re-review.

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

**GATE:** Present final report summary. **Dual-channel approval:** if Slack is configured, check `slack_check_approval` before presenting the terminal prompt — the user may have already approved from Slack. Ask user:
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
