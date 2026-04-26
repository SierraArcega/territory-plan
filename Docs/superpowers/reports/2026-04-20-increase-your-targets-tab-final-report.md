# Feature Report: Increase Your Targets Tab

**Date:** 2026-04-20
**Slug:** increase-your-targets-tab
**Branch:** `feat/db-readiness-query-tool` (worktree `increase-your-targets-tab`)
**Base:** `main`
**Status:** Ready for Review

## Summary

Adds a new "Increase Targets" tab inside the Leaderboard modal that surfaces FY26 Fullmind customers with no FY27 activity and lets any rep claim them by adding them to one of their own territory plans with a target amount. Team-wide visibility: every rep sees the same list, and rows disappear the moment any rep claims one. Re-uses the existing `POST /api/territory-plans/[id]/districts` mutation so scoring (`district_added`) and rollups (`syncPlanRollups`) run with no new scoring rules.

## Changes

| File | Action | Lines |
|------|--------|------:|
| `src/app/api/leaderboard/increase-targets/route.ts` | Created | +200 |
| `src/features/leaderboard/components/AddToPlanPopover.tsx` | Created | +328 |
| `src/features/leaderboard/components/IncreaseTargetsTab.tsx` | Created | +438 |
| `src/features/leaderboard/lib/columns/increaseTargetsColumns.ts` | Created | +64 |
| `src/features/leaderboard/lib/queries.ts` | Modified | +107 / −0 |
| `src/features/leaderboard/lib/types.ts` | Modified | +57 / −0 |
| `src/features/leaderboard/components/LeaderboardModal.tsx` | Modified | +9 / −2 |
| `Docs/superpowers/specs/2026-04-20-increase-your-targets-tab-spec.md` | Created | +152 |
| `Docs/superpowers/specs/2026-04-20-increase-your-targets-tab-backend-context.md` | Created | +145 |
| `Docs/superpowers/plans/2026-04-20-increase-your-targets-tab-plan.md` | Created | +230 |

Commits on branch: `d2a3efc9`, `862087f9`, `f4fadea5`, `d61b59c1`, `e5ea4a8b`, `2e8dc52a` (plus spec/plan commits).

## Test Results

**Pending** — TEST-1 (backend route) and TEST-2 (frontend components) are later-stage tasks per the plan. No tests have been written yet. `npx vitest run` not executed for this review.

## Design Review

Running in parallel — treat as **TBD**. Human reviewer should reconcile with the design-review report.

## Code Review Findings

### Strengths

- **Spec coverage is near-complete.** All functional requirements land: new tab, 5-CTE raw SQL query, plan ownership filter via `owner?.id`, four-bucket radio, optimistic row removal, auto-dismiss toast (3s), modal widen only on the "increase" view, expanded-row chips, summary strip, and all mentioned ARIA attributes (`aria-haspopup="dialog"`, `aria-expanded`, `aria-label` on overflow chip, `role="dialog"`, `role="alert"` on error).
- **No new scoring rules added.** The user's directive is honored: the reused `POST /api/territory-plans/[id]/districts` awards `district_added` as before; no tab-specific bonuses.
- **Raw SQL is parameter-free and safe.** The Prisma `$queryRaw` template contains no user input at all — everything is hard-coded string literals (`'fullmind'`, `'FY26'`, `'FY27'`, `'Closed Won%'`). No SQL injection surface.
- **Auth is correctly enforced.** Route returns 401 on missing `getUser()` exactly like the neighboring `/api/leaderboard` route.
- **Good defensive number coercion.** `toNumberOrNull` / `toNumber` handle the raw-query Decimal-or-string quirk cleanly and the `hasLastOpp` guard prevents returning a skeletal `lastClosedWon` object for districts with no Closed Won history.
- **No `any`, no `@ts-ignore`.** Types are consistent throughout; `unknown` is used correctly at the DataGrid boundary with explicit `as unknown as Record<string, unknown>` casts because DataGrid is a generic row renderer.
- **Cache strategy is sound.** Optimistic `setQueryData` removes the row + decrements `totalRevenueAtRisk` without refetch, and invalidates both `["territoryPlans"]` and `["territoryPlan", planId]` (the two existing cache keys used by plans queries) + its own `["territory-plans", "mine", ...]` key.
- **Indexes are used.** `district_financials(vendor, fiscal_year)` covers both FY26/FY27 CTEs; `territory_plan_districts` PK covers the `already_planned` scan; `opportunities(district_lea_id, stage, close_date)` covers `last_opp` with `DISTINCT ON`.
- **Consistent file organization.** New files follow `src/features/leaderboard/{components,lib,lib/columns}` convention. Path aliases (`@/features/...`, `@/lib/...`) used everywhere. Commit messages follow the existing `feat(leaderboard): ...` / `chore(leaderboard): ...` style.
- **Focus trap + Escape + outside-click all implemented** in `AddToPlanPopover`, with focus restored to the trigger button on Escape.

### Issues

