# Project Audit & Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize src/components/ and src/lib/ into a feature-based src/features/ structure with consistent naming, split the monolithic api.ts, and remove dead code.

**Architecture:** Create src/features/ with directories per product feature (map, plans, tasks, activities, calendar, goals, progress, districts, shared). Each feature owns its components/, lib/, hooks/, and types. The 2,575-line api.ts splits into feature-local queries.ts files with a temporary re-export barrel.

**Tech Stack:** Next.js 16 (App Router), TypeScript, React 19, Zustand, React Query, Prisma

---

## Phase 0: Preparation

### Task 0.1: Verify clean baseline

**Step 1: Run the build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Run existing tests**

Run: `npx vitest run`
Expected: All 9 test files pass

**Step 3: Commit any outstanding changes**

Run: `git status`
If there are uncommitted changes, commit them before starting the reorganization.

---

## Phase 1: Create Feature Directory Structure

### Task 1.1: Scaffold feature directories

**Files:**
- Create: `src/features/map/components/` (empty, will be populated)
- Create: `src/features/map/lib/`
- Create: `src/features/map/hooks/`
- Create: `src/features/plans/components/`
- Create: `src/features/plans/lib/`
- Create: `src/features/tasks/components/`
- Create: `src/features/tasks/lib/`
- Create: `src/features/activities/components/`
- Create: `src/features/activities/lib/`
- Create: `src/features/calendar/components/`
- Create: `src/features/calendar/lib/`
- Create: `src/features/goals/components/`
- Create: `src/features/goals/lib/`
- Create: `src/features/progress/components/`
- Create: `src/features/districts/lib/`
- Create: `src/features/explore/lib/`
- Create: `src/features/shared/components/`
- Create: `src/features/shared/lib/`
- Create: `src/features/shared/types/`

**Step 1: Create all directories**

```bash
mkdir -p src/features/{map/{components,lib,hooks},plans/{components,lib},tasks/{components,lib},activities/{components,lib},calendar/{components,lib},goals/{components,lib},progress/components,districts/lib,explore/lib,shared/{components,lib,types}}
```

**Step 2: Add .gitkeep files to empty directories**

```bash
find src/features -type d -empty -exec touch {}/.gitkeep \;
```

**Step 3: Commit**

```bash
git add src/features/
git commit -m "chore: scaffold feature-based directory structure"
```

---

## Phase 2: Move & Rename Lib Files (Feature-Specific)

Move lib files that belong to a single feature. Update all imports after each move. Build-verify after each task.

### Task 2.1: Move map-specific lib files

**Files:**
- Move: `src/lib/map-v2-store.ts` → `src/features/map/lib/store.ts`
- Move: `src/lib/map-v2-layers.ts` → `src/features/map/lib/layers.ts`
- Move: `src/lib/map-v2-ref.ts` → `src/features/map/lib/ref.ts`
- Move: `src/lib/geocode.ts` → `src/features/map/lib/geocode.ts`

**Step 1: Move files**

```bash
mv src/lib/map-v2-store.ts src/features/map/lib/store.ts
mv src/lib/map-v2-layers.ts src/features/map/lib/layers.ts
mv src/lib/map-v2-ref.ts src/features/map/lib/ref.ts
mv src/lib/geocode.ts src/features/map/lib/geocode.ts
```

**Step 2: Update internal imports within moved files**

In `src/features/map/lib/store.ts`:
- `@/lib/explore-filters` → `@/features/explore/lib/filters` (do this AFTER Task 2.2)
- `@/lib/map-v2-layers` → `@/features/map/lib/layers`
- `@/lib/account-types` → `@/features/shared/types/account-types` (do this AFTER Task 2.5)

**TEMPORARY**: Until explore-filters and account-types are moved, create re-export barrels at old paths:

Create `src/lib/map-v2-store.ts`:
```typescript
export * from "@/features/map/lib/store";
```

Create `src/lib/map-v2-layers.ts`:
```typescript
export * from "@/features/map/lib/layers";
```

Create `src/lib/map-v2-ref.ts`:
```typescript
export * from "@/features/map/lib/ref";
```

Create `src/lib/geocode.ts`:
```typescript
export * from "@/features/map/lib/geocode";
```

**Step 3: Update all 32 importers of map-v2-store**

