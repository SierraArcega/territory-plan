# Goals Donut Chart -- Final Code Review Report

**Date:** 2026-02-24
**Reviewer:** Code Review Subagent (Claude)
**PRD:** `Docs/plans/2026-02-24-goals-donut-chart-prd.md`

---

## Recommendation: READY FOR REVIEW

**One-line summary:** Replaces HomePanel progress bars with a 2x2 donut chart grid and extracts the existing HomeView inline DonutChart to a shared component -- clean implementation with strong test coverage and good accessibility.

---

## Issue Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 3 |
| Informational | 3 |

---

## Spec Compliance

All PRD requirements are implemented:

- [x] Shared `DonutChart` component extracted to `src/features/goals/components/DonutChart.tsx`
- [x] `DonutMetricPopover` created with current/target breakdown, click-outside, and Escape dismiss
- [x] HomePanel progress bars replaced with 2x2 `grid grid-cols-2 gap-3`
- [x] Each cell uses `size={48}`, `strokeWidth={5}`, `fontSize="text-[10px]"`
- [x] Labels `text-[10px] font-medium text-gray-500 mt-1` beneath each donut
- [x] Colors match spec: Coral (#F37167), Steel Blue (#6EA3BE), Plum (#403770 x2)
- [x] HomeView inline DonutChart replaced with shared import, no visual change
- [x] Empty state unchanged ("No goals set for FY{XX}")
- [x] Target null/0 shows 0% empty ring
- [x] Percentage >100% capped at 100 for ring fill and label
- [x] Popover shows actual current/target values
- [x] Popover closes on FY tab change (useEffect on `selectedFY`)
- [x] Popover closes on click-outside and Escape

**Extra items beyond PRD scope (YAGNI concern):** See Medium #1 below.

---

## Issues

### Medium

**M1. Out-of-scope changes to MapSummaryBar.tsx**

`src/features/map/components/MapSummaryBar.tsx` has ~65 lines of changes that are not mentioned in the PRD. These changes include:
- Removing the `compactLabel` prop and responsive `xl:` breakpoint classes from the `Stat` component
- Changing colors from Plum-based (`#403770/50`, `#403770/10`) to generic gray (`text-gray-400`, `bg-gray-200`)
- Removing responsive gap/padding modifiers (`gap-3 xl:gap-5` simplified to `gap-5`)
- Changing the summary bar background from `bg-[#FFFCFA]/85` to `bg-white/85`

These are unrelated to the donut chart feature. They should be split into a separate commit or PR to keep this change set focused. **The human reviewer should confirm whether these MapSummaryBar changes are intentional and desired.**

### Low

**L1. Popover flip logic not implemented**

The PRD specifies: "Popover measures available space and flips from above-donut to below-donut if it would overflow the top." The popover is hardcoded to always appear above (`bottom-full`). This was flagged in the Design QA as a low-priority follow-up item, which is acceptable -- noting it here for completeness.

**L2. Deleted documentation files not in PRD scope**

Four Docs files were deleted that are unrelated to this feature:
- `Docs/plans/2026-02-24-multi-agent-feature-pipeline-design.md`
- `Docs/plans/2026-02-24-multi-agent-feature-pipeline-plan.md`
- `Docs/plans/2026-02-24-summary-bar-responsive-refresh-design.md`
- `Docs/plans/2026-02-24-summary-bar-responsive-refresh-plan.md`

Like M1, these should not be in this feature's diff. The human reviewer should verify whether these deletions are intentional.

**L3. Minor behavioral difference in shared DonutChart vs original**

The original HomeView inline `DonutChart` passed raw `percent` to `setAnimatedPercent` in the useEffect (`setAnimatedPercent(percent)`), while the new shared component passes `cappedPercent` (`setAnimatedPercent(cappedPercent)`). This is actually a **bug fix** -- the original could theoretically animate to >100% if an uncapped value were passed. However, in practice both callers already cap the value with `Math.min(..., 100)` before passing it in, so this is a no-op difference. Noting for awareness only.

### Informational

**I1. DonutChart wrapper div accessibility pattern is good**

The implementation correctly uses `role="button"`, `tabIndex={0}`, `aria-label`, and keyboard handlers (Enter/Space) on the wrapper `div` when `onClick` is provided. However, in HomePanel, the DonutChart is wrapped in a semantic `<button>` element and `onClick` is NOT passed to DonutChart itself -- the button handles the click instead. This is the correct pattern. The DonutChart renders as a purely visual element inside the button. No issue here; this is well-designed.

**I2. Two separate useEffect hooks in DonutMetricPopover for click-outside and Escape**

These could be combined into a single effect, but separating them is clearer and has negligible performance impact. No change needed.

**I3. Test count exceeds PRD estimate**

The PRD estimated ~15 tests. The implementation delivers 35 tests across 5 files (18 DonutChart + 8 DonutMetricPopover + 8 HomePanel + 1 HomeView). The extra coverage (accessibility, edge cases, popover content formatting) is valuable and justified by the Design QA findings.

---

## Code Quality

- [x] **TypeScript types are correct** -- no `any`, no `@ts-ignore`, no `@ts-expect-error`. All new files compile cleanly (pre-existing TS errors in unrelated API test files only).
- [x] **No `dangerouslySetInnerHTML`** or XSS vectors.
- [x] **No dead code or commented-out code** in the new files.
- [x] **Naming is clear** -- `DonutChart`, `DonutMetricPopover`, `goalMetrics`, `openPopoverIndex` all follow existing codebase conventions.
- [x] **No hardcoded magic values** -- colors match brand tokens documented in PRD, sizes match spec. The `#f0f0f0` track color and `#403770` Plum color are consistent with the rest of the codebase.
- [x] **Error handling is appropriate** -- null target handled with dash display, 0 target shows empty ring, no runtime crash paths.
- [x] **Component complexity is reasonable** -- DonutChart is 83 lines, DonutMetricPopover is 73 lines, both single-responsibility.

## Security

- [x] No SQL injection risk (no database queries in this change)
- [x] No XSS risk (React escaping used throughout, no raw HTML)
- [x] No command injection
- [x] No sensitive data exposure
- [x] No new API routes or input validation concerns

## Performance

- [x] No N+1 queries (purely client-side UI change)
- [x] No unnecessary re-renders -- `goalMetrics` uses `useMemo`, popover state is local
- [x] Animation uses CSS `transition` with a single `setTimeout` trigger, no animation loops
- [x] SVG rendering is lightweight (2 circles per donut, 4 donuts total)

## Consistency

- [x] File structure follows existing pattern (`src/features/{domain}/components/`)
- [x] Test files follow existing pattern (`__tests__/` sibling directory)
- [x] Import paths use `@/` aliases consistently
- [x] Component export style (default export) matches codebase convention
- [x] Tailwind class usage matches existing patterns in HomePanel and HomeView

## Test Results

```
Test Files  26 passed (26)
     Tests  599 passed (599)
  Duration  1.35s
```

All 599 tests pass. Zero failures, zero skipped.

---

## Files Reviewed

| File | Status | Lines |
|------|--------|-------|
| `src/features/goals/components/DonutChart.tsx` | New | 83 |
| `src/features/goals/components/DonutMetricPopover.tsx` | New | 73 |
| `src/features/goals/components/__tests__/DonutChart.test.tsx` | New | 190 |
| `src/features/goals/components/__tests__/DonutMetricPopover.test.tsx` | New | 75 |
| `src/features/map/components/panels/HomePanel.tsx` | Modified | ~77 lines changed |
| `src/features/map/components/panels/__tests__/HomePanel.test.tsx` | New | 195 |
| `src/features/shared/components/views/HomeView.tsx` | Modified | ~50 lines removed |
| `src/features/shared/components/views/__tests__/HomeView.test.tsx` | New | 98 |
| `src/features/map/components/MapSummaryBar.tsx` | Modified (out of scope) | ~65 lines changed |
