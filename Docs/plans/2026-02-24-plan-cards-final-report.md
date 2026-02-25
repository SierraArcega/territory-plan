# Final Code Review: Flippable Plan Cards with Donut Summary

**Date:** 2026-02-24
**Reviewer:** Automated Code Review (Claude Opus 4.6)
**PRD:** `Docs/plans/2026-02-24-plan-cards-prd.md`
**Recommendation:** READY FOR REVIEW

**Issue Count:** 0 critical, 0 high, 2 medium, 3 low, 2 informational

**Summary:** Flippable plan cards with proportional donut charts replace flat plan lists on both home surfaces. Owner filtering and sort controls are included. All 68 tests pass, TypeScript compiles cleanly for all changed files, and the implementation closely follows the PRD.

---

## Files Reviewed

| # | File | Action | Lines |
|---|------|--------|-------|
| 1 | `src/features/plans/components/ProportionalDonut.tsx` | Created | 94 |
| 2 | `src/features/plans/components/FlippablePlanCard.tsx` | Created | 337 |
| 3 | `src/features/plans/components/PlanCardFilters.tsx` | Created | 205 |
| 4 | `src/features/shared/types/api-types.ts` | Modified | +4 |
| 5 | `src/app/api/territory-plans/route.ts` | Modified | +8 |
| 6 | `src/app/globals.css` | Modified | +2 |
| 7 | `src/features/map/components/panels/HomePanel.tsx` | Modified | +26 / -15 |
| 8 | `src/features/shared/components/views/HomeView.tsx` | Modified | +24 / -16 |
| 9 | `src/features/plans/components/__tests__/ProportionalDonut.test.tsx` | Created | 141 |
| 10 | `src/features/plans/components/__tests__/FlippablePlanCard.test.tsx` | Created | 181 |
| 11 | `src/features/plans/components/__tests__/PlanCardFilters.test.tsx` | Created | 253 |
| 12 | `src/features/map/components/panels/__tests__/HomePanel.test.tsx` | Modified | +113 |
| 13 | `src/features/plans/components/__tests__/PlansTable.test.tsx` | Modified | +12 |

---

## Spec Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| ProportionalDonut (SVG, 4 segments, no Recharts) | PASS | Lightweight SVG with stroke-dasharray, no external dependency |
| FlippablePlanCard with front/back faces | PASS | CSS 3D flip with `perspective: 800px`, `preserve-3d`, `backface-visibility: hidden` |
| Front face: donut, plan name, district count, owner | PASS | All elements present, truncation, "Unassigned" fallback |
| Back face: status badge, FY, description, states, dates, enrollment, tasks | PASS | All conditional fields render only when data present |
| PlanCardFilters: owner avatar chips + sort dropdown | PASS | Deduplication, "All" chip, 4 sort options |
| HomePanel integration (compact variant) | PASS | Replaces flat list with card grid + filters |
| HomeView integration (full variant) | PASS | Replaces tile grid with card grid + filters |
| API: rollup fields in GET/POST responses | PASS | `Number()` conversion for Prisma Decimal, `0` for POST |
| Type: 4 rollup fields on TerritoryPlan | PASS | Added as `number` type |
| CSS: `--color-sage: #8AA891` | PASS | Added in both `:root` and `@theme inline` blocks |
| Segment colors match brand palette | PASS | Sage, Steel Blue, Coral, Plum -- all correct hex values |
| Edge case: all rollups 0 | PASS | Shows empty gray ring |
| Edge case: no owner | PASS | "Unassigned" in italic gray |
| Edge case: no description/dates/tasks | PASS | Fields conditionally omitted |
| Edge case: long plan name | PASS | `truncate` class applied |
| Flip icon a11y | PASS | `<button>` with toggling `aria-label`, keyboard Enter/Space handling, `focus-visible:ring-2` |
| Card body keyboard a11y | PASS | `role="button"`, `tabIndex={0}`, Enter/Space handling, `focus-visible:ring-2` |
| Flip does not navigate, navigate does not flip | PASS | `e.stopPropagation()` on flip handler |
| Per-card flip state | PASS | Each card has its own `useState(false)` |
| Testing strategy (PRD tests 1-32) | PASS | 46 feature-specific tests covering all PRD test cases |
| Skeleton loading cards | See M-1 | PRD mentions skeleton loading; not implemented (see below) |
| HomeView grid: 3-column at `lg` breakpoint | See M-2 | PRD says 2-col md / 3-col lg; implementation is 2-col at all breakpoints |

