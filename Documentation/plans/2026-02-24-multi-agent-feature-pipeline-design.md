# Multi-Agent Feature Pipeline — Design

**Date:** 2026-02-24
**Status:** Approved

## Problem Statement

Feature development currently requires manual orchestration of multiple steps: writing PRDs, reviewing against the codebase, implementing code, checking frontend quality, writing tests, and reviewing the final result. This is time-consuming and requires constant attention throughout the process.

## Solution

A single orchestrator skill (`/feature`) that manages a pipeline of 6 specialized subagents. The system runs fully autonomously with two human checkpoints: PRD approval (via Slack notification) and final code review.

## Architecture

```
You: /feature "add export to CSV"
         │
         ▼
┌──────────────────────────────────┐
│  Manager Skill (/feature)        │
│                                  │
│  Phase 1: PRD                    │
│  ┌─────────────────────────────┐ │
│  │ Create git worktree         │ │
│  │ Stage 1a: PRD Writer        │ │
│  │   (explores codebase, asks  │ │
│  │    human questions 1-by-1,  │ │
│  │    writes first draft)      │ │
│  │ Stage 1b: Agent Review Loop │ │
│  │   (2 autonomous rounds:     │ │
│  │    reviewer → writer revise)│ │
│  └─────────────────────────────┘ │
│         │                        │
│         ▼                        │
│  [Slack notification + pause]    │
│  Human approves final PRD        │
│         │                        │
│         ▼                        │
│  Phase 2: Implementation         │
│  ┌─────────────────────────────┐ │
│  │ Stage 3: Implementer        │ │
│  │ Stage 4: Design QA          │ │
│  │ Stage 5: Test Writer        │ │
│  │ (fix loop, up to 3x)        │ │
│  │ Stage 6: Code Reviewer      │ │
│  └─────────────────────────────┘ │
│         │                        │
│         ▼                        │
│  [Slack notification + pause]    │
│  Human does final review         │
└──────────────────────────────────┘
```

## Stage Details

### Stage 1a — PRD Writer (Human-in-the-Loop)

**Input:** Feature description (natural language) + human answers to clarifying questions
**Output:** `docs/plans/YYYY-MM-DD-<feature>-prd.md`

The PRD writer agent:
- Reads the codebase to understand relevant existing code (Grep/Glob/Read)
- Reads existing design docs in `Docs/plans/` for conventions
- Reads `Docs/.md Files/TECHSTACK.md` and `Docs/data-dictionary.md` for technical context
- Reads `prisma/schema.prisma` for data model context
- **Asks the human clarifying questions one at a time** — purpose, scope, constraints, UI preferences, priority, edge cases, etc. The human's answers shape the first draft
- Produces a PRD covering:
  - Problem statement — what and why
  - Proposed solution — high-level approach
  - Technical design — affected files, data model changes, API changes
  - UI/UX changes — referencing Fullmind brand guidelines if applicable
  - Edge cases & error handling
  - Testing strategy

### Stage 1b — Agent Review Loop (Autonomous, 2 Rounds)

**Input:** The PRD + full codebase access
**Output:** Revised PRD with review notes

Two autonomous revision rounds:
1. PRD Reviewer reviews → identifies issues/improvements
2. PRD Writer revises based on feedback
3. PRD Reviewer reviews again → identifies remaining issues
4. PRD Writer makes final revisions

The reviewer agent:
- Cross-references against the actual codebase to check feasibility
- Checks for conflicts with existing features
- Validates data model changes against `prisma/schema.prisma`
- Checks for missing edge cases
- Verifies testing strategy is adequate

After 2 rounds, the PRD proceeds to human approval regardless (with any remaining flags noted).

### Human Checkpoint: PRD Approval

- Slack incoming webhook sends message with PRD summary + file path
- Terminal pauses with `AskUserQuestion`
- Human approves, rejects, or provides feedback
- On rejection with feedback → PRD writer revises, reviewer re-reviews, re-pauses

### Stage 3 — Implementer (Code Writer)

**Input:** Approved PRD
**Output:** Working code changes

The implementer agent:
- Follows the PRD's technical design
- Uses existing project patterns (Zustand stores, TanStack Query hooks, Prisma models)
- Creates/modifies files per the PRD specification
- Follows existing code conventions from the codebase
- References `frontend-design` skill knowledge for any UI work (Fullmind brand compliance)

### Stage 4 — Design QA

