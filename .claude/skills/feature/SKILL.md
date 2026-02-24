---
name: feature
description: Use when building a new feature end-to-end — orchestrates PRD creation with human input, codebase-aware review, implementation, design QA, testing, and code review with Slack notifications and human approval gates
---

# Feature Pipeline

Autonomously build features through a 6-stage pipeline with two human checkpoints. Takes a feature description, produces a reviewed PRD, implemented code, tested and design-QA'd, with a final code review report.

## When to Use

- User says `/feature "description"` or asks to build a new feature end-to-end
- User wants autonomous PRD + implementation + testing + review pipeline
- NOT for: quick bug fixes, single-file changes, or exploration tasks

## Configuration

Read `.claude/skills/feature/config.json` for:
- `slack_channel` — Slack channel ID for notifications (skip Slack if empty)
- `max_prd_revisions` — Max agent-driven PRD revision cycles (default: 2)
- `max_test_fix_attempts` — Max test fix attempts (default: 3)
- `docs_path` — Where to save artifacts (default: `Docs/plans`)

**Slack MCP server** (`slack` in .mcp.json) provides:
- `slack_send_approval` — post approval request with Approve/Reject buttons
- `slack_check_approval` — poll for button click result
- `slack_wait_for_approval` — block until resolved (up to 5 min)
- `slack_send_message` — send a plain message
- `slack_list_channels` — find channel IDs

## Pipeline Overview

```
Phase 1: PRD
  Step 0: Setup (parse input, create worktree)
  Step 1: PRD Writer — explores codebase, asks human questions 1-by-1, writes first draft
  Step 2: Agent Review Loop — 2 autonomous rounds (reviewer + writer revision)
  Step 3: Slack notification + human approves final PRD

Phase 2: Implementation
  Step 4: Implementer — writes code per approved PRD
  Step 5: Design QA — checks UI against Fullmind brand (skip if no UI)
  Step 6: Test Writer — writes and runs tests (fix loop up to 3x)
  Step 7: Code Reviewer — final review, writes report
  Step 8: Slack notification + human does final review
```

## Execution Steps

Follow these steps exactly. Do not skip or reorder.

### Step 0: Setup

1. Parse the feature description from user input
2. Generate a slug: strip filler words, lowercase, hyphenate (e.g., "add export to CSV" -> `export-to-csv`)
3. Set `DATE` to today: `YYYY-MM-DD`
4. Read config from `.claude/skills/feature/config.json`
5. Create a git worktree for isolation:
   - Use the EnterWorktree tool with name set to the feature slug
   - All subsequent work happens in this worktree

### Step 1: PRD Writer (Human-in-the-Loop)

Read the prompt template from `.claude/skills/feature/prompts/prd-writer.md`.

Dispatch a Task subagent (subagent_type: "general-purpose"):
- Replace `{{FEATURE_DESCRIPTION}}` with the user's feature description
- Replace `{{DOCS_PATH}}` with config.docs_path
- Replace `{{DATE}}` with today's date
- Replace `{{SLUG}}` with the feature slug
- Remove `{{REVISION_CONTEXT}}` section (first run)

**Important:** This subagent will use AskUserQuestion to ask the human clarifying questions one at a time. The human's answers shape the first draft. This is the collaborative part — expect 3-6 questions before the PRD is written.

Save the subagent's report (PRD file path and notes) for subsequent steps.

### Step 2: Agent Review Loop (Autonomous, 2 Rounds)

Read the prompt template from `.claude/skills/feature/prompts/prd-reviewer.md`.

Run exactly 2 review-revise cycles:

**Round 1:**
1. Dispatch reviewer subagent (subagent_type: "general-purpose"):
   - Replace `{{PRD_PATH}}` with the PRD file path from Step 1
   - Replace `{{REVIEW_ROUND}}` with `1`
2. If APPROVED -> skip to Step 3
3. If REVISE -> dispatch PRD writer subagent with `{{REVISION_CONTEXT}}` set to reviewer feedback
   - The revision writer does NOT ask human questions again — it silently revises based on agent feedback

**Round 2:**
1. Dispatch reviewer subagent with `{{REVIEW_ROUND}}` set to `2`
2. If APPROVED -> proceed to Step 3
3. If REVISE -> dispatch PRD writer for one final revision
   - After this revision, proceed to Step 3 regardless (flag remaining issues)

### Step 3: Slack Approval + Human PRD Approval