Find-and-replace `@/lib/map-v2-store` → `@/features/map/lib/store` in all files under `src/components/map-v2/`.

**Step 4: Update all 3 importers of map-v2-layers**

Find-and-replace `@/lib/map-v2-layers` → `@/features/map/lib/layers` in:
- `src/components/map-v2/MapV2Container.tsx`
- `src/components/map-v2/LayerBubble.tsx`

**Step 5: Update 1 importer of map-v2-ref**

In `src/components/map-v2/MapV2Container.tsx`: `@/lib/map-v2-ref` → `@/features/map/lib/ref`

**Step 6: Update 2 importers of geocode**

- `src/app/api/accounts/route.ts`: `@/lib/geocode` → `@/features/map/lib/geocode`
- `src/components/map-v2/panels/HomePanel.tsx`: `@/lib/geocode` → `@/features/map/lib/geocode`

**Step 7: Build verify**

Run: `npm run build`
Expected: Build succeeds

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: move map lib files to features/map/lib"
```

### Task 2.2: Move explore-filters

**Files:**
- Move: `src/lib/explore-filters.ts` → `src/features/explore/lib/filters.ts`

**Step 1: Move file**

```bash
mv src/lib/explore-filters.ts src/features/explore/lib/filters.ts
```

**Step 2: Create re-export barrel at old path**

Create `src/lib/explore-filters.ts`:
```typescript
export * from "@/features/explore/lib/filters";
```

**Step 3: Update 5 importers**

- `src/features/map/lib/store.ts`: `@/lib/explore-filters` → `@/features/explore/lib/filters`
- `src/app/api/explore/[entity]/route.ts`: update
- `src/app/api/territory-plans/[id]/districts/route.ts`: update
- `src/app/api/districts/batch-edits/route.ts`: update
- `src/app/api/districts/batch-tags/route.ts`: update

**Step 4: Remove barrel** (src/lib/explore-filters.ts re-export is now unnecessary)

**Step 5: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move explore-filters to features/explore/lib"
```

### Task 2.3: Move calendar lib files

**Files:**
- Move: `src/lib/calendar-sync.ts` → `src/features/calendar/lib/sync.ts`
- Move: `src/lib/calendar-push.ts` → `src/features/calendar/lib/push.ts`
- Move: `src/lib/google-calendar.ts` → `src/features/calendar/lib/google.ts`

**Step 1: Move files**

```bash
mv src/lib/calendar-sync.ts src/features/calendar/lib/sync.ts
mv src/lib/calendar-push.ts src/features/calendar/lib/push.ts
mv src/lib/google-calendar.ts src/features/calendar/lib/google.ts
```

**Step 2: Update internal imports between these files**

In `src/features/calendar/lib/sync.ts`:
- `@/lib/google-calendar` → `@/features/calendar/lib/google`

In `src/features/calendar/lib/push.ts`:
- `@/lib/google-calendar` → `@/features/calendar/lib/google`
- `@/lib/calendar-sync` → `@/features/calendar/lib/sync`

**Step 3: Update external importers (API routes)**

- `src/app/api/calendar/callback/route.ts`: `@/lib/calendar-sync` → `@/features/calendar/lib/sync`
- `src/app/api/calendar/events/[id]/route.ts`: `@/lib/calendar-sync` → `@/features/calendar/lib/sync`
- `src/app/api/calendar/events/batch-confirm/route.ts`: `@/lib/calendar-sync` → `@/features/calendar/lib/sync`
- `src/app/api/calendar/sync/route.ts`: `@/lib/calendar-sync` → `@/features/calendar/lib/sync`
- `src/app/api/activities/[id]/route.ts`: `@/lib/calendar-push` → `@/features/calendar/lib/push`
- `src/app/api/activities/route.ts`: `@/lib/calendar-push` → `@/features/calendar/lib/push`
- `src/app/api/calendar/connect/route.ts`: `@/lib/google-calendar` → `@/features/calendar/lib/google`
- `src/app/api/calendar/callback/route.ts`: `@/lib/google-calendar` → `@/features/calendar/lib/google`

