# Remove Data Snapshots & Data Reconciliation Tab — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the entire data reconciliation feature (snapshots, Data tab, API routes, scripts, hooks) now that data discrepancy issues are resolved.

**Architecture:** Straightforward deletion of files and removal of references. No new code. The Data tab is self-contained so removal is clean.

**Tech Stack:** Next.js, TypeScript, Zustand

---

### Task 1: Delete snapshot files and scripts

**Files:**
- Delete: `data/snapshots/` (entire directory)
- Delete: `scripts/snapshot-data.ts`
- Delete: `scripts/com.territory-plan.snapshot.plist`

**Step 1: Delete the files**

```bash
rm -rf data/snapshots/
rm scripts/snapshot-data.ts
rm scripts/com.territory-plan.snapshot.plist
```

**Step 2: Remove snapshot npm scripts from package.json**

In `package.json`, remove these four lines from the `"scripts"` block:

```json
"snapshot": "tsx scripts/snapshot-data.ts",
"snapshot:push": "tsx scripts/snapshot-data.ts --push",
"snapshot:install-cron": "cp scripts/com.territory-plan.snapshot.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/com.territory-plan.snapshot.plist",
"snapshot:uninstall-cron": "launchctl unload ~/Library/LaunchAgents/com.territory-plan.snapshot.plist && rm ~/Library/LaunchAgents/com.territory-plan.snapshot.plist"
```

**Step 3: Remove snapshot entries from .gitignore**

In `.gitignore`, remove the last 3 lines:

```
# Snapshot cron logs
data/snapshots/cron-stdout.log
data/snapshots/cron-stderr.log
```

**Step 4: Commit**

```bash
git add -A data/snapshots/ scripts/snapshot-data.ts scripts/com.territory-plan.snapshot.plist package.json .gitignore
git commit -m "chore: remove snapshot files, scripts, and npm commands"
```

---

### Task 2: Delete API routes

**Files:**
- Delete: `src/app/api/data/` (entire directory — contains district-profiles, reconciliation, snapshot-metadata routes)
- Delete: `src/app/api/unmatched/` (entire directory — contains unmatched and by-state routes)

**Step 1: Delete the route directories**

```bash
rm -rf src/app/api/data/
rm -rf src/app/api/unmatched/
```

**Step 2: Remove public route exclusions from middleware**

In `src/middleware.ts:84`, the matcher regex contains `|api/data/reconciliation|api/data/district-profiles|api/data/snapshot-metadata`. Remove those three segments so the matcher becomes:

```typescript
'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/tiles).*)',
```

Also update the comment on line 82 to remove "data reconciliation":

```typescript
* - API routes that should be public (tiles for map rendering)
```

**Step 3: Commit**

```bash
git add -A src/app/api/data/ src/app/api/unmatched/ src/middleware.ts
git commit -m "chore: remove data reconciliation and unmatched API routes"
```

---

### Task 3: Remove Data tab from UI and navigation

**Files:**
- Delete: `src/components/views/DataView.tsx`
- Modify: `src/app/page.tsx:12,16,30,175-176`
- Modify: `src/components/navigation/Sidebar.tsx:7,71-80,113`
- Modify: `src/lib/store.ts:5`

**Step 1: Delete DataView component**

```bash
rm src/components/views/DataView.tsx
```

**Step 2: Remove DataView from page.tsx**

In `src/app/page.tsx`:

- Remove line 12: `import DataView from "@/components/views/DataView";`
- On line 16, change `VALID_TABS` to remove `"data"`:
  ```typescript
  const VALID_TABS: TabId[] = ["home", "map", "plans", "activities", "tasks", "profile"];
  ```
- Remove lines 29-30 (the `/?tab=data` URL doc comment)
- Remove lines 175-176 (the `case "data":` and `return <DataView />;`)

**Step 3: Remove Data tab from Sidebar**

In `src/components/navigation/Sidebar.tsx`:

- On line 7, change `TabId` to remove `"data"`:
  ```typescript
  type TabId = "home" | "map" | "plans" | "activities" | "tasks" | "profile";
  ```
- Remove lines 71-80 (the `DataIcon` component)
- Remove line 113: `{ id: "data", label: "Data", icon: <DataIcon /> },`

**Step 4: Update TabId in store**

In `src/lib/store.ts:5`, remove `"data"` from the TabId union:

```typescript
export type TabId = "home" | "map" | "plans" | "activities" | "tasks" | "profile";
```

**Step 5: Verify build**

```bash
npx next build
```

Expected: Build succeeds with no TypeScript errors.

**Step 6: Commit**

```bash
git add src/components/views/DataView.tsx src/app/page.tsx src/components/navigation/Sidebar.tsx src/lib/store.ts
git commit -m "chore: remove Data tab from UI and navigation"
```

---

### Task 4: Remove reconciliation hooks and interfaces from api.ts

**Files:**
- Modify: `src/lib/api.ts:1616-1791`

**Step 1: Remove the reconciliation and snapshot code**

In `src/lib/api.ts`, delete the entire block from line 1616 (`// ===== Data Reconciliation (FastAPI) =====`) through line 1791 (closing brace of `useDistrictProfiles`), preserving the `// ===== Tasks =====` section that follows on line 1793.

This removes:
- `ReconciliationUnmatchedAccount` interface
- `ReconciliationAccountVariant` interface
- `ReconciliationFragmentedDistrict` interface
- `ReconciliationFilters` interface
- `useReconciliationUnmatched()` hook
- `useReconciliationFragmented()` hook
- `DistrictProfileOpportunities` interface
- `DistrictProfileSchools` interface
- `DistrictProfileSessions` interface
- `DistrictProfileCourses` interface
- `DistrictProfileTotals` interface
- `DistrictProfileDataQuality` interface
- `DistrictProfile` interface
- `DistrictProfileFilters` interface
- `NcesLookupResult` interface
- `useNcesLookup()` hook
- `SnapshotMetadata` interface
- `useSnapshotMetadata()` hook
- `useDistrictProfiles()` hook

**Step 2: Verify build**

```bash
npx next build
```

Expected: Build succeeds. No remaining imports of removed types/hooks.

**Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "chore: remove reconciliation hooks and interfaces from api.ts"
```

---

### Task 5: Final verification

**Step 1: Search for stale references**

```bash
grep -r "DataView\|snapshot\|reconciliation\|useDistrictProfiles\|useSnapshotMetadata\|useReconciliationUnmatched\|useReconciliationFragmented\|useNcesLookup" src/ --include="*.ts" --include="*.tsx" -l
```

Expected: No results (docs/ files are fine to keep).

**Step 2: Full build**

```bash
npx next build
```

Expected: Clean build, no errors.

**Step 3: Commit any remaining cleanup (if needed)**
