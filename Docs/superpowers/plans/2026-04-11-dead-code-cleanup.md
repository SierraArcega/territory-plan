# Dead Code Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove four dead/deprecated features (Explore, Progress, Goals UI, Mixmax) and the old HomeView, reducing ~44 files and cleaning ~20 integration points.

**Architecture:** Each feature is removed independently in dependency order. Shared infrastructure (filter utilities, goal dashboard query) is relocated before deletion. Database schema is left unchanged per user request.

**Tech Stack:** Next.js App Router, React, TypeScript, Zustand, TanStack Query, Vitest

---

## Decisions

- **Database schema**: Leave `UserGoal` table and mixmax columns on `Activity` model in `prisma/schema.prisma` untouched — no migrations.
- **DataGrid component**: Keep `src/features/shared/components/DataGrid/` — not removing.
- **DistrictExploreModal**: Keep — it's the map's district detail modal, NOT part of the Explore overlay feature. State (`exploreModalLeaid`, `setExploreModalLeaid`) stays in the store.
- **`useGoalDashboard`**: Move to shared — it powers the ProfileSidebar's FiscalYearSummary which is still active.
- **`filters.ts`**: Move to shared — `buildWhereClause`, `DISTRICT_FIELD_MAP`, `FilterOp` are used by district search, batch operations, and territory plan API routes.
- **Campaigns activity category**: Keep `mixmax_campaign` as an activity type — only remove Mixmax integration features (connect, enrich, API routes).

## File Structure

### Files to create (relocations)

| New path | Moved from | Reason |
|----------|-----------|--------|
| `src/features/shared/lib/filters.ts` | `src/features/explore/lib/filters.ts` | Used by district search, batch APIs, store |
| `src/features/shared/lib/__tests__/filters.test.ts` | `src/features/explore/lib/__tests__/filters.test.ts` | Tests for relocated filters |

### Files to delete (~44 files)

**Explore feature (16 files):**
- `src/features/explore/lib/queries.ts`
- `src/features/explore/lib/filters.ts` (after relocation)
- `src/features/explore/lib/__tests__/filters.test.ts` (after relocation)
- `src/features/map/components/explore/BulkActionBar.tsx`
- `src/features/map/components/explore/ExploreColumnPicker.tsx`
- `src/features/map/components/explore/ExploreFilters.tsx`
- `src/features/map/components/explore/ExploreKPICards.tsx`
- `src/features/map/components/explore/ExploreOverlay.tsx`
- `src/features/map/components/explore/ExploreSavedViews.tsx`
- `src/features/map/components/explore/ExploreSortDropdown.tsx`
- `src/features/map/components/explore/cellRenderers.tsx`
- `src/features/map/components/explore/columns/activityColumns.ts`
- `src/features/map/components/explore/columns/contactColumns.ts`
- `src/features/map/components/explore/columns/districtColumns.ts`
- `src/features/map/components/explore/columns/planColumns.ts`
- `src/features/map/components/explore/columns/taskColumns.ts`
- `src/app/api/explore/[entity]/route.ts`
- `src/app/api/explore/competitor-meta/route.ts`

**Progress feature (11 files):**
- `src/features/progress/components/CategoryCard.tsx`
- `src/features/progress/components/FunnelChart.tsx`
- `src/features/progress/components/LaggingIndicatorsPanel.tsx`
- `src/features/progress/components/LeadingIndicatorsPanel.tsx`
- `src/features/progress/components/PlanProgressTable.tsx`
- `src/features/progress/components/StackedProgressBar.tsx`
- `src/features/progress/components/TeamProgressView.tsx`
- `src/features/progress/components/UnmappedAlert.tsx`
- `src/features/progress/lib/queries.ts`
- `src/features/progress/lib/types.ts`
- `src/app/api/progress/plans/route.ts`
- `src/app/api/progress/activities/route.ts`
- `src/app/api/progress/outcomes/route.ts`
- `src/app/api/team-progress/route.ts`

**Goals feature (11 files):**
- `src/features/goals/components/DonutChart.tsx`
- `src/features/goals/components/DonutMetricPopover.tsx`
- `src/features/goals/components/GoalEditorModal.tsx`
- `src/features/goals/components/GoalFormModal.tsx`
- `src/features/goals/components/GoalProgress.tsx`
- `src/features/goals/components/GoalSetupModal.tsx`
- `src/features/goals/components/ProgressCard.tsx`
- `src/features/goals/components/UserMenu.tsx`
- `src/features/goals/components/__tests__/DonutChart.test.tsx`
- `src/features/goals/components/__tests__/DonutMetricPopover.test.tsx`
- `src/features/goals/lib/queries.ts` (after moving `useGoalDashboard`)
- `src/app/api/profile/goals/route.ts` (goal CRUD — keep dashboard route)
- `src/app/api/profile/goals/[fiscalYear]/route.ts` (goal GET/DELETE — keep dashboard route)