**Step 4: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move calendar lib files to features/calendar/lib"
```

### Task 2.4: Move plan-rollup-sync and autoTags

**Files:**
- Move: `src/lib/plan-rollup-sync.ts` → `src/features/plans/lib/rollup-sync.ts`
- Move: `src/lib/autoTags.ts` → `src/features/shared/lib/auto-tags.ts`

**Step 1: Move files**

```bash
mv src/lib/plan-rollup-sync.ts src/features/plans/lib/rollup-sync.ts
mv src/lib/autoTags.ts src/features/shared/lib/auto-tags.ts
```

**Step 2: Update 2 importers of plan-rollup-sync**

- `src/app/api/territory-plans/[id]/districts/route.ts`: `@/lib/plan-rollup-sync` → `@/features/plans/lib/rollup-sync`
- `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts`: `@/lib/plan-rollup-sync` → `@/features/plans/lib/rollup-sync`

**Step 3: Update 2 importers of autoTags**

- `src/app/api/territory-plans/[id]/districts/route.ts`: `@/lib/autoTags` → `@/features/shared/lib/auto-tags`
- `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts`: `@/lib/autoTags` → `@/features/shared/lib/auto-tags`

**Step 4: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move plan-rollup-sync and auto-tags to feature dirs"
```

### Task 2.5: Move type definition files

**Files:**
- Move: `src/lib/taskTypes.ts` → `src/features/tasks/types.ts`
- Move: `src/lib/activityTypes.ts` → `src/features/activities/types.ts`
- Move: `src/lib/outcomeTypes.ts` → `src/features/activities/outcome-types.ts`
- Move: `src/lib/contactTypes.ts` → `src/features/shared/types/contact-types.ts`
- Move: `src/lib/account-types.ts` → `src/features/shared/types/account-types.ts`

**Step 1: Move files**

```bash
mv src/lib/taskTypes.ts src/features/tasks/types.ts
mv src/lib/activityTypes.ts src/features/activities/types.ts
mv src/lib/outcomeTypes.ts src/features/activities/outcome-types.ts
mv src/lib/contactTypes.ts src/features/shared/types/contact-types.ts
mv src/lib/account-types.ts src/features/shared/types/account-types.ts
```

**Step 2: Create re-export barrels at old paths** (temporary, for gradual migration)

Create `src/lib/taskTypes.ts`:
```typescript
export * from "@/features/tasks/types";
```

Create `src/lib/activityTypes.ts`:
```typescript
export * from "@/features/activities/types";
```

Create `src/lib/outcomeTypes.ts`:
```typescript
export * from "@/features/activities/outcome-types";
```

Create `src/lib/contactTypes.ts`:
```typescript
export * from "@/features/shared/types/contact-types";
```

Create `src/lib/account-types.ts`:
```typescript
export * from "@/features/shared/types/account-types";
```

**Step 3: Update importers gradually** (can be done now or during component moves)

Priority: update the moved map lib files first:
- `src/features/map/lib/store.ts`: `@/lib/account-types` → `@/features/shared/types/account-types`

Update `src/lib/api.ts` internal type imports:
- `@/lib/activityTypes` → `@/features/activities/types`
- `@/lib/taskTypes` → `@/features/tasks/types`
- `@/lib/store` type imports → keep for now (old store still exists)

**Step 4: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move type definition files to feature dirs"
```

### Task 2.6: Move shared lib files and rename to kebab-case

**Files:**
- Move: `src/lib/dateUtils.ts` → `src/features/shared/lib/date-utils.ts`
- Keep in place: `src/lib/db.ts`, `src/lib/prisma.ts`, `src/lib/supabase/` (infrastructure, used by API routes)

**Step 1: Move dateUtils**

```bash
mv src/lib/dateUtils.ts src/features/shared/lib/date-utils.ts
```

**Step 2: Check if dateUtils is imported anywhere**

Research shows 0 component imports. If unused, mark for deletion instead. If used by API routes, update those imports.

**Step 3: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move shared lib files, standardize to kebab-case"
```

### Task 2.7: Move hooks to feature directory

**Files:**
- Move: `src/hooks/useAnimatedNumber.ts` → `src/features/map/hooks/use-animated-number.ts`
- Move: `src/hooks/useIsTouchDevice.ts` → `src/features/map/hooks/use-is-touch-device.ts`

**Step 1: Move and rename files**

```bash
mv src/hooks/useAnimatedNumber.ts src/features/map/hooks/use-animated-number.ts
mv src/hooks/useIsTouchDevice.ts src/features/map/hooks/use-is-touch-device.ts
```

**Step 2: Update importers**