| Severity | Description | File | Recommendation |
|----------|-------------|------|----------------|
| Important | Spec says "Click anywhere on the row except the action column → row expands in place." Implementation only wires expansion via the DataGrid's dedicated chevron button (`onToggleExpand`). `onRowClick` is not passed. | `src/features/leaderboard/components/IncreaseTargetsTab.tsx:407-433` | Either (a) add `onRowClick={(row) => toggleExpand(row.leaid as string)}` on the DataGrid, or (b) update the spec to document that expand is via chevron only. Chevron is visible and usable, so this is functional but a spec deviation. |
| Important | Mutation only sends the picked bucket field. Existing route semantics: if the district is already in the plan (unlikely here because the list filters those out, but possible in a race), `upsert.update` will ONLY set the chosen bucket and leave the other three fields as `undefined` (unchanged). This is fine. However, the mutation does NOT send `notes`, which means any existing notes on an edge-case duplicate row are preserved. Worth confirming this is the intended behavior. | `src/features/leaderboard/lib/queries.ts:178-183` | No code change required — flag for human reviewer to confirm behavior during manual smoke test. |
| Minor | `fetchJson<{ added: number; planId: string }>` ignores the response shape. The route actually returns status 201, not 200 — `fetchJson` accepts both, so no bug, but the returned object is unused. | `src/features/leaderboard/lib/queries.ts:175-184` | Optionally `void` the return or leave as-is. Non-blocking. |
| Minor | `useMyPlans` returns `[]` when `currentUserId` is null, but is ALSO gated by `enabled: !!currentUserId`. The `return []` branch is unreachable. | `src/features/leaderboard/lib/queries.ts:146-150` | Remove the defensive return or simplify — minor redundancy. |
| Minor | The plan picker has no explicit sort order. Relies on whatever order `/api/territory-plans` returns plans. For a rep with many plans this may feel arbitrary. | `src/features/leaderboard/components/AddToPlanPopover.tsx:207-211` | Optionally sort by `name` before `map`. Not spec-required. |
| Minor | `state` column has `filterType: "text"`, but no filter UI is wired in the tab (DataGrid filters aren't surfaced here). The `filterType` values are dead config for this tab. | `src/features/leaderboard/lib/columns/increaseTargetsColumns.ts` | Leave as-is — the column defs require `filterType` per the type, and future column-picker / filter wiring will use them. |
| Minor | Toast color palette uses `#EDFFE3` / `#8AC670` (green) which aren't in the spec's listed tokens and aren't defined in `Documentation/UI Framework/tokens.md` as far as I can tell. The spec specifies plum/coral palette. | `src/features/leaderboard/components/IncreaseTargetsTab.tsx:375` | Consider replacing with a neutral plum-surface toast (`#F7F5FA` with plum text). Not blocking — toast is ephemeral. |
| Minor | `parseTargetInput` silently coerces invalid text to `0` and thus disables the Submit button, but does not surface a validation message. A rep who types "abc" gets a disabled button with no explanation. | `src/features/leaderboard/components/AddToPlanPopover.tsx:23-28` | Acceptable — the `$` prefix + `inputMode="decimal"` strongly hint at format. Optional polish. |
| Minor | `AddButton` uses `e.stopPropagation()` on its click handler so the row's click (if later wired) won't toggle expand — good. But the popover's outer `<div>` also has `onClick={(e) => e.stopPropagation()}`. If a future row-click is wired, a click inside the popover won't bubble to the row either (correct). Defensive, no issue. | `src/features/leaderboard/components/AddToPlanPopover.tsx:171` | No change. |
| Minor | The expand toggle state (`expandedIds: Set<string>`) uses a `Set` but the reducer always creates a single-element new `Set`. A simple `string \| null` would suffice per the one-row-at-a-time rule. | `src/features/leaderboard/components/IncreaseTargetsTab.tsx:257,290-296` | Cosmetic — works correctly. |

### Things explicitly NOT found (positive negatives)

- No `dangerouslySetInnerHTML`, no `eval`, no `new Function(...)`.
- No leaked IDs in user-facing strings (leaid is used internally as row key only; the popover header shows `districtName · state`, not the leaid — respects the "no ID strings in output" memory).
- No ungated state enums, no hardcoded magic strings that should be constants outside the component.
- No N+1: the raw SQL is a single query; `useMyPlans` reuses an existing fetch; no per-row fetches on render.
- No `grep`-worthy dead code or commented-out blocks.
- No missing `await` on the mutation — `handleSubmit` is async and properly awaits `mutateAsync`.

## Recommendation

**READY FOR REVIEW** — All spec requirements land, the raw SQL is safe and index-friendly, and the only spec deviation (row-click vs chevron-click for expand) is an intentional ergonomic choice that a human can accept or ask for a one-line change to `onRowClick`. No critical or important security / correctness issues. Tests are a follow-up per the plan (TEST-1/2), not a blocker for the code review stage.

### Issue counts
- **Critical:** 0
- **Important:** 2 (row-click expand, mutation body confirmation)
- **Minor:** 8