**Mixmax feature (7 files):**
- `src/features/mixmax/components/CampaignStatsPanel.tsx`
- `src/features/integrations/components/MixmaxConnectModal.tsx`
- `src/features/integrations/components/MixmaxCampaignModal.tsx`
- `src/features/integrations/lib/mixmax-enrichment.ts`
- `src/features/integrations/lib/__tests__/mixmax-enrichment.test.ts`
- `src/app/api/integrations/mixmax/campaigns/route.ts`
- `src/app/api/integrations/mixmax/connect/route.ts`
- `src/app/api/integrations/mixmax/disconnect/route.ts`

**Old HomeView (2 files):**
- `src/features/shared/components/views/HomeView.tsx`
- `src/features/shared/components/views/__tests__/HomeView.test.tsx`

### Files to edit (~18 files)

| File | Changes |
|------|---------|
| `src/features/map/lib/store.ts` | Remove explore types/state/actions, update `FilterOp` import path |
| `src/features/map/components/MapV2Shell.tsx` | Remove `ExploreOverlay` import and render |
| `src/features/map/components/IconBar.tsx` | Remove "explore" tab and its icon case |
| `src/app/page.tsx` | Remove `TeamProgressView` import, "progress" from VALID_TABS, switch case |
| `src/features/shared/lib/app-store.ts` | Remove "progress" from `TabId` union |
| `src/lib/api.ts` | Remove explore, progress, goals re-exports |
| `src/features/home/components/ProfileSidebar.tsx` | Update goal imports to shared, remove Mixmax from INTEGRATIONS |
| `src/features/home/components/PlansTab.tsx` | Update `getDefaultFiscalYear` import to shared |
| `src/features/integrations/components/ConnectedAccountsSection.tsx` | Remove MixmaxConnectModal, "mixmax" from SERVICE_ORDER |
| `src/features/integrations/components/ContactOutreachActions.tsx` | Remove MixmaxCampaignModal, mixmax button/panel |
| `src/features/integrations/lib/queries.ts` | Remove `useMixmaxCampaigns`, `useAddToCampaign` |
| `src/features/integrations/lib/gmail-sync.ts` | Remove mixmax enrichment import and Step 7 |
| `src/features/integrations/types.ts` | Remove "mixmax" from `IntegrationService`, remove mixmax entry from `INTEGRATION_SERVICES` |
| `src/app/api/districts/search/route.ts` | Update filter import to shared path |
| `src/app/api/districts/batch-tags/route.ts` | Update filter import to shared path |
| `src/app/api/districts/batch-edits/route.ts` | Update filter import to shared path |
| `src/app/api/territory-plans/[id]/districts/route.ts` | Update filter import to shared path |
| `src/app/api/territory-plans/__tests__/route.test.ts` | Update filter mock path |

---

## Task 1: Relocate shared filter infrastructure

Move `filters.ts` and its tests from `src/features/explore/lib/` to `src/features/shared/lib/` so that district search, batch operations, and the Zustand store can still use them after the Explore feature is deleted.

**Files:**
- Create: `src/features/shared/lib/filters.ts` (copy from `src/features/explore/lib/filters.ts`)
- Create: `src/features/shared/lib/__tests__/filters.test.ts` (copy from `src/features/explore/lib/__tests__/filters.test.ts`)
- Modify: `src/features/map/lib/store.ts:87-88` — update import path
- Modify: `src/app/api/districts/search/route.ts:10-11` — update import path
- Modify: `src/app/api/districts/batch-tags/route.ts:5-6` — update import path
- Modify: `src/app/api/districts/batch-edits/route.ts:5-6` — update import path
- Modify: `src/app/api/territory-plans/[id]/districts/route.ts:9-10` — update import path
- Modify: `src/app/api/territory-plans/__tests__/route.test.ts:19-20` — update mock path

- [ ] **Step 1: Copy filters.ts to shared**

Copy `src/features/explore/lib/filters.ts` to `src/features/shared/lib/filters.ts` with no content changes.

- [ ] **Step 2: Copy filters test to shared**

Copy `src/features/explore/lib/__tests__/filters.test.ts` to `src/features/shared/lib/__tests__/filters.test.ts`. Update the import path in the test file:

```typescript
// Change this:
import { buildWhereClause, DISTRICT_FIELD_MAP, PLANS_FIELD_MAP, type FilterOp } from "../filters";
// No change needed — relative import still works since test is co-located with filters.ts
```

Since the test uses a relative import (`../filters`), and the new test file is at `__tests__/filters.test.ts` relative to the new `filters.ts`, no import change is needed.

- [ ] **Step 3: Update store.ts import**

In `src/features/map/lib/store.ts`, change lines 87-88:

```typescript
// Old:
import type { FilterOp } from "@/features/explore/lib/filters";
export type { FilterOp } from "@/features/explore/lib/filters";

// New:
import type { FilterOp } from "@/features/shared/lib/filters";
export type { FilterOp } from "@/features/shared/lib/filters";
```

- [ ] **Step 4: Update API route imports**

Update filter imports in these files — change `@/features/explore/lib/filters` to `@/features/shared/lib/filters`:

`src/app/api/districts/search/route.ts` (lines 10-11):
```typescript
import {
  buildWhereClause,
  DISTRICT_FIELD_MAP,
} from "@/features/shared/lib/filters";
```

`src/app/api/districts/batch-tags/route.ts` (lines 5-6):
```typescript
import {
  buildWhereClause,
  DISTRICT_FIELD_MAP,
} from "@/features/shared/lib/filters";
```

`src/app/api/districts/batch-edits/route.ts` (lines 5-6):
```typescript
import {
  buildWhereClause,
  DISTRICT_FIELD_MAP,
} from "@/features/shared/lib/filters";
```

`src/app/api/territory-plans/[id]/districts/route.ts` (lines 9-10):
```typescript
import {
  buildWhereClause,
  DISTRICT_FIELD_MAP,
} from "@/features/shared/lib/filters";
```

`src/app/api/territory-plans/__tests__/route.test.ts` — update the mock path:
```typescript
vi.mock("@/features/shared/lib/filters", () => ({
  buildWhereClause: vi.fn().mockReturnValue({}),
  DISTRICT_FIELD_MAP: {},
}));
```

- [ ] **Step 5: Run filter tests**

Run: `npx vitest run src/features/shared/lib/__tests__/filters.test.ts`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/shared/lib/filters.ts src/features/shared/lib/__tests__/filters.test.ts src/features/map/lib/store.ts src/app/api/districts/search/route.ts src/app/api/districts/batch-tags/route.ts src/app/api/districts/batch-edits/route.ts src/app/api/territory-plans/[id]/districts/route.ts src/app/api/territory-plans/__tests__/route.test.ts
git commit -m "refactor: move filter utilities from explore to shared lib"
```

---

## Task 2: Move goal dashboard query and fiscal year utility to shared

The `useGoalDashboard` query and `getDefaultFiscalYear` utility are used by the ProfileSidebar (active in the new HomeView). Move them to shared before deleting the goals feature.

**Files:**
- Modify: `src/features/shared/lib/queries.ts` — add `useGoalDashboard` hook
- Create: `src/features/shared/lib/fiscal-year.ts` — move `getDefaultFiscalYear`
- Modify: `src/features/home/components/ProfileSidebar.tsx:6-7` — update imports
- Modify: `src/features/home/components/PlansTab.tsx:10` — update import

- [ ] **Step 1: Create fiscal-year.ts in shared**

Create `src/features/shared/lib/fiscal-year.ts`:

```typescript
// Get default fiscal year based on current date
// If we're past June (month >= 6), we're in the next fiscal year
export function getDefaultFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 6 ? year + 1 : year;
}
```

- [ ] **Step 2: Add useGoalDashboard to shared queries**

Add to the end of `src/features/shared/lib/queries.ts`:

```typescript
import type { GoalDashboard } from "@/features/shared/types/api-types";

// Goal Dashboard — used by ProfileSidebar FiscalYearSummary
export function useGoalDashboard(fiscalYear: number | null) {
  return useQuery({
    queryKey: ["goalDashboard", fiscalYear],
    queryFn: () =>
      fetchJson<GoalDashboard>(`${API_BASE}/profile/goals/${fiscalYear}/dashboard`),
    enabled: !!fiscalYear,
    staleTime: 2 * 60 * 1000,
  });
}
```

Note: `useQuery`, `fetchJson`, and `API_BASE` are already imported at the top of this file.

- [ ] **Step 3: Update ProfileSidebar imports**

In `src/features/home/components/ProfileSidebar.tsx`, change lines 6-7:

```typescript
// Old:
import { useGoalDashboard } from "@/features/goals/lib/queries";
import { getDefaultFiscalYear } from "@/features/goals/components/ProgressCard";