- `useAnimatedNumber` is used by map-v2 focus-mode components → update to `@/features/map/hooks/use-animated-number`
- `useIsTouchDevice` is used by MapV2Container and old map components → update to `@/features/map/hooks/use-is-touch-device`

**Step 3: Remove empty src/hooks/ directory**

```bash
rm -rf src/hooks/
```

**Step 4: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move hooks to features/map/hooks, rename to kebab-case"
```

---

## Phase 3: Split api.ts

This is the largest single task. Split the 2,575-line api.ts into feature-local queries files.

### Task 3.1: Extract shared types and fetchJson from api.ts

**Files:**
- Create: `src/features/shared/lib/api-client.ts`
- Create: `src/features/shared/types/api-types.ts`

**Step 1: Create api-client.ts with shared fetch helper**

Extract the `fetchJson` function and any shared request utilities from api.ts into `src/features/shared/lib/api-client.ts`.

**Step 2: Create api-types.ts with shared interfaces**

Extract these shared types from api.ts into `src/features/shared/types/api-types.ts`:
- `District`, `FullmindData`, `DistrictEdits` → used across many features
- `Tag`, `Service`, `Contact` → shared domain types
- `User`, `UserProfile` → auth/shared types

**Step 3: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: extract shared api-client and api-types from api.ts"
```

### Task 3.2: Extract district queries

**Files:**
- Create: `src/features/districts/lib/queries.ts`

**Step 1: Move district-related hooks from api.ts**

Extract to `src/features/districts/lib/queries.ts`:
- `useDistricts`
- `useDistrictDetail`
- `useUpdateDistrictEdits`
- `useBatchEditDistricts`
- `useBatchTagDistricts`
- `useSimilarDistricts`
- `useUnmatchedByState`
- `useStateSummaries`
- `useSchoolsByDistrict`
- `useSchoolDetail`
- `useUpdateSchoolEdits`
- `useCreateAccount`
- `useDuplicateCheck`

Import shared types from `@/features/shared/types/api-types`.

**Step 2: Re-export from api.ts**

Add to api.ts:
```typescript
export * from "@/features/districts/lib/queries";
```

Remove the original function bodies from api.ts (keep the re-export).

**Step 3: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: extract district queries from api.ts"
```

### Task 3.3: Extract plan queries

**Files:**
- Create: `src/features/plans/lib/queries.ts`

**Step 1: Move plan-related hooks from api.ts**

Extract to `src/features/plans/lib/queries.ts`:
- `useTerritoryPlans`
- `useTerritoryPlan`
- `useCreateTerritoryPlan`
- `useUpdateTerritoryPlan`
- `useDeleteTerritoryPlan`
- `useAddDistrictsToPlan`
- `useRemoveDistrictFromPlan`
- `usePlanContacts`
- `usePlanDistrictDetail`
- `useUpdateDistrictTargets`

**Step 2: Re-export from api.ts & build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: extract plan queries from api.ts"
```

### Task 3.4: Extract task queries

**Files:**
- Create: `src/features/tasks/lib/queries.ts`

**Step 1: Move task-related hooks from api.ts**

Extract to `src/features/tasks/lib/queries.ts`:
- `useTasks`, `useTask`, `useCreateTask`, `useUpdateTask`, `useDeleteTask`
- `useReorderTasks`
- `useLinkTaskPlans`, `useUnlinkTaskPlan`
- `useLinkTaskDistricts`, `useUnlinkTaskDistrict`
- `useLinkTaskActivities`, `useUnlinkTaskActivity`
- `useLinkTaskContacts`, `useUnlinkTaskContact`

**Step 2: Re-export from api.ts & build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: extract task queries from api.ts"
```

### Task 3.5: Extract activity queries

**Files:**
- Create: `src/features/activities/lib/queries.ts`

**Step 1: Move activity-related hooks from api.ts**

Extract to `src/features/activities/lib/queries.ts`:
- `useActivities`, `useActivity`, `useCreateActivity`, `useUpdateActivity`, `useDeleteActivity`
- `useLinkActivityPlans`, `useUnlinkActivityPlan`
- `useLinkActivityDistricts`, `useUnlinkActivityDistrict`

**Step 2: Re-export from api.ts & build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: extract activity queries from api.ts"
```

### Task 3.6: Extract calendar queries