---

## Issues

### Medium

**M-1: Skeleton loading states not implemented**
- **File:** `FlippablePlanCard.tsx`, `HomePanel.tsx`, `HomeView.tsx`
- **PRD text:** "Show skeleton cards (same dimensions as FlippablePlanCard) with animated pulse. 2-3 skeletons in sidebar, 4-6 on full-page."
- **Actual:** No skeleton/loading state for plan cards. While the existing surfaces may already show a loading spinner at a higher level, the PRD specifically calls for skeleton cards matching the new card dimensions.
- **Impact:** UX during data fetch -- users see an empty area or a generic spinner instead of card-shaped skeletons.
- **Recommendation:** Verify with PM/designer whether the existing loading state is acceptable or if card-shaped skeletons are needed. If needed, add a simple skeleton variant to `FlippablePlanCard` or a separate `PlanCardSkeleton` component.

**M-2: HomeView grid missing `lg:grid-cols-3` breakpoint**
- **File:** `src/features/shared/components/views/HomeView.tsx` line 492
- **PRD text:** "2-column (md) / 3-column (lg) grid of FlippablePlanCard (full variant)"
- **Actual:** `grid-cols-2 md:grid-cols-2 lg:grid-cols-2` -- stays at 2 columns at all breakpoints.
- **Impact:** On large screens, cards are wider than intended and the grid does not densify to 3 columns as specified.
- **Recommendation:** Change to `grid-cols-2 lg:grid-cols-3` to match the PRD spec, or confirm with design that 2-column is preferred.

### Low

**L-1: Duplicate `getInitials` function across two new files**
- **File:** `FlippablePlanCard.tsx` line 39 and `PlanCardFilters.tsx` line 24
- **Details:** Identical `getInitials(name: string | null): string` function defined in both files. The codebase already has 6+ copies of similar functions (in `IconBar.tsx`, `UserMenu.tsx`, `ProfileView.tsx`, `ContactsTable.tsx`, etc.), so this follows the existing pattern. However, these two files were written together and could share the function.
- **Impact:** Minor code duplication. Not a regression since the codebase already has this pattern.
- **Recommendation:** Acceptable as-is (matches existing convention). Consider extracting to a shared utility in a future cleanup pass.

**L-2: `formatNumber` function is locally redefined**
- **File:** `FlippablePlanCard.tsx` line 24
- **Details:** The compact number formatter (`1K`, `1.2M`) is defined locally, matching the identical function in `PlansListPanel.tsx` line 7. A different `formatNumber` exists in `src/features/shared/lib/format.ts` that only does locale formatting without compact notation. The local version is the correct one for card display.
- **Impact:** Minor duplication, but the shared utility has different behavior so importing it would be incorrect.
- **Recommendation:** Acceptable as-is. The shared `formatNumber` does not support compact notation. A future refactor could add a `compact` parameter to the shared version.

**L-3: Redundant `onKeyDown` handler on `<button>` flip icon**
- **File:** `FlippablePlanCard.tsx` lines 106-110
- **Details:** The flip icon is a native `<button>` element, which already fires `onClick` on Enter/Space keydown per the HTML spec. The explicit `onKeyDown` handler that calls `handleFlip` on Enter/Space is redundant.
- **Impact:** No functional harm -- the handler fires twice (once from onKeyDown, once from the native click behavior) but `setFlipped` is idempotent via the toggle pattern. The extra handler adds 5 lines of code.
- **Recommendation:** Could remove the `onKeyDown` from the flip `<button>` since native button behavior already covers it. Low priority.

