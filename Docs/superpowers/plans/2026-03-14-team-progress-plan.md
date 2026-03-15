# Implementation Plan: Team Progress

**Spec:** `docs/superpowers/specs/2026-03-14-team-progress-spec.md`
**Backend Context:** `docs/superpowers/specs/2026-03-14-team-progress-backend-context.md`

## Task Order

### Phase 1: Backend API (no frontend dependencies)

**Task 1.1: API Route — `GET /api/team-progress`**
- Create `src/app/api/team-progress/route.ts`
- Auth check with `getUser()`
- Accept `?fiscalYear=YYYY` query param (default to 2026)
- Query logic:
  1. Fetch all territory plans with districts and targets (Prisma)
  2. Batch query `district_opportunity_actuals` for 3 school years (current, prior, 2-years-ago) — aggregate by district_lea_id
  3. Batch query raw `opportunities` table for current FY (for drill-down detail)
  4. Classify each district:
     - Get priorRev, twoYearsAgoRev, currentRev
     - If priorRev > 0: renewal = min(currentRev, priorRev), expansion = max(0, currentRev - priorRev)
     - If priorRev == 0 && twoYearsAgoRev > 0: winback = currentRev
     - If priorRev == 0 && twoYearsAgoRev == 0: newBusiness = currentRev
  5. Find unmapped districts: district_lea_ids in current FY actuals NOT in any plan's districts
  6. Fetch district names for unmapped districts from `districts` table
  7. Aggregate plan-level and team-level totals
  8. Return `TeamProgressResponse`

**Task 1.2: TanStack Query Hook**
- Add `useTeamProgress(fiscalYear)` to `src/features/progress/lib/queries.ts`
- Query key: `["teamProgress", fiscalYear]`
- Stale time: 2 minutes

### Phase 2: Navigation Wiring

**Task 2.1: Add "progress" tab to navigation**
- `src/features/shared/lib/app-store.ts`: Add `"progress"` to `TabId` union
- `src/features/shared/components/navigation/Sidebar.tsx`: Add Progress tab with chart icon to `MAIN_TABS`
- `src/app/page.tsx`: Add `"progress"` to `VALID_TABS`, import and render `TeamProgressView`

### Phase 3: Frontend Components (depends on Phase 1 + 2)

**Task 3.1: CategoryCard component**
- `src/features/progress/components/CategoryCard.tsx`
- Props: label, target, actual, color, icon
- Shows percentage, dollar amounts, progress bar or ring
- Handles zero-target gracefully

**Task 3.2: StackedProgressBar component**
- `src/features/progress/components/StackedProgressBar.tsx`
- Props: categories array with { label, actual, color }, totalTarget
- Horizontal bar with colored segments, target marker

**Task 3.3: UnmappedAlert component**
- `src/features/progress/components/UnmappedAlert.tsx`
- Props: totalRevenue, districtCount
- Warning-styled banner, collapsible to show district list

**Task 3.4: PlanProgressTable component**
- `src/features/progress/components/PlanProgressTable.tsx`
- Expandable plan rows with inline progress bars per category
- Expand → shows DistrictProgressRow for each district
- Expand district → shows OpportunityList
- Unmapped section at bottom

**Task 3.5: TeamProgressView (orchestrator)**
- `src/features/progress/components/TeamProgressView.tsx`
- FY selector dropdown
- Calls `useTeamProgress(fy)`
- Renders: CategoryCards → StackedProgressBar → UnmappedAlert → PlanProgressTable
- Loading/empty/error states

### Phase 4: Polish

**Task 4.1: Loading skeletons**
- Skeleton versions of CategoryCard and table rows

**Task 4.2: Format helpers**
- Currency formatting, percentage formatting
- Reuse patterns from DistrictPerformanceSection

## Dependencies

```
1.1 ──┐
      ├── 1.2 ──┐
2.1 ──┘         ├── 3.5 (orchestrator, depends on all)
3.1 ────────────┤
3.2 ────────────┤
3.3 ────────────┤
3.4 ────────────┘
```

Tasks 1.1, 2.1, 3.1, 3.2, 3.3, 3.4 can be parallelized.
Task 3.5 (TeamProgressView) depends on all others.

## Test Strategy

- API route: test classification logic with mock district revenue data
- Components: render tests with mock TeamProgressResponse
- Integration: verify FY selector changes data