**Files:**
- Create: `src/features/calendar/lib/queries.ts`

**Step 1: Move calendar-related hooks from api.ts**

Extract to `src/features/calendar/lib/queries.ts`:
- `useCalendarConnection`, `useDisconnectCalendar`, `useUpdateCalendarSettings`
- `useTriggerCalendarSync`
- `useCalendarInbox`, `useCalendarInboxCount`
- `useConfirmCalendarEvent`, `useDismissCalendarEvent`, `useBatchConfirmCalendarEvents`

**Step 2: Re-export from api.ts & build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: extract calendar queries from api.ts"
```

### Task 3.7: Extract remaining queries (goals, progress, map, shared)

**Files:**
- Create: `src/features/goals/lib/queries.ts`
- Create: `src/features/progress/lib/queries.ts`
- Create: `src/features/map/lib/queries.ts`

**Step 1: Extract goals hooks**

`src/features/goals/lib/queries.ts`:
- `useUpsertUserGoal`, `useDeleteUserGoal`, `useGoalDashboard`

**Step 2: Extract progress hooks**

`src/features/progress/lib/queries.ts`:
- `useActivityMetrics`, `useOutcomeMetrics`, `usePlanEngagement`

**Step 3: Extract map hooks**

`src/features/map/lib/queries.ts`:
- `useQuantiles`, `useCustomerDots`, `useStates`, `useStateDetail`, `useStateDistricts`, `useUpdateState`, `useFocusModeData`

**Step 4: Keep shared hooks in api.ts (now much smaller)**

These remain in `src/lib/api.ts` as they're used broadly:
- `useTags`, `useCreateTag`, `useAddDistrictTag`, `useRemoveDistrictTag`, `useAddSchoolTag`, `useRemoveSchoolTag`
- `useContacts`, `useCreateContact`, `useUpdateContact`, `useDeleteContact`, `useTriggerClayLookup`
- `useSalesExecutives`, `useUsers`, `useProfile`, `useUpdateProfile`, `useLogout`
- `useServices`
- `useExploreData`
- `fetchJson` helper

**Step 5: Re-export from api.ts & build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: extract goals, progress, and map queries from api.ts"
```

### Task 3.8: Verify api.ts is now a thin barrel

**Step 1: Check that api.ts only contains**

- Shared hooks (~15 remaining)
- Shared type exports (re-exported from api-types.ts)
- Re-exports from all feature queries files
- `fetchJson` helper

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Build verify**

Run: `npm run build`
Expected: Build succeeds

---

## Phase 4: Move Components

Move component directories into their feature folders. Update all imports.

### Task 4.1: Move map-v2 components

**Files:**
- Move: `src/components/map-v2/*` → `src/features/map/components/`

**Step 1: Move the entire map-v2 directory contents**

```bash
cp -r src/components/map-v2/* src/features/map/components/
rm -rf src/components/map-v2/
```

**Step 2: Update all imports in the moved files**

All internal imports between map-v2 components use relative paths — these should still work.

Update any `@/components/map-v2/` imports across the codebase to `@/features/map/components/`:
- `src/app/map-v2/page.tsx` (or wherever MapV2Shell is imported)
- Any other files importing from `@/components/map-v2/`

**Step 3: Update imports FROM map components TO lib files**

The moved components already import from `@/lib/map-v2-store` etc. — these should already point to the new feature paths from Phase 2 barrel files. Verify and update any that still use old paths.

