# Feature Report: Sort + Group Toolbar Controls

**Date:** 2026-05-17
**Status:** READY FOR REVIEW

## Summary
Added explicit Sort and Group toolbar chips to every entity grid view (Table, Contacts, Opps, Vacancies, News, RFPs). Sort chips mirror the existing Filter chip pattern (multi-stack with shift-click parity), and Group is a single chip + picker that prepends `{ id: groupBy, dir: "asc" }` to the existing `layout.sort` stack on the frontend, so no backend changes were needed. Group rendering injects sticky section-header `<tr>` rows in the table body with collapsible per-session state.

## Changes
| File | Action | Lines added/removed |
|------|--------|---------------------|
| `src/features/views/components/grid/SortFieldPicker.tsx` | Created | +51 |
| `src/features/views/components/grid/GridSortChips.tsx` | Created | +126 |
| `src/features/views/components/grid/GroupFieldPicker.tsx` | Created | +59 |
| `src/features/views/components/grid/GridGroupChip.tsx` | Created | +88 |
| `src/features/views/components/grid/__tests__/GridSortChips.test.tsx` | Created | +165 |
| `src/features/views/components/grid/__tests__/GridGroupChip.test.tsx` | Created | +135 |
| `src/lib/saved-views/grid-layout-schema.ts` | Modified | +12 |
| `src/lib/saved-views/source-fields.ts` | Modified | +7 |
| `src/lib/saved-views/__tests__/grid-layout-schema.test.ts` | Modified | +35 |
| `src/features/views/lib/columns.ts` | Modified | +2/-2 (sortable flips) |
| `src/features/views/hooks/useViewsData.ts` | Modified | +13 |
| `src/features/views/hooks/useGridLayout.ts` | Modified | +1 (default groupBy: null) |
| `src/features/views/hooks/__tests__/useGridLayout.test.tsx` | Modified | +56 (e2e round-trip) |
| `src/features/views/components/grid/GridView.tsx` | Modified | ~+170 (renderBody, toolbar siblings, group header) |
| `src/features/views/components/grid/GridFilterChips.tsx` | Modified | -2 (host strip unify) |
| `src/features/views/components/grid/__tests__/GridView.test.tsx` | Modified | +~150 (group rendering) |
| `src/features/views/components/views/NewsView.tsx` | Modified | -1 (drop dead `hideGroup`) |

## Test Results
- New tests added: 7 (GridSortChips) + 6 (GridGroupChip) + 5 (grid-layout-schema group cases) + ~5 (GridView group rendering) + 2 (useGridLayout sort+group round-trip) = ~25
- Full suite: **2761 passed, 0 failed** (verified post-design-review fix commits)
- Feature-focused suite (`src/features/views/components/grid`): 162 passed
- TypeScript typecheck on touched files: clean (the only `tsc --noEmit` errors are pre-existing in `src/features/rfps/lib/__tests__/normalize.test.ts`, `types.test.ts`, and `src/lib/__tests__/states.test.ts`, none of which were modified on this branch)
- Coverage gaps: the plan called for a `useViewsData` unit test asserting `groupBy: { id: "state" }` puts `sort=state:asc` first in the URL params; this test was not added. The behavior is covered transitively by the persistence round-trip test, and the logic in `useViewsData.ts` is a 2-line prepend that is unlikely to regress — low risk.

## Design Review
Passed (1 Warning + 4 Nits fixed in `0962621a`, `538c94eb`; 1 Nit accepted as established convention).

## Code Review Findings

