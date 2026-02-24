# Multi-Agent Feature Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `/feature` skill that orchestrates 6 specialized subagents to autonomously write PRDs, review them, implement code, check design quality, write tests, and review code — with Slack notifications and two human checkpoints.

**Architecture:** Single orchestrator skill (SKILL.md) dispatches sequential Task subagents, each with a focused prompt file. Artifacts flow via markdown files in `Docs/plans/`. Work happens in an isolated git worktree. Two human checkpoints: PRD approval and final code review, both with Slack webhook notifications.

**Tech Stack:** Claude Code skills system, Task tool subagents, Slack incoming webhooks, git worktrees

**Reference:** `Docs/plans/2026-02-24-multi-agent-feature-pipeline-design.md`

---

### Task 1: Create Skill Directory Structure and Config

**Files:**
- Create: `.claude/skills/feature/config.json`

**Step 1: Create the config file**

```json
{
  "slack_webhook_url": "",
  "max_prd_revisions": 2,
  "max_test_fix_attempts": 3,
  "docs_path": "Docs/plans"
}
```

The `slack_webhook_url` is left empty — the user will fill it in with their actual Slack incoming webhook URL. The skill should gracefully skip Slack notifications if this is empty.

**Step 2: Create the prompts directory**

```bash
mkdir -p .claude/skills/feature/prompts
```

**Step 3: Commit**

```bash
git add .claude/skills/feature/config.json
git commit -m "chore: scaffold feature skill directory and config"
```

---

### Task 2: Write PRD Writer Prompt

**Files:**
- Create: `.claude/skills/feature/prompts/prd-writer.md`

**Step 1: Write the prompt file**

This prompt is used by the orchestrator to dispatch a Task subagent. The subagent writes a PRD for the requested feature by exploring the codebase.

```markdown
# PRD Writer Subagent

You are writing a Product Requirements Document (PRD) for a feature in the Fullmind Territory Planner — a Next.js 16 + React 19 + TypeScript + Tailwind 4 application that visualizes ~13,000 US school district polygons with sales performance data for K-12 territory planning.

## Feature Request

{{FEATURE_DESCRIPTION}}

## Your Job

Write a comprehensive PRD and save it to `{{DOCS_PATH}}/{{DATE}}-{{SLUG}}-prd.md`.

### Before Writing

Explore the codebase to understand:
1. **Relevant existing code** — Use Grep and Glob to find files related to this feature. Read them.
2. **Data model** — Read `prisma/schema.prisma` for database context
3. **Tech stack conventions** — Read `Docs/.md Files/TECHSTACK.md`
4. **Existing design patterns** — Scan 2-3 recent files in `Docs/plans/` for PRD format conventions
5. **Existing components** — Check `src/components/` and `src/features/` for reusable pieces

### PRD Format

Write the PRD with these sections:

```
# [Feature Name]

**Date:** YYYY-MM-DD
**Status:** Draft

## Problem Statement
What problem does this solve? Who benefits? Why now?

## Proposed Solution
High-level description of the approach. 2-3 paragraphs max.

## Technical Design

### Affected Files
- List every file that needs to be created or modified
- Use exact paths (e.g., `src/features/exports/components/ExportButton.tsx`)

### Data Model Changes
- New Prisma models or fields (if any)
- Migration needed? (yes/no)

### API Changes
- New or modified API routes in `src/app/api/`
- Request/response shapes