1. If `slack_channel` is not empty, read the PRD and compose a rich Slack approval:
   - Read the PRD file and extract all key sections
   - Call `slack_send_approval` with:
     - `channel`: config.slack_channel
     - `title`: "PRD Ready for Review: [Feature Name]"
     - `summary`: Plain-text fallback: "[Feature name] — [1-sentence summary]. [N] files affected, [N] agent review rounds."
     - `sections`: Array of structured sections:
       ```json
       [
         {
           "heading": "Problem",
           "text": "[Full Problem Statement from PRD — first 2-3 sentences]"
         },
         {
           "heading": "Proposed Solution",
           "text": "[Full Proposed Solution from PRD — 2-3 sentences describing the approach]"
         },
         {
           "heading": "Technical Design",
           "text": "[How it works in 2-3 sentences]\n\n*New files:*\n• [list each]\n\n*Modified files:*\n• [list each with brief reason]"
         },
         {
           "heading": "Scope & Impact",
           "fields": ["*Data model:* [yes/no + detail]", "*API changes:* [yes/no + detail]", "*UI changes:* [yes/no + detail]", "*Dependencies:* [any new deps or 'None']"]
         },
         {
           "heading": "Edge Cases & Risks",
           "text": "• [Each edge case from PRD as a bullet with how it's handled]"
         },
         {
           "heading": "Testing Strategy",
           "text": "• *Unit:* [what]\n• *Integration:* [what]\n• *Component:* [what]\n• ~[N] test cases estimated"
         },
         {
           "heading": "Assumptions & Open Questions",
           "text": ":warning: [Each assumption or open question as a bullet]"
         },
         {
           "heading": "Review Status",
           "fields": ["*Agent reviews:* [N] rounds", "*Outcome:* [Approved/Revised]", "*PRD:* `[PRD_PATH]`", "*Branch:* `[branch name]`"]
         }
       ]
       ```
   - Save the returned `approvalId`

2. Use AskUserQuestion to also pause in the terminal:
   - Question: "The PRD is ready for your review at `[PRD_PATH]`. It went through [N] agent review rounds. You can also approve/reject from Slack. What would you like to do?"
   - Options:
     - "Approve and continue to implementation"
     - "Reject with feedback" (user provides notes)
     - "Discard this feature"

   **Dual-channel approval:** The user can approve from either Slack (button click) or the terminal (AskUserQuestion). If Slack approval comes first, check it with `slack_check_approval` before presenting the terminal prompt.

3. If rejected with feedback:
   - Re-dispatch PRD Writer with the feedback as `{{REVISION_CONTEXT}}`
   - Run one more reviewer pass
   - Return to this step (re-present for approval)

4. If approved -> proceed to Phase 2

5. If discarded -> clean up worktree, stop pipeline

### Step 4: Implementer

Read the prompt template from `.claude/skills/feature/prompts/implementer.md`.

Dispatch a Task subagent (subagent_type: "general-purpose"):
- Replace `{{PRD_PATH}}` with the PRD file path
- Replace `{{IMPLEMENTATION_CONTEXT}}` with:
  - The PRD reviewer's final notes (if any)
  - The human's approval notes (if any)
  - The worktree directory path

Save the implementer's report for subsequent stages.

### Step 5: Design QA

Read the prompt template from `.claude/skills/feature/prompts/design-qa.md`.

First, check if the implementer's report mentions any `.tsx` files. If no UI files were created or modified, skip this stage and set `design_qa_report` to "SKIPPED — no UI changes".

If UI changes exist, dispatch a Task subagent (subagent_type: "general-purpose"):
- Replace `{{PRD_PATH}}` with the PRD file path
- Replace `{{IMPLEMENTER_REPORT}}` with the implementer's report

If issues found:
- Re-dispatch the implementer with the design QA issues as `{{IMPLEMENTATION_CONTEXT}}`
- Re-run design QA once more
- If still issues after second pass, note them for the final report but proceed

### Step 6: Test Writer + Fix Loop

Read the prompt template from `.claude/skills/feature/prompts/test-writer.md`.

Set `fix_attempt = 0`.

**Loop:**

1. Dispatch test writer subagent (subagent_type: "general-purpose"):
   - Replace `{{PRD_PATH}}` with the PRD file path
   - Replace `{{IMPLEMENTER_REPORT}}` with the implementer's report

2. If all tests pass -> proceed to Step 7

3. If tests fail and `fix_attempt < max_test_fix_attempts`:
   - Increment fix_attempt
   - Re-dispatch implementer with failing test details as `{{IMPLEMENTATION_CONTEXT}}`
   - Go back to (1) — re-run test writer