**Input:** Code changes (git diff) + PRD
**Output:** Design feedback or "PASSED"

The design QA agent:
- Checks all UI components against Fullmind brand guidelines (colors, typography, spacing)
- Verifies component patterns match existing conventions (tables, badges, buttons, modals)
- Checks responsive breakpoints
- Validates accessibility basics (contrast, semantic HTML, ARIA)
- Uses the `frontend-design` skill as reference
- If issues found → implementer auto-fixes

### Stage 5 — Test Writer

**Input:** Code changes + PRD
**Output:** Test files + test results

The test writer agent:
- Writes Vitest tests following existing test patterns in the codebase
- Covers unit tests for new logic, integration tests for API routes
- Runs `npx vitest` to verify all tests pass (new and existing)
- **Fix loop:** If tests fail → implementer fixes → rerun (up to 3 attempts)
- If still failing after 3 attempts → flag in final report

### Stage 6 — Code Reviewer

**Input:** All code changes + PRD + test results
**Output:** `docs/plans/YYYY-MM-DD-<feature>-final-report.md`

The code reviewer agent:
- Reviews all changes against the PRD (did we build what we said we'd build?)
- Checks for security issues (OWASP top 10)
- Checks for performance concerns
- Validates code quality and consistency
- Produces a final report with:
  - Summary of what was built
  - Files changed (with line counts)
  - Test coverage summary
  - Any flags or concerns
  - Recommendation: READY FOR REVIEW or NEEDS ATTENTION

### Human Checkpoint: Final Review

- Slack notification: "Feature ready for review: <feature name>"
- Terminal presents the final report summary
- Human reviews the worktree branch, approves → merge options presented

## File Structure

```
.claude/skills/feature/
├── SKILL.md              # Master orchestrator skill
├── prompts/
│   ├── prd-writer.md     # System prompt for PRD writer agent
│   ├── prd-reviewer.md   # System prompt for PRD reviewer agent
│   ├── implementer.md    # System prompt for code writer agent
│   ├── design-qa.md      # System prompt for design QA agent
│   ├── test-writer.md    # System prompt for test writer agent
│   └── code-reviewer.md  # System prompt for code reviewer agent
└── config.json           # Slack webhook URL, tuning parameters
```

### config.json

```json
{
  "slack_webhook_url": "https://hooks.slack.com/services/...",
  "max_prd_revisions": 2,
  "max_test_fix_attempts": 3,
  "docs_path": "Docs/plans"
}
```

## Invocation

```
/feature "add ability to export district data as CSV"
```

The skill:
1. Parses the feature description
2. Generates a slug: `export-district-csv`
3. Creates a worktree: `.claude/worktrees/export-district-csv`
4. Runs Phase 1 (PRD + review loop)
5. Sends Slack notification + pauses for approval
6. On approval → runs Phase 2 (implementation pipeline)
7. Sends Slack notification + presents final report
8. On approval → presents merge/PR options

## Artifacts Produced

For a feature called "export-district-csv":

```
Docs/plans/
├── 2026-02-24-export-district-csv-prd.md          # Approved PRD
├── 2026-02-24-export-district-csv-review.md        # Reviewer notes (all rounds)
└── 2026-02-24-export-district-csv-final-report.md  # Code review + summary

src/features/...                                     # Implementation code
src/features/.../__tests__/...                       # Test files
prisma/migrations/...                                # Schema changes (if needed)
```

Plus a git branch in the worktree with clean, reviewable commits.

## Notification Details

**Slack incoming webhook** (one-way, send-only):
- PRD ready: Posts feature name, PRD summary (3-5 lines), and file path
- Feature ready: Posts feature name, final report summary, files changed count, test results

**Future enhancement:** Full Slack app with interactive buttons for true remote approval without returning to the terminal.

## Key Design Decisions

1. **Single orchestrator** — One skill manages all stages. Simplest to build and debug.
2. **Task subagents** — Each stage runs as a Claude Code Task subagent with a focused prompt.
3. **Git worktree isolation** — Feature work happens on an isolated branch.
4. **File-based artifact handoff** — Stages communicate via markdown files in `Docs/plans/`.
5. **Self-healing loops** — PRD revisions (2x) and test fix attempts (3x) before flagging.
6. **Two human checkpoints** — PRD approval and final code review.
7. **Slack notifications** — Alert when human input needed. Terminal pauses for response.