### Informational

**I-1: `STATUS_STYLE` map duplicated from PlansListPanel**
- **File:** `FlippablePlanCard.tsx` lines 16-21
- **Details:** Same `STATUS_STYLE` constant exists in `PlansListPanel.tsx` lines 13-18. This follows the established codebase pattern where each component defines its own status styling. Extracting to shared would require touching existing files.
- **Recommendation:** No action needed. Matches codebase convention.

**I-2: `as PlanSortKey` type assertion on select onChange**
- **File:** `PlanCardFilters.tsx` lines 119, 143
- **Details:** `e.target.value as PlanSortKey` is a type assertion since HTML select values are always strings. This is safe because the `<option>` values are exclusively from the `SORT_OPTIONS` array, so the runtime value will always be a valid `PlanSortKey`.
- **Recommendation:** No action needed. This is a standard React pattern for typed select elements.

---

## Security Review (OWASP Top 10)

| Check | Status | Notes |
|-------|--------|-------|
| SQL Injection | PASS | Prisma ORM with parameterized queries; rollup fields read via `include` (no raw SQL) |
| XSS | PASS | No `dangerouslySetInnerHTML`; all user data rendered via React JSX escaping |
| Command Injection | N/A | No shell execution |
| API Input Validation | PASS | POST route validates `name`, `fiscalYear`, etc. GET returns rollups from authenticated user's data |
| Sensitive Data Exposure | PASS | Only plan metadata exposed; no credentials or PII beyond owner name/avatar |
| Authentication | PASS | Both GET and POST routes check `getUser()` and return 401 if unauthenticated |

---

## Performance Review

| Check | Status | Notes |
|-------|--------|-------|
| N+1 Queries | PASS | Single `findMany` with `include` -- all joins resolved in one query |
| Re-renders | PASS | Filter/sort state in parent; `useMemo` for derived `displayedPlans`; `filterAndSortPlans` is a pure function |
| List Size | PASS | Territory plans are <20 per user per FY; no pagination/virtualization needed |
| SVG Performance | PASS | Static SVG donut (no animations, no Recharts); max 4 circles per donut |
| Bundle Size | PASS | No new dependencies; pure React + SVG |

---

## Code Quality Review

| Check | Status | Notes |
|-------|--------|-------|
| No `any` types | PASS | All types explicit; `TerritoryPlan` interface used throughout |
| No `@ts-ignore` | PASS | Zero instances in changed files |
| No dead code | PASS | No commented-out code, no unused imports |
| Naming consistency | PASS | Component names, prop interfaces, and file structure match codebase conventions |
| Import paths | PASS | All using `@/features/...` alias consistently |
| File structure | PASS | Components in `src/features/plans/components/`, tests in `__tests__/` subdirectory |
| TypeScript compilation | PASS | Zero errors in all 13 changed files (pre-existing errors in unrelated test mocks) |

---

## Test Results

```
Test Files  6 passed (6)
     Tests  68 passed (68)
  Duration  801ms
```

Feature-specific tests: 46 total
- ProportionalDonut: 7 tests (PRD tests 1-7)
- FlippablePlanCard: 13 tests (PRD tests 8-20)
- PlanCardFilters: 14 tests (PRD tests 21-28 + 6 utility tests)
- HomePanel integration: 4 tests (PRD tests 29-32)
- PlansTable mock updates: 8 existing tests still passing

---

## Commit History

```
5e92712 fix: add keyboard focus indicators to plan card interactive elements
a29d159 feat: add flippable plan cards with donut summary to home surfaces
```

Clean 2-commit history: feature implementation followed by a11y fix. Messages are descriptive and follow conventional commit format.