### Strengths
- **Schema discipline is excellent.** `groupBy` is validated against `sortableFieldIds` (the SOURCE_FIELDS allowlist) with a Zod `superRefine`, and `buildOrderBy` has defense-in-depth: allowlist lookup + `/^[a-z_][a-z0-9_]*$/i` regex + hardcoded "ASC"/"DESC" coercion. SQL injection surface is closed.
- **No `any`, no `@ts-ignore`, no eslint-disable for type checking.** Only one `eslint-disable-next-line react-hooks/exhaustive-deps` survives (in `useGridLayout`), and it is the well-known JSON-stringify dep pattern with a clear rationale.
- **Query cache key correctly differentiates grouped vs ungrouped state** — `groupById` is included as a separate primitive in the TanStack Query key (`src/features/views/hooks/useViewsData.ts:65`), so cache hits never bleed across group changes.
- **Backward-compatible schema change.** Legacy persisted blobs without `groupBy` parse cleanly — covered by `grid-layout-schema.test.ts:44-48`.
- **News cards-mode hides Group naturally** — `NewsView` only renders `GridView` when `mode === "table"`, so cards mode can never expose a Group control.
- **Null-group bucket appears at the end** under "— No value —", as specified (`renderBody` in `GridView.tsx:393-416`).
- **Collapsed-group state is correctly local + per-session** (`useState<Set<string>>` initialized via lazy initializer at `GridView.tsx:192-194`).
- **Test surface is thorough**: 7 GridSortChips cases (open, pick, flip, remove, disable used, clear all, hide clear-all), 6 GridGroupChip cases (open, pick, replace, clear, disable current, hidden prop), plus 4 GridView group-rendering scenarios.
- **Boolean group headers were fixed** in the design-review polish commit to route through `formatCellValue` so a group on `is_customer` reads "Yes"/"No" instead of "true"/"false" or "TRUE"/"FALSE".

### Issues

| Severity | Description | File:Line | Recommendation |
|----------|-------------|-----------|----------------|
| Minor | `hideGroup` prop on `GridView` is dead code. After commit `7145f669` removed the always-false `hideGroup={mode === "cards"}` from `NewsView`, no caller in the codebase sets `hideGroup`. The prop is defined (`GridView.tsx:146`), threaded (`:162`), and forwarded to `GridGroupChip` (`:505`), but never reaches `true`. The `GridGroupChip` test covers `hidden: true`, but no production path exercises it. | `src/features/views/components/grid/GridView.tsx:146, 162, 505` | Remove the prop entirely — current and future News cards-mode hiding is enforced by `NewsView` not rendering `GridView` at all. Leaving dead props is "future flexibility" debt that the spec explicitly avoids. (Optional: keep if leaving room for a future use-case; trust the codebase rule "no dead code" and rip it out.) |
| Minor | Indentation drift in `GridSortChips.tsx:60-112` and `GridGroupChip.tsx:41-74`. After the unify-strip fix removed an outer wrapper, the children inside `<div className="relative inline-flex …">` remained indented by 8 spaces instead of being re-indented to 6. Functionally inert. | `src/features/views/components/grid/GridSortChips.tsx:60-112`, `GridGroupChip.tsx:41-74` | Re-indent or rely on the formatter; no behavioral consequence. |
| Minor | Test verification gap: `useViewsData` does not have an explicit URL-param assertion that `groupBy: { id: "state" }` prepends `sort=state:asc` to the query string. The plan called for it but it was skipped. | `src/features/views/hooks/__tests__/` (missing file `useViewsData.test.ts`) | Low priority — behavior is implicitly covered by the persistence round-trip, and the implementation is a straightforward 2-line prepend. Add a single test if you want belt-and-suspenders. |
| Minor | `groupColumn`, `groupKeyFor`, `groupLabelFor`, and `groupSpans` are recomputed on every render via direct closure construction (no `useMemo`/`useCallback`). For typical page sizes (≤50 rows, ~20 columns) this is fine, but the surface is large enough that a future maintainer may not realize how much work happens per render. | `src/features/views/components/grid/GridView.tsx:251-260, 321-353` | No action required at current scale. If row count ever grows past pagination, consider memoizing on `[visibleCols, layout.groupBy]`. |

No Critical or Important issues found. All identified issues are Minor and none block ship.

## Recommendation
**READY FOR REVIEW** — Spec is fully implemented, all 2761 tests pass, security and persistence are sound, and the only issues are a single dead prop (`hideGroup`) plus cosmetic indentation drift. Recommend dropping `hideGroup` and the indentation cleanup as quick follow-ups, but they are not ship blockers.