// New:
import { useGoalDashboard } from "@/features/shared/lib/queries";
import { getDefaultFiscalYear } from "@/features/shared/lib/fiscal-year";
```

- [ ] **Step 4: Update PlansTab import**

In `src/features/home/components/PlansTab.tsx`, change line 10:

```typescript
// Old:
import { getDefaultFiscalYear } from "@/features/goals/components/ProgressCard";

// New:
import { getDefaultFiscalYear } from "@/features/shared/lib/fiscal-year";
```

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors related to the moved utilities.

- [ ] **Step 6: Commit**

```bash
git add src/features/shared/lib/fiscal-year.ts src/features/shared/lib/queries.ts src/features/home/components/ProfileSidebar.tsx src/features/home/components/PlansTab.tsx
git commit -m "refactor: move getDefaultFiscalYear and useGoalDashboard to shared"
```

---

## Task 3: Remove Explore feature

Delete the Explore overlay, its components, API routes, queries, and store state. Keep `DistrictExploreModal` and `exploreModalLeaid` state (they're district detail, not Explore).

**Files:**
- Delete: `src/features/explore/lib/queries.ts`
- Delete: `src/features/explore/lib/filters.ts` (already relocated in Task 1)
- Delete: `src/features/explore/lib/__tests__/filters.test.ts` (already relocated in Task 1)
- Delete: `src/features/map/components/explore/` (entire directory — 13 files)
- Delete: `src/app/api/explore/[entity]/route.ts`
- Delete: `src/app/api/explore/competitor-meta/route.ts`
- Modify: `src/features/map/lib/store.ts` — remove explore state/actions
- Modify: `src/features/map/components/MapV2Shell.tsx:5,87` — remove ExploreOverlay
- Modify: `src/features/map/components/IconBar.tsx:11,81-90` — remove explore tab and icon
- Modify: `src/lib/api.ts:16` — remove explore re-export

- [ ] **Step 1: Delete explore directories**

```bash
rm -rf src/features/explore/
rm -rf src/features/map/components/explore/
rm -rf src/app/api/explore/
```

- [ ] **Step 2: Remove ExploreOverlay from MapV2Shell**

In `src/features/map/components/MapV2Shell.tsx`:

Remove line 5 (the import):
```typescript
// Delete this line:
import ExploreOverlay from "./explore/ExploreOverlay";
```

Remove lines 86-87 (the render):
```typescript
// Delete these lines:
        {/* Explore data overlay (covers map when active) */}
        <ExploreOverlay />
```

- [ ] **Step 3: Remove explore tab from IconBar**

In `src/features/map/components/IconBar.tsx`, remove the explore entry from the tabs array (line 11):

```typescript
// Old:
const tabs: Array<{ id: IconBarTab; icon: string; label: string }> = [
  { id: "selection", icon: "selection", label: "Selection" },
  { id: "home", icon: "home", label: "Home" },
  { id: "plans", icon: "plans", label: "Plans" },
  { id: "explore", icon: "explore", label: "Explore" },
  { id: "settings", icon: "settings", label: "Settings" },
];

// New:
const tabs: Array<{ id: IconBarTab; icon: string; label: string }> = [
  { id: "selection", icon: "selection", label: "Selection" },
  { id: "home", icon: "home", label: "Home" },
  { id: "plans", icon: "plans", label: "Plans" },
  { id: "settings", icon: "settings", label: "Settings" },
];
```

Remove the "explore" case from TabIcon (lines 81-90):

```typescript
// Delete this case:
    case "explore":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M4 16V10M8 16V6M12 16V8M16 16V4"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
```

- [ ] **Step 4: Remove explore state from Zustand store**

In `src/features/map/lib/store.ts`, make these changes:

**a) Update `IconBarTab` type** (line 78):
```typescript
// Old:
export type IconBarTab = "selection" | "home" | "plans" | "explore" | "settings";
// New:
export type IconBarTab = "selection" | "home" | "plans" | "settings";
```

**b) Remove explore-specific types** (lines 83-109) — delete these type definitions:
- `ExploreEntity`
- `ExploreFilter` → **KEEP** — rename nothing, this type is still used by `searchFilters`
- `ExploreSortConfig`
- `ExploreSavedView`

Actually, keep `ExploreFilter` since `searchFilters` uses it (lines 293, 466-469). Remove only:
```typescript
// DELETE these types:
export type ExploreEntity = "districts" | "activities" | "tasks" | "contacts" | "plans";