### UI Changes
- New components or views
- Layout changes
- Reference Fullmind brand guidelines (Plum #403770, Off-white #FFFCFA, etc.)

## Edge Cases & Error Handling
- What can go wrong?
- How should each failure be handled?
- Empty states, loading states, error states

## Testing Strategy
- Unit tests: what logic to test
- Integration tests: what API routes to test
- Component tests: what UI behavior to verify
- Approximate number of test cases
```

### Quality Checks Before Submitting

- Every file path references an actual location in the project structure
- Data model changes are compatible with the existing Prisma schema
- No proposed changes conflict with existing features
- Testing strategy is specific (not generic "add tests")
- UI changes reference Fullmind brand colors and patterns

{{REVISION_CONTEXT}}

## Report

When done, report:
- PRD file path
- Key technical decisions made
- Any assumptions you made (flag these clearly)
- Areas of uncertainty
```

Note on `{{REVISION_CONTEXT}}`: When the PRD writer is called for a revision, the orchestrator will append reviewer feedback here. On first run, this section is omitted.

**Step 2: Commit**

```bash
git add .claude/skills/feature/prompts/prd-writer.md
git commit -m "feat: add PRD writer subagent prompt"
```

---

### Task 3: Write PRD Reviewer Prompt

**Files:**
- Create: `.claude/skills/feature/prompts/prd-reviewer.md`

**Step 1: Write the prompt file**

```markdown
# PRD Reviewer Subagent

You are reviewing a Product Requirements Document for a feature in the Fullmind Territory Planner — a Next.js 16 + React 19 + TypeScript + Tailwind 4 application.

## The PRD

Read the PRD at: `{{PRD_PATH}}`

## Your Job

Cross-reference the PRD against the actual codebase to verify it is feasible, complete, and well-designed. You are a skeptical reviewer — do not take the PRD at face value.

### Verification Checklist

**Feasibility:**
- [ ] Do the referenced files actually exist at the stated paths? (Use Glob to check)
- [ ] Are the proposed data model changes compatible with `prisma/schema.prisma`?
- [ ] Do the proposed API routes follow the existing pattern in `src/app/api/`?
- [ ] Are the proposed UI components consistent with existing patterns in `src/features/`?

**Conflicts:**
- [ ] Do any proposed changes conflict with existing features? (Read the affected files)
- [ ] Would the proposed data model changes break existing queries?
- [ ] Do the proposed API routes collide with existing routes?

**Completeness:**
- [ ] Are all affected files listed? (Search for related code the PRD might have missed)
- [ ] Are edge cases addressed? (Think about empty data, concurrent users, large datasets)
- [ ] Is the testing strategy specific enough to actually implement?
- [ ] Are error states defined for every new UI component?

**Design Quality:**
- [ ] Is the solution over-engineered? (Flag unnecessary complexity — YAGNI)
- [ ] Could an existing component or pattern be reused instead of creating new ones?
- [ ] Are there simpler alternatives the PRD didn't consider?

**Brand Compliance (if UI changes):**
- [ ] Colors reference the Fullmind brand palette (Plum, Coral, Golden, Steel Blue, Robin's Egg, Mint, Off-white)
- [ ] Typography uses Plus Jakarta Sans
- [ ] Component patterns match existing conventions

### Output Format

If the PRD passes all checks:

```
## Review Result: APPROVED

No issues found. The PRD is feasible, complete, and well-designed.
```

If issues are found:

```
## Review Result: REVISE

### Issues Found

1. **[Critical/Important/Minor]**: [Description]
   - What's wrong: [specific problem]
   - Where to look: [file path or PRD section]
   - Suggested fix: [concrete suggestion]

2. ...

### What's Good
- [List 2-3 things the PRD does well]
```

Be specific. "The testing strategy is vague" is not helpful. "The testing strategy doesn't cover the case where the CSV export has >10,000 rows, which is common in this dataset" is helpful.

## Report

Report:
- APPROVED or REVISE
- If REVISE: numbered list of issues with severity and suggested fixes
- Review round number: {{REVIEW_ROUND}}
```

**Step 2: Commit**

```bash
git add .claude/skills/feature/prompts/prd-reviewer.md
git commit -m "feat: add PRD reviewer subagent prompt"
```

---

### Task 4: Write Implementer Prompt

**Files:**
- Create: `.claude/skills/feature/prompts/implementer.md`

**Step 1: Write the prompt file**

This is the code-writing agent. It reads the approved PRD and implements the feature.

```markdown
# Implementer Subagent

You are implementing a feature for the Fullmind Territory Planner — a Next.js 16 + React 19 + TypeScript + Tailwind 4 application with Zustand for UI state, TanStack Query for server state, Prisma ORM with PostgreSQL + PostGIS, and MapLibre GL JS for mapping.

## Approved PRD

Read the PRD at: `{{PRD_PATH}}`

## Context

{{IMPLEMENTATION_CONTEXT}}

## Before You Begin

Read the PRD fully. Then explore the codebase files referenced in the PRD to understand existing patterns:
- How are similar features structured? Check `src/features/` for the nearest equivalent
- How are API routes structured? Check `src/app/api/` for patterns
- How are stores structured? Check files importing from `zustand`
- How are queries structured? Check files using `@tanstack/react-query`

If you have questions about:
- The requirements or acceptance criteria
- The approach or implementation strategy
- Dependencies or assumptions
- Anything unclear in the PRD

**Ask them now.** Do not guess or make assumptions about ambiguous requirements.

## Your Job

1. **Implement exactly what the PRD specifies** — nothing more, nothing less
2. **Follow existing patterns** — match the code style, file structure, and conventions already in the codebase
3. **Write clean, type-safe TypeScript** — no `any` types, no `@ts-ignore`
4. **For UI work:** Follow Fullmind brand guidelines:
   - Primary text/UI: Plum `#403770`
   - Page backgrounds: Off-white `#FFFCFA`
   - Negative signals: Deep Coral `#F37167`
   - Positive signals: Mint `#EDFFE3`
   - Font: Plus Jakarta Sans (already configured)
   - Check `src/components/` for existing components before creating new ones
5. **Commit your work** with clear, descriptive commit messages
6. **Self-review** before reporting back (see below)

## Self-Review Before Reporting

Review your work:

**Completeness:**
- Did I implement everything in the PRD?
- Did I miss any requirements?
- Are there edge cases I didn't handle?

**Quality:**
- Is the code clean and maintainable?
- Are names clear and accurate?
- No `any` types, no `@ts-ignore`, no `eslint-disable`?

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

**Step 2: Commit**

```bash
git add .claude/skills/feature/prompts/implementer.md
git commit -m "feat: add implementer subagent prompt"
```

---

### Task 5: Write Design QA Prompt

**Files:**
- Create: `.claude/skills/feature/prompts/design-qa.md`

**Step 1: Write the prompt file**

```markdown
# Design QA Subagent

You are reviewing the frontend implementation quality of a feature for the Fullmind Territory Planner.

## PRD

Read the PRD at: `{{PRD_PATH}}`

## What Was Implemented

{{IMPLEMENTER_REPORT}}

## Your Job

Review all UI changes for brand compliance, design quality, and accessibility. Read every file that was created or modified that contains UI code (`.tsx` files, Tailwind classes).

### Brand Compliance Checklist

**Colors:**
- [ ] Primary text uses Plum `#403770` (not black, not gray-900)
- [ ] Page backgrounds use Off-white `#FFFCFA` (not `#fff` or `bg-white`)
- [ ] Negative signals use Deep Coral `#F37167` (not red)
- [ ] Caution signals use Golden `#FFCF70`
- [ ] Neutral data uses Steel Blue `#6EA3BE`
- [ ] Positive signals use Mint `#EDFFE3`
- [ ] Selection states use Robin's Egg `#C4E7E6`
- [ ] No Coral or Golden used for buttons (buttons are Plum only; destructive = Tailwind red)
- [ ] No Deep Coral text on Plum background

**Typography:**
- [ ] Font is Plus Jakarta Sans (already configured — just verify no system font overrides)
- [ ] Weight hierarchy: Bold (700) for headlines, Medium (500) for subheaders/buttons, Regular (400) for body

**Components:**
- [ ] Tables follow pattern: `border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden`
- [ ] Table headers: `bg-gray-50/80`, `text-[11px] font-semibold text-gray-500 uppercase tracking-wider`
- [ ] Badges use soft style with brand colors at 15-20% opacity
- [ ] Buttons: Primary = `bg-[#403770] text-white`, Secondary = `text-[#403770] hover:bg-gray-100`
- [ ] Modals: `rounded-xl shadow-2xl max-w-sm p-6`
- [ ] Loading skeletons: `animate-pulse bg-[#C4E7E6]/20 rounded`

**Spacing:**
- [ ] Page padding: `p-6`
- [ ] Card padding: `p-4`
- [ ] Section gaps: `gap-6`
- [ ] Button padding: `px-6 py-3` (standard) or `px-3 py-2` (compact)

### Design Quality

- [ ] Hover states defined for interactive elements
- [ ] Transitions use `transition-colors duration-100` for hover, `transition-opacity duration-150` for reveals
- [ ] Empty states are handled (icon + title + description pattern)
- [ ] Loading states are handled (skeleton or spinner)
- [ ] Error states are handled (with appropriate color coding)

### Accessibility

- [ ] Semantic HTML elements used (`button`, `nav`, `main`, not `div` for everything)
- [ ] Interactive elements are keyboard-accessible
- [ ] Color is not the only way to convey information (text labels or icons alongside)
- [ ] Focus styles present (`focus:ring-[#403770]`)

### Output Format

If all checks pass:

```
## Design QA Result: PASSED

All UI changes comply with Fullmind brand guidelines and meet quality standards.
```

If issues found:

```
## Design QA Result: ISSUES FOUND

### Issues

1. **[file:line]**: [Description]
   - Expected: [what it should be]
   - Actual: [what it is]
   - Fix: [exact code change]

2. ...
```

Be specific with fixes — provide the exact Tailwind class or code change needed.

## Report

Report:
- PASSED or ISSUES FOUND
- If ISSUES FOUND: numbered list with file:line references and exact fixes
- Count of UI files reviewed
```

**Step 2: Commit**

```bash
git add .claude/skills/feature/prompts/design-qa.md
git commit -m "feat: add design QA subagent prompt"
```

---

### Task 6: Write Test Writer Prompt

**Files:**
- Create: `.claude/skills/feature/prompts/test-writer.md`

**Step 1: Write the prompt file**

```markdown
# Test Writer Subagent

You are writing and running tests for a feature in the Fullmind Territory Planner. The project uses Vitest with jsdom environment, globals enabled, and Testing Library for React components.

## PRD

Read the PRD at: `{{PRD_PATH}}`

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
3. Read the PRD's testing strategy section

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

Based on the PRD testing strategy:
- **Unit tests**: Pure functions, data transformations, utility functions
- **Integration tests**: API routes (request → response), store actions
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

**Step 2: Commit**

```bash
git add .claude/skills/feature/prompts/test-writer.md
git commit -m "feat: add test writer subagent prompt"
```

---

### Task 7: Write Code Reviewer Prompt

**Files:**
- Create: `.claude/skills/feature/prompts/code-reviewer.md`

**Step 1: Write the prompt file**

```markdown
# Code Reviewer Subagent

You are performing a final code review of a completed feature for the Fullmind Territory Planner before it goes to the human reviewer.

## PRD

Read the PRD at: `{{PRD_PATH}}`

## Implementation Summary

{{IMPLEMENTER_REPORT}}

## Design QA Result

{{DESIGN_QA_REPORT}}

## Test Results

{{TEST_REPORT}}

## Your Job

Perform a thorough code review of ALL changes. Run `git diff {{BASE_BRANCH}}` to see every change made.

### Review Checklist

**Spec Compliance:**
- [ ] Every requirement in the PRD is implemented
- [ ] Nothing extra was built that wasn't requested (YAGNI)
- [ ] Edge cases from the PRD are handled

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

## Design QA
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
**READY FOR REVIEW** — All tests pass, design QA passed, no critical issues.
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

**Step 2: Commit**

```bash
git add .claude/skills/feature/prompts/code-reviewer.md
git commit -m "feat: add code reviewer subagent prompt"
```

---

### Task 8: Write the Master Orchestrator Skill (SKILL.md)

**Files:**
- Create: `.claude/skills/feature/SKILL.md`

This is the main skill file that Claude Code loads when the user invokes `/feature`. It orchestrates all 6 stages.

**Step 1: Write the SKILL.md file**

```markdown
---
name: feature
description: Use when building a new feature end-to-end — orchestrates PRD creation, codebase-aware review, implementation, design QA, testing, and code review with Slack notifications and human approval gates
---

# Feature Pipeline

Autonomously build features through a 6-stage pipeline with two human checkpoints. Takes a feature description, produces a reviewed PRD, implemented code, tested and design-QA'd, with a final code review report.

## When to Use

- User says `/feature "description"` or asks to build a new feature end-to-end
- User wants autonomous PRD → implementation → testing → review pipeline
- NOT for: quick bug fixes, single-file changes, or exploration tasks

## Configuration

Read `.claude/skills/feature/config.json` for:
- `slack_webhook_url` — Slack incoming webhook (skip notification if empty)
- `max_prd_revisions` — Max PRD revision cycles (default: 2)
- `max_test_fix_attempts` — Max test fix attempts (default: 3)
- `docs_path` — Where to save artifacts (default: `Docs/plans`)

## Pipeline

```
Phase 1: PRD (runs in worktree)
  Stage 1: PRD Writer → Stage 2: PRD Reviewer
  (revision loop up to max_prd_revisions)
  → Slack notification → Human approves PRD

Phase 2: Implementation (same worktree)
  Stage 3: Implementer → Stage 4: Design QA
  → Stage 5: Test Writer (fix loop up to max_test_fix_attempts)
  → Stage 6: Code Reviewer
  → Slack notification → Human does final review
```

## Execution Steps

Follow these steps exactly:

### Step 0: Setup

1. Parse the feature description from user input
2. Generate a slug (e.g., "add export to CSV" → `export-to-csv`)
3. Set date: `YYYY-MM-DD` (today)
4. Read config from `.claude/skills/feature/config.json`
5. Create a git worktree for isolation:
   - Use the EnterWorktree tool with name set to the feature slug
   - All subsequent work happens in this worktree

### Step 1: PRD Writer

Read the prompt template from `.claude/skills/feature/prompts/prd-writer.md`.

Dispatch a Task subagent (subagent_type: "general-purpose"):
- Replace `{{FEATURE_DESCRIPTION}}` with the user's feature description
- Replace `{{DOCS_PATH}}` with config.docs_path
- Replace `{{DATE}}` with today's date
- Replace `{{SLUG}}` with the feature slug
- Remove `{{REVISION_CONTEXT}}` (first run)

The subagent will explore the codebase and write the PRD file.

### Step 2: PRD Review Loop

Read the prompt template from `.claude/skills/feature/prompts/prd-reviewer.md`.

Set `review_round = 1`.

**Loop:**

1. Dispatch a Task subagent (subagent_type: "general-purpose"):
   - Replace `{{PRD_PATH}}` with the PRD file path from Step 1
   - Replace `{{REVIEW_ROUND}}` with current review_round

2. If reviewer returns APPROVED → proceed to Step 3

3. If reviewer returns REVISE and review_round < max_prd_revisions + 1:
   - Increment review_round
   - Re-dispatch PRD Writer with `{{REVISION_CONTEXT}}` set to the reviewer's feedback
   - Go back to (1)

4. If reviewer returns REVISE and review_round >= max_prd_revisions + 1:
   - Proceed anyway, but note in the final report that PRD had unresolved review comments

### Step 2.5: Slack Notification + Human Approval

1. If `slack_webhook_url` is not empty, send a Slack notification:

```bash
curl -s -X POST "{{slack_webhook_url}}" \
  -H "Content-Type: application/json" \
  -d '{"text":"PRD ready for review: {{FEATURE_NAME}}\nFile: {{PRD_PATH}}\nReview rounds: {{REVIEW_ROUND}}\nStatus: {{APPROVED_OR_FLAGGED}}"}'
```

2. Use AskUserQuestion to pause:
   - Question: "The PRD is ready for your review at `{{PRD_PATH}}`. What would you like to do?"
   - Options: "Approve and continue to implementation", "Reject with feedback" (with description field for notes)

3. If rejected with feedback:
   - Re-dispatch PRD Writer with the feedback as `{{REVISION_CONTEXT}}`
   - Run reviewer again
   - Return to this step

4. If approved → proceed to Phase 2

### Step 3: Implementer

Read the prompt template from `.claude/skills/feature/prompts/implementer.md`.

Dispatch a Task subagent (subagent_type: "general-purpose"):
- Replace `{{PRD_PATH}}` with the PRD file path
- Replace `{{IMPLEMENTATION_CONTEXT}}` with:
  - The PRD reviewer's final notes (if any)
  - The human's approval notes (if any)
  - The worktree path

Save the implementer's report for subsequent stages.

### Step 4: Design QA

Read the prompt template from `.claude/skills/feature/prompts/design-qa.md`.

First, check if the PRD has UI changes. If there are no `.tsx` files in the implementer's report, skip this stage and set design_qa_report to "SKIPPED — no UI changes".

If UI changes exist, dispatch a Task subagent (subagent_type: "general-purpose"):
- Replace `{{PRD_PATH}}` with the PRD file path
- Replace `{{IMPLEMENTER_REPORT}}` with the implementer's report

If issues found:
- Re-dispatch the implementer with the design QA issues as context
- Re-run design QA once more
- If still issues, note them for the final report but proceed

### Step 5: Test Writer + Fix Loop

Read the prompt template from `.claude/skills/feature/prompts/test-writer.md`.

Set `fix_attempt = 0`.

**Loop:**

1. Dispatch a Task subagent (subagent_type: "general-purpose"):
   - Replace `{{PRD_PATH}}` with the PRD file path
   - Replace `{{IMPLEMENTER_REPORT}}` with the implementer's report

2. If all tests pass → proceed to Step 6

3. If tests fail and fix_attempt < max_test_fix_attempts:
   - Increment fix_attempt
   - Re-dispatch implementer with failing test details as context
   - Go back to (1)

4. If tests fail and fix_attempt >= max_test_fix_attempts:
   - Proceed to Step 6, but flag in final report

### Step 6: Code Reviewer

Read the prompt template from `.claude/skills/feature/prompts/code-reviewer.md`.

Dispatch a Task subagent (subagent_type: "general-purpose"):
- Replace `{{PRD_PATH}}` with the PRD file path
- Replace `{{IMPLEMENTER_REPORT}}` with the implementer's report
- Replace `{{DESIGN_QA_REPORT}}` with the design QA result
- Replace `{{TEST_REPORT}}` with the test writer's report
- Replace `{{DOCS_PATH}}`, `{{DATE}}`, `{{SLUG}}` for the final report file path
- Replace `{{BASE_BRANCH}}` with `main`

### Step 6.5: Final Slack Notification + Human Review

1. If `slack_webhook_url` is not empty, send Slack notification:

```bash
curl -s -X POST "{{slack_webhook_url}}" \
  -H "Content-Type: application/json" \
  -d '{"text":"Feature ready for review: {{FEATURE_NAME}}\nReport: {{FINAL_REPORT_PATH}}\nRecommendation: {{RECOMMENDATION}}\nTests: {{TEST_SUMMARY}}"}'
```

2. Present the final report summary to the user
3. Use AskUserQuestion:
   - Question: "Feature implementation is complete. The final report is at `{{FINAL_REPORT_PATH}}`. What would you like to do?"
   - Options: "Merge to main", "Create a PR", "I'll review the worktree manually", "Discard"

4. Based on choice:
   - **Merge**: `git checkout main && git merge {{worktree_branch}}`
   - **PR**: Use `gh pr create` with the final report as the PR body
   - **Manual review**: Print the worktree path and branch name
   - **Discard**: Clean up the worktree

## Error Handling

- If any stage's subagent fails (returns an error or unclear result), pause and present the issue to the user via AskUserQuestion
- If Slack webhook fails, log the error but continue (notifications are non-blocking)
- If worktree creation fails, fall back to working on a new branch on the current repo

## Artifacts

For feature slug `export-to-csv`:
```
Docs/plans/
├── 2026-02-24-export-to-csv-prd.md
├── 2026-02-24-export-to-csv-review.md (if reviewer had notes)
└── 2026-02-24-export-to-csv-final-report.md
```
```

**Step 2: Commit**

```bash
git add .claude/skills/feature/SKILL.md
git commit -m "feat: add master orchestrator skill for feature pipeline"
```

---

### Task 9: End-to-End Smoke Test

**Files:**
- No new files — this is a verification task

**Step 1: Verify skill is discoverable**

Start a new Claude Code conversation in the project directory. Type `/feature` and verify it appears in the skill list. If it doesn't, check that:
- `.claude/skills/feature/SKILL.md` exists
- The frontmatter has `name: feature`
- The `description` field is present and under 1024 chars

**Step 2: Run a minimal test**

Invoke the skill with a small, low-risk feature:

```
/feature "add a utility function that formats district enrollment numbers with commas and K/M suffixes"
```

Verify:
1. The manager creates a worktree
2. PRD writer runs and produces a PRD file
3. PRD reviewer runs and reviews it
4. Slack notification is sent (if webhook configured) or skipped gracefully
5. Human approval prompt appears
6. After approval, implementer runs
7. Design QA runs (and correctly skips since this is a utility function)
8. Test writer writes and runs tests
9. Code reviewer produces a final report
10. Final approval prompt appears with merge options

**Step 3: Verify artifacts**

Check that these files were created in the worktree:
- `Docs/plans/YYYY-MM-DD-*-prd.md`
- `Docs/plans/YYYY-MM-DD-*-final-report.md`
- Implementation file(s) in `src/`
- Test file(s) in `__tests__/`

**Step 4: Document any issues**

If any stage fails or behaves unexpectedly, note the issue and fix the relevant prompt or SKILL.md. Common issues to watch for:
- Template variables not replaced correctly
- Subagent not finding the right files
- Review loops not terminating
- Slack curl command failing silently

---

### Task 10: Configure Slack Webhook

**Files:**
- Modify: `.claude/skills/feature/config.json`

**Step 1: Get the webhook URL**

The user needs to create a Slack incoming webhook:
1. Go to https://api.slack.com/apps
2. Create a new app (or use existing)
3. Add "Incoming Webhooks" feature
4. Create a webhook for the desired channel
5. Copy the webhook URL

**Step 2: Update config**

Replace the empty `slack_webhook_url` in `.claude/skills/feature/config.json` with the actual URL.

**Step 3: Test the webhook**

```bash
curl -s -X POST "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
  -H "Content-Type: application/json" \
  -d '{"text":"Feature pipeline test notification"}'
```

Verify the message appears in Slack.

**Step 4: Commit**

```bash
git add .claude/skills/feature/config.json
git commit -m "chore: configure Slack webhook for feature pipeline"
```

---
