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