export interface ExploreSortConfig {
  column: string;
  direction: "asc" | "desc";
}

export interface ExploreSavedView {
  id: string;
  name: string;
  entity: ExploreEntity;
  filters: ExploreFilter[];
  sorts: ExploreSortConfig[];
  columns: string[];
}
```

**c) Remove explore state properties** from the state interface (lines 262-273):
```typescript
// DELETE these state properties:
  isExploreActive: boolean;
  exploreEntity: ExploreEntity;
  exploreColumns: Record<ExploreEntity, string[]>;
  exploreFilters: Record<ExploreEntity, ExploreFilter[]>;
  exploreSort: Record<ExploreEntity, ExploreSortConfig[]>;
  explorePage: number;
  exploreSavedViews: Record<ExploreEntity, ExploreSavedView[]>;
  activeViewId: Record<ExploreEntity, string | null>;
```

**d) Remove explore action type definitions** (lines 434-452):
```typescript
// DELETE these action type definitions:
  setExploreEntity: (entity: ExploreEntity) => void;
  setExploreColumns: (entity: ExploreEntity, columns: string[]) => void;
  addExploreFilter: (entity: ExploreEntity, filter: ExploreFilter) => void;
  removeExploreFilter: (entity: ExploreEntity, filterId: string) => void;
  updateExploreFilter: (entity: ExploreEntity, filterId: string, updates: Partial<ExploreFilter>) => void;
  clearExploreFilters: (entity: ExploreEntity) => void;
  setExploreSort: (entity: ExploreEntity, sort: ExploreSortConfig[]) => void;
  addSortRule: (entity: ExploreEntity, rule: ExploreSortConfig) => void;
  removeSortRule: (entity: ExploreEntity, column: string) => void;
  reorderSortRules: (entity: ExploreEntity, rules: ExploreSortConfig[]) => void;
  setExplorePage: (page: number) => void;
  saveView: (entity: ExploreEntity, view: ExploreSavedView) => void;
  loadView: (entity: ExploreEntity, viewId: string) => void;
  deleteView: (entity: ExploreEntity, viewId: string) => void;
  setActiveViewId: (entity: ExploreEntity, viewId: string | null) => void;
```

**e) Remove explore initial state** (lines 599-639):
```typescript
// DELETE these initial state values:
  isExploreActive: false,
  exploreEntity: "districts" as ExploreEntity,
  exploreColumns: { ... },
  exploreFilters: { ... },
  exploreSort: { ... },
  explorePage: 1,
  exploreSavedViews: { ... },
  activeViewId: { ... },
```

**f) Update `setActiveIconTab` action** (around line 737):
```typescript
// Old:
  isExploreActive: tab === "explore",
  // Clear filtered districts when leaving explore
  ...(tab !== "explore" ? { filteredDistrictLeaids: [] } : {}),

// New — remove both lines, just keep the normal setActiveIconTab behavior:
  // (remove the isExploreActive and filteredDistrictLeaids lines)
```

**g) Remove explore action implementations** (lines 1121-1354) — delete all these action bodies:
- `setExploreEntity`
- `setExploreColumns`
- `addExploreFilter`
- `removeExploreFilter`
- `updateExploreFilter`
- `clearExploreFilters`
- `setExploreSort`
- `addSortRule`
- `removeSortRule`
- `reorderSortRules`
- `setExplorePage`
- `saveView`
- `loadView`
- `deleteView`
- `setActiveViewId`

**Keep** `setExploreModalLeaid` (line 1354) — it's used by SearchResults.

- [ ] **Step 5: Remove explore re-export from api.ts**

In `src/lib/api.ts`, delete line 16:
```typescript
// Delete:
export * from "@/features/explore/lib/queries";
```

- [ ] **Step 6: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: remove Explore feature (overlay, API routes, store state)"
```

---

## Task 4: Remove Progress feature

Delete the TeamProgressView tab, all progress components, API routes, and queries.

**Files:**
- Delete: `src/features/progress/` (entire directory)
- Delete: `src/app/api/progress/` (entire directory)
- Delete: `src/app/api/team-progress/route.ts`
- Modify: `src/app/page.tsx:14,33,196-197` — remove progress
- Modify: `src/features/shared/lib/app-store.ts:5` — remove "progress" from TabId
- Modify: `src/lib/api.ts` — remove progress re-export

- [ ] **Step 1: Delete progress directories**