4. If tests fail and `fix_attempt >= max_test_fix_attempts`:
   - Proceed to Step 7, but flag failures in the final report

### Step 7: Code Reviewer

Read the prompt template from `.claude/skills/feature/prompts/code-reviewer.md`.

Dispatch a Task subagent (subagent_type: "general-purpose"):
- Replace `{{PRD_PATH}}` with the PRD file path
- Replace `{{IMPLEMENTER_REPORT}}` with the implementer's report
- Replace `{{DESIGN_QA_REPORT}}` with the design QA result (or "SKIPPED")
- Replace `{{TEST_REPORT}}` with the test writer's report
- Replace `{{DOCS_PATH}}` with config.docs_path
- Replace `{{DATE}}` with today's date
- Replace `{{SLUG}}` with the feature slug
- Replace `{{BASE_BRANCH}}` with `main`

The reviewer writes the final report to `[docs_path]/[date]-[slug]-final-report.md`.

### Step 8: Final Slack Notification + Human Review

1. If `slack_channel` is not empty, read the final report and PRD to compose a rich Slack approval:
   - Call `slack_send_approval` with:
     - `channel`: config.slack_channel
     - `title`: "Feature Ready for Review: [Feature Name]"
     - `summary`: Plain-text fallback: "[Feature name] implementation complete. [N] tests passing. Code review: [READY/NEEDS ATTENTION]."
     - `sections`: Array of structured sections:
       ```json
       [
         {
           "heading": "What Was Built",
           "text": "[2-3 sentence summary of what the feature does, from the PRD's Proposed Solution]"
         },
         {
           "heading": "Implementation Summary",
           "text": "*New files:*\n• [list each new file with brief purpose]\n\n*Modified files:*\n• [list each modified file with what changed]"
         },
         {
           "heading": "Quality",
           "fields": ["*Tests:* [pass] passing, [fail] failing", "*Design QA:* [PASSED / SKIPPED / issues]", "*Code review:* [READY / NEEDS ATTENTION]", "*Fix attempts:* [N] of [max]"]
         },
         {
           "heading": "Code Review Notes",
           "text": "[Key findings from the code reviewer — strengths, concerns, suggestions. 3-5 bullets]"
         },
         {
           "heading": "Outstanding Issues",
           "text": "[Any flagged issues, test failures, or design QA concerns. Use :warning: for each. If none: ':white_check_mark: No outstanding issues']"
         },
         {
           "heading": "Review Details",
           "fields": ["*Report:* `[REPORT_PATH]`", "*Branch:* `[branch name]`", "*Dev server:* http://localhost:3005", "*PRD:* `[PRD_PATH]`"]
         }
       ]
       ```

2. **Start a local dev server for review:**
   - Symlink the `.env` file into the worktree (it's gitignored and won't exist there):
     ```bash
     ln -sf /Users/sierrastorm/thespot/territory-plan/.env <worktree-path>/.env
     ```
   - Kill any existing process on port 3005, then start the dev server:
     ```bash
     lsof -ti :3005 | xargs kill -9 2>/dev/null
     npx next dev -p 3005
     ```
   - Wait for the "Ready" message before presenting the review prompt
   - Tell the user the app is running at `http://localhost:3005`

3. Present the final report summary to the user (read and display key sections)

4. Use AskUserQuestion:
   - Question: "Feature implementation is complete and running at http://localhost:3005. The final report is at `[path]`. What would you like to do?"
   - Options:
     - "Merge to main"
     - "Create a PR"
     - "I'll review the worktree manually"
     - "Discard"

4. Based on choice:
   - **Merge**: merge the worktree branch into main
   - **PR**: use `gh pr create` with the final report summary as the PR body
   - **Manual review**: print the worktree path and branch name
   - **Discard**: clean up the worktree

## Error Handling

- If any subagent fails or returns unclear results -> pause and present the issue to the user via AskUserQuestion with options to retry, skip the stage, or abort
- If Slack MCP tools fail (server not running, no tokens) -> skip Slack notifications and rely on terminal-only approval. Slack is non-blocking — the pipeline works without it
- If worktree creation fails -> fall back to creating a new branch on the current repo

## Artifacts

For a feature with slug `export-to-csv`:

```
Docs/plans/
  2026-02-24-export-to-csv-prd.md           # The approved PRD
  2026-02-24-export-to-csv-final-report.md   # Code review + summary

src/features/...                              # Implementation code
src/features/.../__tests__/...                # Test files
prisma/migrations/...                         # Schema changes (if needed)
```

Plus a git branch in the worktree with clean, reviewable commits.