**Step 4: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move map-v2 components to features/map/components"
```

### Task 4.2: Move plans components

**Files:**
- Move: `src/components/plans/*` → `src/features/plans/components/`

**Step 1: Move files**

```bash
cp -r src/components/plans/* src/features/plans/components/
rm -rf src/components/plans/
```

**Step 2: Update all `@/components/plans/` imports** across the codebase to `@/features/plans/components/`

Key importers: views/PlansView.tsx, views/HomeView.tsx, panel components, map-v2 components

**Step 3: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move plans components to features/plans/components"
```

### Task 4.3: Move tasks components

**Files:**
- Move: `src/components/tasks/*` → `src/features/tasks/components/`

**Step 1: Move and update imports**

```bash
cp -r src/components/tasks/* src/features/tasks/components/
rm -rf src/components/tasks/
```

Update all `@/components/tasks/` imports.

**Step 2: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move tasks components to features/tasks/components"
```

### Task 4.4: Move activities components

**Files:**
- Move: `src/components/activities/*` → `src/features/activities/components/`

**Step 1: Move and update imports**

```bash
cp -r src/components/activities/* src/features/activities/components/
rm -rf src/components/activities/
```

Update all `@/components/activities/` imports.

**Step 2: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move activities components to features/activities/components"
```

### Task 4.5: Move calendar components

**Files:**
- Move: `src/components/calendar/*` → `src/features/calendar/components/`

**Step 1: Move and update imports**

```bash
cp -r src/components/calendar/* src/features/calendar/components/
rm -rf src/components/calendar/
```

Update all `@/components/calendar/` imports.

**Step 2: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move calendar components to features/calendar/components"
```

### Task 4.6: Move goals and user components

**Files:**
- Move: `src/components/goals/*` → `src/features/goals/components/`
- Move: `src/components/user/*` → `src/features/goals/components/`

**Step 1: Move and update imports**

```bash
cp -r src/components/goals/* src/features/goals/components/
cp -r src/components/user/* src/features/goals/components/
rm -rf src/components/goals/ src/components/user/
```

Update all `@/components/goals/` and `@/components/user/` imports.

**Step 2: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move goals and user components to features/goals/components"
```

### Task 4.7: Move progress components

**Files:**
- Move: `src/components/progress/*` → `src/features/progress/components/`

**Step 1: Move and update imports**

```bash
cp -r src/components/progress/* src/features/progress/components/
rm -rf src/components/progress/
```

**Step 2: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move progress components to features/progress/components"
```

### Task 4.8: Move shared components (common, layout, navigation, filters)

**Files:**
- Move: `src/components/common/*` → `src/features/shared/components/`
- Move: `src/components/layout/*` → `src/features/shared/components/layout/`
- Move: `src/components/navigation/*` → `src/features/shared/components/navigation/`
- Move: `src/components/filters/*` → `src/features/shared/components/filters/`
- Move: `src/components/MultiSelectActionBar.tsx` → `src/features/shared/components/MultiSelectActionBar.tsx`

**Step 1: Move files**

```bash
cp -r src/components/common/* src/features/shared/components/
mkdir -p src/features/shared/components/{layout,navigation,filters}
cp -r src/components/layout/* src/features/shared/components/layout/
cp -r src/components/navigation/* src/features/shared/components/navigation/
cp -r src/components/filters/* src/features/shared/components/filters/
cp src/components/MultiSelectActionBar.tsx src/features/shared/components/
rm -rf src/components/common/ src/components/layout/ src/components/navigation/ src/components/filters/
rm src/components/MultiSelectActionBar.tsx
```

**Step 2: Update all imports**

**Step 3: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move shared components to features/shared/components"
```

### Task 4.9: Move views components

**Files:**
- Move: `src/components/views/HomeView.tsx` → `src/features/shared/components/views/HomeView.tsx`
- Move: `src/components/views/MapView.tsx` → `src/features/shared/components/views/MapView.tsx`
- Move: `src/components/views/PlansView.tsx` → `src/features/shared/components/views/PlansView.tsx`
- Move: `src/components/views/ActivitiesView.tsx` → `src/features/shared/components/views/ActivitiesView.tsx`
- Move: `src/components/views/TasksView.tsx` → `src/features/shared/components/views/TasksView.tsx`
- Move: `src/components/views/ProfileView.tsx` → `src/features/shared/components/views/ProfileView.tsx`
- Move: `src/components/views/GoalsView.tsx` → `src/features/shared/components/views/GoalsView.tsx` (orphaned, may delete)

Views are page-level containers that compose multiple features. They belong in shared since they're all imported by `src/app/page.tsx`.

**Step 1: Move files**

```bash
mkdir -p src/features/shared/components/views
cp -r src/components/views/* src/features/shared/components/views/
rm -rf src/components/views/
```

**Step 2: Update import in `src/app/page.tsx`**

All view imports change from `@/components/views/` to `@/features/shared/components/views/`.

**Step 3: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: move view components to features/shared/components/views"
```

---

## Phase 5: Migrate Old Panel Components & Remove Dead Code

### Task 5.1: Audit and migrate active panel components

**Files:**
- Audit: `src/components/panel/` (20 files)

The old `panel/` directory has components actively imported by `features/map/components/` (district detail tabs). These need to move to `features/districts/components/` since they're district-specific UI components.

**Step 1: Identify which panel components are still actively used**

Active (imported by map-v2 panels):
- `DemographicsChart.tsx` → `features/districts/components/`
- `StudentPopulations.tsx` → `features/districts/components/`
- `AcademicMetrics.tsx` → `features/districts/components/`
- `FinanceData.tsx` → `features/districts/components/`
- `StaffingSalaries.tsx` → `features/districts/components/`
- `FullmindMetrics.tsx` → `features/districts/components/`
- `CompetitorSpend.tsx` → `features/districts/components/`
- `DistrictInfo.tsx` → `features/districts/components/`
- `TagsEditor.tsx` → `features/districts/components/`
- `NotesEditor.tsx` → `features/districts/components/`
- `ContactsList.tsx` → `features/districts/components/`
- `PipelineSummary.tsx` → `features/districts/components/`

Used by old view system only:
- `PanelContainer.tsx` → `features/shared/components/`
- `SidePanel.tsx` → evaluate if still needed
- `DistrictHeader.tsx` → evaluate if still needed
- `FindSimilarDistricts.tsx` → evaluate if still needed
- `state/` subdirectory → `features/map/components/` (state detail is map feature)
- `tabs/` subdirectory → evaluate if still needed
- `plans/PlanDashboard.tsx` → evaluate if still needed

**Step 2: Move active components**

```bash
mkdir -p src/features/districts/components
cp src/components/panel/DemographicsChart.tsx src/features/districts/components/
cp src/components/panel/StudentPopulations.tsx src/features/districts/components/
# ... (repeat for each active component)
```

**Step 3: Update imports and build verify**

**Step 4: Commit**

```bash
git add -A && git commit -m "refactor: migrate active panel components to features/districts/components"
```

### Task 5.2: Remove dead map v1 directory

**Files:**
- Delete: `src/components/map/` (9 files, 0 imports confirmed)

**Step 1: Verify no imports exist**

```bash
grep -r "@/components/map/" src/ --include="*.ts" --include="*.tsx" | grep -v "map-v2"
```

Expected: No results (confirmed 0 imports in audit)

**Step 2: Remove directory**

```bash
rm -rf src/components/map/
```

**Step 3: Commit**

```bash
git add -A && git commit -m "chore: remove dead map v1 components (replaced by map-v2)"
```

### Task 5.3: Remove orphaned GoalsView

**Step 1: Verify GoalsView is not imported**

```bash
grep -r "GoalsView" src/ --include="*.ts" --include="*.tsx"
```

If not imported anywhere, delete it. If imported, keep it.

**Step 2: Remove if confirmed orphaned**

**Step 3: Commit**

### Task 5.4: Clean up remaining panel directory

After Tasks 5.1-5.3, check what's left in `src/components/panel/`. Any remaining files that aren't imported anywhere get deleted. Files still in use get moved to appropriate feature directories.

**Step 1: Check remaining files**

```bash
ls src/components/panel/
```

**Step 2: For each remaining file, check if imported**

**Step 3: Move or delete as appropriate**

**Step 4: Remove empty panel directory**

**Step 5: Commit**

```bash
git add -A && git commit -m "chore: clean up remaining panel directory, remove unused components"
```

---

## Phase 6: Clean Up Barrel Re-exports

### Task 6.1: Remove temporary barrel files from src/lib/

Now that all components have moved and their imports updated, remove the temporary re-export barrels created in Phase 2.

**Files to delete** (if no remaining importers):
- `src/lib/map-v2-store.ts` (barrel)
- `src/lib/map-v2-layers.ts` (barrel)
- `src/lib/map-v2-ref.ts` (barrel)
- `src/lib/geocode.ts` (barrel)
- `src/lib/taskTypes.ts` (barrel)
- `src/lib/activityTypes.ts` (barrel)
- `src/lib/outcomeTypes.ts` (barrel)
- `src/lib/contactTypes.ts` (barrel)
- `src/lib/account-types.ts` (barrel)

**Step 1: For each barrel, check for remaining importers**

```bash
grep -r "@/lib/map-v2-store" src/ --include="*.ts" --include="*.tsx"
# repeat for each
```

**Step 2: Update any remaining importers to point to new locations**

**Step 3: Delete barrel files**

**Step 4: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "chore: remove temporary re-export barrels from src/lib"
```

### Task 6.2: Update api.ts importers to use feature-local queries

Now that components are in feature directories, update them to import directly from their feature's queries.ts instead of from the central api.ts barrel.

**Strategy:** Work feature-by-feature:

1. **features/map/components/**: change `@/lib/api` → `@/features/map/lib/queries` + `@/features/districts/lib/queries` etc.
2. **features/plans/components/**: change `@/lib/api` → `@/features/plans/lib/queries` + shared types
3. **features/tasks/components/**: change `@/lib/api` → `@/features/tasks/lib/queries`
4. **features/activities/components/**: change `@/lib/api` → `@/features/activities/lib/queries`
5. **features/calendar/components/**: change `@/lib/api` → `@/features/calendar/lib/queries`
6. **features/goals/components/**: change `@/lib/api` → `@/features/goals/lib/queries`
7. **features/progress/components/**: change `@/lib/api` → `@/features/progress/lib/queries`
8. **features/shared/components/views/**: these compose features, may import from multiple feature queries

**Build verify after each feature migration.**

**Commit after all features updated:**

```bash
npm run build && git add -A && git commit -m "refactor: update all components to import from feature-local queries"
```

### Task 6.3: Slim down api.ts to shared-only

**After Task 6.2**, api.ts should only contain:
- `fetchJson` helper → move to `@/features/shared/lib/api-client.ts`
- Shared hooks (tags, contacts, users, services, auth, explore)
- Shared type re-exports

Rename `src/lib/api.ts` → `src/features/shared/lib/queries.ts` and update remaining importers.

**Build verify & commit:**

```bash
npm run build && git add -A && git commit -m "refactor: move remaining shared queries, retire src/lib/api.ts"
```

---

## Phase 7: Handle Old v1 Store Migration

### Task 7.1: Audit old store usage

**File:** `src/lib/store.ts` (22 importers)

The old Zustand store is used by:
- Old map/ components (being deleted)
- filters/ (moved to shared/)
- panel/ (being migrated)
- views/ (moved to shared/views/)
- src/app/page.tsx

**Step 1: List all remaining importers after Phases 4-5**

After component moves, check which files still import from `@/lib/store`.

**Step 2: For each importer, determine if the store usage can be replaced by map-v2-store equivalents or removed**

This requires case-by-case analysis. Some files may use `useMapStore` for tab navigation (TabId) which is an app-level concern, not map-specific.

**Step 3: If the old store serves app-level concerns (tab state, selected district), refactor it**

Move to `src/features/shared/lib/app-store.ts` with clear naming:
- `useAppStore` instead of `useMapStore`
- Clean up unused state slices

**Step 4: Build verify & commit**

```bash
npm run build && git add -A && git commit -m "refactor: migrate old store to features/shared/lib/app-store"
```

---

## Phase 8: Final Verification

### Task 8.1: Full build verification

**Step 1: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Verify no broken imports**

```bash
grep -r "@/components/" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"
```

Expected: No results (all component imports should now use `@/features/`)

```bash
grep -r "@/lib/" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"
```

Expected: Only `@/lib/db.ts`, `@/lib/prisma.ts`, `@/lib/supabase/` remain (infrastructure files).

**Step 4: Verify empty src/components directory**

```bash
ls src/components/
```

Expected: Directory is empty or doesn't exist.

### Task 8.2: Clean up empty directories and .gitkeep files

```bash
find src/features -name ".gitkeep" -delete
find src/ -type d -empty -delete
```

**Commit:**

```bash
git add -A && git commit -m "chore: final cleanup, remove empty directories"
```

### Task 8.3: Smoke test the application

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Verify key pages load**

- Home page loads
- Map v2 page loads
- Plans view works
- Explore view works

**Step 3: Final commit if any fixes needed**

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 0 | 1 | Verify clean baseline |
| 1 | 1 | Create feature directory structure |
| 2 | 7 | Move & rename lib files |
| 3 | 8 | Split api.ts into feature queries |
| 4 | 9 | Move component directories |
| 5 | 4 | Migrate panel + remove dead code |
| 6 | 3 | Clean up barrels, direct imports |
| 7 | 1 | Migrate old v1 store |
| 8 | 3 | Final verification |
| **Total** | **37** | |