```bash
rm -rf src/features/progress/
rm -rf src/app/api/progress/
rm src/app/api/team-progress/route.ts
```

- [ ] **Step 2: Remove progress from page.tsx**

In `src/app/page.tsx`:

Delete line 14 (the import):
```typescript
// Delete:
import TeamProgressView from "@/features/progress/components/TeamProgressView";
```

Remove "progress" from VALID_TABS (line 33):
```typescript
// Old:
const VALID_TABS: TabId[] = ["home", "map", "plans", "activities", "tasks", "progress", "resources", "profile", "admin"];
// New:
const VALID_TABS: TabId[] = ["home", "map", "plans", "activities", "tasks", "resources", "profile", "admin"];
```

Remove the progress case from renderContent switch (lines 196-197):
```typescript
// Delete:
      case "progress":
        return <TeamProgressView />;
```

- [ ] **Step 3: Remove "progress" from TabId type**

In `src/features/shared/lib/app-store.ts`, line 5:
```typescript
// Old:
export type TabId = "home" | "map" | "plans" | "activities" | "tasks" | "progress" | "leaderboard" | "resources" | "profile" | "admin";
// New:
export type TabId = "home" | "map" | "plans" | "activities" | "tasks" | "leaderboard" | "resources" | "profile" | "admin";
```

- [ ] **Step 4: Remove progress re-export from api.ts**

In `src/lib/api.ts`, delete the progress line:
```typescript
// Delete:
export * from "@/features/progress/lib/queries";
```

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: remove Progress feature (tab, components, API routes)"
```

---

## Task 5: Remove Goals feature UI

Delete all goals UI components, goal CRUD API routes, and queries. Keep the dashboard API route (powers ProfileSidebar).

**Files:**
- Delete: `src/features/goals/` (entire directory)
- Delete: `src/app/api/profile/goals/route.ts` (goal CRUD)
- Delete: `src/app/api/profile/goals/[fiscalYear]/route.ts` (goal GET/DELETE)
- Keep: `src/app/api/profile/goals/[fiscalYear]/dashboard/route.ts`
- Modify: `src/lib/api.ts` — remove goals re-export

- [ ] **Step 1: Delete goals feature directory**

```bash
rm -rf src/features/goals/
```

- [ ] **Step 2: Delete goal CRUD API routes**

```bash
rm src/app/api/profile/goals/route.ts
rm src/app/api/profile/goals/\[fiscalYear\]/route.ts
```

Keep `src/app/api/profile/goals/[fiscalYear]/dashboard/route.ts` — the ProfileSidebar needs it.

- [ ] **Step 3: Remove goals re-export from api.ts**

In `src/lib/api.ts`, delete the goals line:
```typescript
// Delete:
export * from "@/features/goals/lib/queries";
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: remove Goals feature UI (modals, components, CRUD routes)"
```

---

## Task 6: Remove old HomeView

The old HomeView at `src/features/shared/components/views/HomeView.tsx` is no longer imported anywhere — it was replaced by `src/features/home/components/HomeView.tsx`.

**Files:**
- Delete: `src/features/shared/components/views/HomeView.tsx`
- Delete: `src/features/shared/components/views/__tests__/HomeView.test.tsx`

- [ ] **Step 1: Delete old HomeView and its test**

```bash
rm src/features/shared/components/views/HomeView.tsx
rm src/features/shared/components/views/__tests__/HomeView.test.tsx
```

- [ ] **Step 2: Verify no imports reference it**

Run: `grep -r "shared/components/views/HomeView" src/`
Expected: No matches.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: remove old HomeView (replaced by features/home/components/HomeView)"
```

---

## Task 7: Remove Mixmax integration features

Remove the Mixmax integration plumbing: stub component, campaign/connect modals, enrichment logic, API routes, and integration UI references. Keep `mixmax_campaign` as a valid activity type — it's just no longer backed by an integration.

**Files:**
- Delete: `src/features/mixmax/` (entire directory)
- Delete: `src/features/integrations/components/MixmaxConnectModal.tsx`
- Delete: `src/features/integrations/components/MixmaxCampaignModal.tsx`
- Delete: `src/features/integrations/lib/mixmax-enrichment.ts`
- Delete: `src/features/integrations/lib/__tests__/mixmax-enrichment.test.ts`
- Delete: `src/app/api/integrations/mixmax/` (entire directory)
- Modify: `src/features/integrations/components/ConnectedAccountsSection.tsx`
- Modify: `src/features/integrations/components/ContactOutreachActions.tsx`
- Modify: `src/features/integrations/lib/queries.ts:88-106`
- Modify: `src/features/integrations/lib/gmail-sync.ts:16,423-435`
- Modify: `src/features/integrations/types.ts:1,46-52`
- Modify: `src/features/home/components/ProfileSidebar.tsx:45`
- **Keep unchanged**: `src/features/activities/types.ts` (campaigns category and mixmax_campaign type stay)
- **Keep unchanged**: `src/features/plans/components/ActivityFormModal.tsx` (mixmax_campaign still valid)
- **Keep unchanged**: `src/features/plans/components/PlanTabs.tsx` (mixmax_campaign filter stays)
- **Keep unchanged**: `src/features/plans/components/__tests__/ActivitiesTable.test.tsx` (test data stays)
- **Keep unchanged**: `src/features/shared/types/api-types.ts` (mixmax enrichment fields stay on Activity — historical data may exist)

- [ ] **Step 1: Delete mixmax files and directories**

```bash
rm -rf src/features/mixmax/
rm -rf src/app/api/integrations/mixmax/
rm src/features/integrations/components/MixmaxConnectModal.tsx
rm src/features/integrations/components/MixmaxCampaignModal.tsx
rm src/features/integrations/lib/mixmax-enrichment.ts
rm src/features/integrations/lib/__tests__/mixmax-enrichment.test.ts
```

- [ ] **Step 2: Update ConnectedAccountsSection**

In `src/features/integrations/components/ConnectedAccountsSection.tsx`:

Remove line 6 (import):
```typescript
// Delete:
import MixmaxConnectModal from "./MixmaxConnectModal";
```

Remove "mixmax" from SERVICE_ORDER (line 15):
```typescript
// Old:
const SERVICE_ORDER: IntegrationService[] = ["gmail", "google_calendar", "slack", "mixmax"];
// New:
const SERVICE_ORDER: IntegrationService[] = ["gmail", "google_calendar", "slack"];
```

Remove `showMixmaxModal` state (line 20):
```typescript
// Delete:
  const [showMixmaxModal, setShowMixmaxModal] = useState(false);
```

Remove the mixmax badge label (lines 84-86):
```typescript
// Delete:
                      {service === "mixmax" && (
                        <span className="text-xs text-gray-400">Gmail enhancement</span>
                      )}
```

Remove the non-OAuth connect button branch (lines 116-123) — this was the mixmax-specific branch. Replace it with the OAuth connect path or remove the else-if entirely since all remaining services are OAuth:
```typescript
// Delete this entire else-if:
                    ) : (
                      <button
                        onClick={() => setShowMixmaxModal(true)}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors"
                      >
                        Connect
                      </button>
```

Remove the MixmaxConnectModal render (line 133):
```typescript
// Delete:
      {showMixmaxModal && <MixmaxConnectModal onClose={() => setShowMixmaxModal(false)} />}
```

Remove unused `useState` import if `showMixmaxModal` was the only state — but check first. It's not, the component still uses `useState` for other things (no, actually checking — there are no other useState calls in this component). Remove `useState` from the import.

Actually, re-checking: the component has no other `useState` calls. Remove `useState` from the import:
```typescript
// Old:
import { useState } from "react";
// Delete the import entirely — no more useState usage
```

Wait — actually check: `disconnectMutation` doesn't use useState. Let me look again. The component uses `useIntegrations`, `useDisconnectIntegration`, and `showMixmaxModal`. Without `showMixmaxModal`, there are no `useState` calls. Remove the `useState` import.

- [ ] **Step 3: Update ContactOutreachActions**

In `src/features/integrations/components/ContactOutreachActions.tsx`:

Remove line 10 (import):
```typescript
// Delete:
import MixmaxCampaignModal from "./MixmaxCampaignModal";
```

Remove "mixmax" from `ActivePanel` type (line 19):
```typescript
// Old:
type ActivePanel = "email" | "slack" | "mixmax" | null;
// New:
type ActivePanel = "email" | "slack" | null;
```

Remove mixmax connection check (lines 36-38):
```typescript
// Delete:
  const mixmaxConnected = integrations?.some(
    (i) => i.service === "mixmax" && i.status === "connected"
  );
```

Remove the entire Mixmax button block (lines 85-111):
```typescript
// Delete the entire Mixmax ActionButton:
        {/* Mixmax button */}
        <ActionButton
          label="Mixmax"
          ...
        </ActionButton>
```

Remove the Mixmax panel render (lines 133-139):
```typescript
// Delete:
      {activePanel === "mixmax" && contactEmail && (
        <MixmaxCampaignModal
          contactEmail={contactEmail}
          contactName={contactName}
          onClose={closePanel}
        />
      )}
```

- [ ] **Step 4: Update integrations/lib/queries.ts**

In `src/features/integrations/lib/queries.ts`, delete `useMixmaxCampaigns` and `useAddToCampaign` (lines 88-106):

```typescript
// Delete both hooks:
export function useMixmaxCampaigns() { ... }
export function useAddToCampaign() { ... }
```

- [ ] **Step 5: Remove mixmax enrichment from gmail-sync**

In `src/features/integrations/lib/gmail-sync.ts`:

Remove the import (line 16):
```typescript
// Delete:
import { enrichActivitiesWithMixmax } from "@/features/integrations/lib/mixmax-enrichment";
```

Remove `mixmaxEnriched` from `GmailSyncResult` interface (line 26):
```typescript
// Delete:
  mixmaxEnriched?: number;
```

Remove Step 7 enrichment block (lines 423-435):
```typescript
// Delete:
  // Step 7: Enrich newly created activities with Mixmax sequence data (if integration exists)
  if (newMessageIds.length > 0) {
    const mixmaxIntegration = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId, service: "mixmax" } },
    });
    if (mixmaxIntegration) {
      const enrichResult = await enrichActivitiesWithMixmax(userId, newMessageIds);
      result.mixmaxEnriched = enrichResult.enriched;
      if (enrichResult.errors.length > 0) {
        result.errors.push(...enrichResult.errors);
      }
    }
  }
```

- [ ] **Step 6: Remove mixmax from integrations types**

In `src/features/integrations/types.ts`:

Remove "mixmax" from IntegrationService (line 1):
```typescript
// Old:
export type IntegrationService = "gmail" | "google_calendar" | "slack" | "mixmax";
// New:
export type IntegrationService = "gmail" | "google_calendar" | "slack";
```

Remove the mixmax entry from INTEGRATION_SERVICES (lines 46-52):
```typescript
// Delete:
  mixmax: {
    label: "Mixmax",
    description: "Track email sequences and engagement",
    color: "#FF6B4A",
    icon: "Mx",
    isOAuth: false,
  },
```

- [ ] **Step 7: Remove Mixmax from ProfileSidebar integrations**

In `src/features/home/components/ProfileSidebar.tsx`, remove the Mixmax integration chip (line 45):

```typescript
// Old:
const INTEGRATIONS: Integration[] = [
  { name: "Calendar", icon: Calendar, status: "connected" },
  { name: "Gmail", icon: Mail, status: "setup" },
  { name: "Mixmax", icon: Zap, status: "setup" },
  { name: "Slack", icon: MessageSquare, status: "connected" },
  { name: "Rippling", icon: CircleDollarSign, status: "setup" },
];

// New:
const INTEGRATIONS: Integration[] = [
  { name: "Calendar", icon: Calendar, status: "connected" },
  { name: "Gmail", icon: Mail, status: "setup" },
  { name: "Slack", icon: MessageSquare, status: "connected" },
  { name: "Rippling", icon: CircleDollarSign, status: "setup" },
];
```

Also remove the `Zap` import from lucide-react since it was only used for Mixmax:
```typescript
// Remove Zap from the import:
import {
  Calendar,
  Clock,
  Mail,
  // Zap,  ← delete
  MessageSquare,
  ...
```

- [ ] **Step 8: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: No type errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: remove Mixmax integration (enrichment, connect/campaign modals, API routes)"
```

---

## Task 8: Final verification

Run full TypeScript check and test suite to verify nothing is broken.

- [ ] **Step 1: TypeScript compilation check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run test suite**

Run: `npx vitest run`
Expected: All tests pass (some test files were deleted, remaining tests should pass).

- [ ] **Step 3: Fix any remaining issues**

If there are type errors or test failures, trace each error to its source and fix it. Common issues:
- Stale imports that reference deleted files
- Type narrowing issues from removed union members
- Test mocks that reference deleted modules

- [ ] **Step 4: Verify empty directories are cleaned up**

```bash
find src/features/explore src/features/progress src/features/goals src/features/mixmax src/app/api/explore src/app/api/progress src/app/api/team-progress src/app/api/integrations/mixmax -type d 2>/dev/null
```

Expected: No directories found (all deleted).

- [ ] **Step 5: Final commit (if fixes needed)**

```bash
git add -A
git commit -m "fix: resolve remaining issues from dead code cleanup"
```
