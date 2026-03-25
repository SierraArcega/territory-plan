# Code Review: Report Builder

**Date:** 2026-03-25
**Spec:** `docs/superpowers/specs/2026-03-25-report-builder-spec.md`
**Plan:** `docs/superpowers/plans/2026-03-25-report-builder-plan.md`
**Reviewer:** Code Review Agent

---

## Summary

The Report Builder feature is a well-structured, thoughtfully implemented addition to the Territory Plan app. The implementation closely follows both the spec and the plan, with clean TypeScript throughout, proper use of existing patterns (field maps, `buildWhereClause`, `fetchJson`, DataGrid, Zustand), and good attention to brand compliance. The code is readable, maintainable, and architecturally sound.

Below are findings organized by severity.

---

## Critical (Must Fix)

### C1. Export API bypasses `fetchJson` auth headers -- potential credential loss on export

**File:** `src/features/reports/lib/queries.ts` (lines 183-208)

The `useExportReport` mutation uses raw `fetch()` instead of `fetchJson`. While this is necessary because the response is a blob (not JSON), the raw `fetch` call does not include any auth cookies/headers automatically beyond the browser default. This works now because Supabase auth uses cookies, but it is inconsistent with the rest of the codebase and fragile if auth handling changes.

More importantly, if the Supabase session expires mid-session, the export endpoint will return an HTML login redirect page as a `.csv` file. The error-handling does try `res.json().catch()` which would silently fail on HTML, but the resulting error message will be unhelpful ("Export failed: 302 Found" or similar).

**Recommendation:** Add `credentials: "include"` explicitly to the fetch call and handle redirect responses:

```ts
const res = await fetch(`${API_BASE}/reports/export`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify(payload),
});

// Check for redirect (session expired)
if (res.redirected) {
  throw new Error("Session expired - please refresh the page");
}
```

### C2. Query API has no user-scoping -- any authenticated user can query any table

**File:** `src/app/api/reports/query/route.ts`

The query endpoint validates the user is authenticated (`getUser()`) but does not scope the query to the current user's data. For example, an authenticated rep can query all opportunities, activities, or tasks for all users -- not just their own. The existing task and activity APIs scope queries to `createdByUserId: user.id`.

This is a data exposure risk. A user could build a report on the `tasks` or `activities` entity and see other users' data.

**Recommendation:** Add user-scoping logic per entity. At minimum, entities like `tasks`, `activities`, and `plans` should inject a `createdByUserId` filter. Consider adding a `userScopeField` to the entity registry:

```ts
export const ENTITY_USER_SCOPE: Record<string, string | null> = {
  districts: null,         // shared data, no scope needed
  plans: "createdBy",
  opportunities: null,     // shared CRM data
  activities: "createdByUserId",
  contacts: null,          // shared
  schools: null,           // shared
  tasks: "createdByUserId",
  states: null,            // shared
  vendorFinancials: null,  // shared
  sessions: null,          // shared
};
```

Then in the query route, merge the scope filter into the `where` clause.

### C3. Export API has the same user-scoping gap

**File:** `src/app/api/reports/export/route.ts`

Same issue as C2 -- the export endpoint runs the same query pattern without any user-scoping. Fix should follow the same approach.

---

## Important (Should Fix)

### I1. Missing `getEntityFieldMap` helper usage -- spec specified it

**File:** `src/features/reports/lib/field-maps.ts` (line 463)

The `getEntityFieldMap` function is defined but never used. The API routes access `ENTITY_FIELD_MAPS[source]` directly. This is fine functionally, but the spec called for this helper. Consider using it in the API routes for consistency, or remove it if it is not needed.

**Impact:** Low. Just dead code.

### I2. No tests for any part of the feature

**Plan reference:** Phase 1 says "Unit tests for field maps, integration tests for API routes using Vitest". Phase 4 (Task 4.3) specifies component tests, integration tests, and hook tests.

No `__tests__/` directories were created under `src/features/reports/` or `src/app/api/reports/`. This is a significant gap relative to the plan.

**Recommendation:** At minimum, add:
- Unit tests for `columnKeyToLabel` and `buildColumnMeta` in `field-maps.ts`
- Unit tests for the `serializeValue` and `escapeCsvValue` functions
- Component tests for `FilterBuilder` (the most complex UI component)
- A basic integration test that verifies the schema API returns expected entities

### I3. `serializeValue` is duplicated between query and export routes

**Files:** `src/app/api/reports/query/route.ts` (line 147), `src/app/api/reports/export/route.ts` (line 139)

Two slightly different implementations of `serializeValue` exist:
- Query version returns `null`/`undefined` as-is
- Export version returns `""` for `null`/`undefined`

The difference is intentional (JSON vs CSV), but the core logic (bigint, Date, Decimal handling) is duplicated. This is a maintenance risk -- if a new Prisma type needs handling, it must be updated in both places.

**Recommendation:** Extract a shared `serializePrismaValue` into a utility (e.g., in `field-maps.ts` or a new `src/features/reports/lib/serialize.ts`), and let each caller handle the null case.

### I4. CSV injection vulnerability in export

**File:** `src/app/api/reports/export/route.ts` (line 149)

The `escapeCsvValue` function properly quotes fields containing commas, quotes, and newlines. However, it does not guard against CSV injection. Values starting with `=`, `+`, `-`, or `@` can be interpreted as formulas by spreadsheet applications like Excel.

**Recommendation:** Prepend a single quote or tab character to values that start with formula-triggering characters:

```ts
function escapeCsvValue(value: unknown): string {
  let str = String(value ?? "");
  // Guard against CSV formula injection
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

### I5. ShareModal requires entering raw user IDs

**File:** `src/features/reports/components/ShareModal.tsx`

The spec says "Share report with teammates via link or user selection." The current implementation requires typing raw user UUIDs, which is not user-friendly. Users would need to know the UUID of the person they want to share with.

**Recommendation for v1:** At minimum, fetch the team's user list and present a searchable dropdown of names/emails. The app already has `UserProfile` data. This could be a follow-up, but it should be tracked.

### I6. Share button is enabled before the report is saved

**File:** `src/features/reports/components/ReportConfigBar.tsx` (line 111)

The Share button is enabled when `config.source` has a value, but for a new (unsaved) report, `reportId` is null. In `ReportBuilder.tsx` (line 287), the ShareModal is only rendered when `reportId` exists. This means clicking Share on a new report does nothing visible -- no modal, no feedback.

**Recommendation:** Disable the Share button when `reportId` is null (new unsaved report), or show a toast saying "Save your report first to share it."

### I7. `useEffect` missing `initialized` in dependency array (lint warning likely)

**File:** `src/features/reports/components/ReportBuilder.tsx` (line 66)

```ts
useEffect(() => {
  if (savedReport && !initialized) { ... }
}, [savedReport, initialized]);
```

The `initialized` value is local state but is also used inside the effect to gate execution. This is correct behavior. However, the effect also calls `setConfig` and `setReportName` which are stable setState functions -- no issue there. Just noting that this pattern is fine but should have a comment explaining why it is intentional.

---

## Suggestions (Nice to Have)

### S1. Consider using Lucide icons instead of inline SVGs

**Files:** All report components (`ReportsList.tsx`, `ReportConfigBar.tsx`, `ColumnPicker.tsx`, `FilterBuilder.tsx`, `ShareModal.tsx`, `ReportBuilder.tsx`)

The project convention says "Icons: Lucide only, currentColor, semantic sizing" (from `CLAUDE.md`). The report components use inline SVG elements instead of Lucide components. The `FeedTab.tsx` file (which was modified) already imports from `lucide-react` (`Rocket`, `Users`, `BarChart3`). The Sidebar also uses inline SVGs, so there is precedent for both approaches, but the spec recommends Lucide.

**Recommendation:** Replace inline SVGs with Lucide equivalents: `Plus`, `ChevronLeft`, `Save`, `Share2`, `Download`, `X`, `BarChart3`, `Search`.

### S2. Column dropdown stays open after adding -- consider keeping it open for bulk adding

**File:** `src/features/reports/components/ColumnPicker.tsx` (line 49)

Currently, `addColumn` closes the dropdown after each selection. When building a report, users will typically want to add several columns at once. Consider keeping the dropdown open after adding a column (just close when clicking outside or pressing Escape).

### S3. Filter popover could benefit from keyboard navigation

**File:** `src/features/reports/components/FilterBuilder.tsx`

The filter popover has a 3-step flow (column, operator, value) which works well with mouse interaction. Adding keyboard navigation (arrow keys, Enter to select) would improve accessibility.

### S4. No save success feedback

**File:** `src/features/reports/components/ReportBuilder.tsx` (line 148)

The `onSuccess` callback for `saveMutation` is empty (comment says "Stay on builder after save"). There is no visual feedback that the save succeeded. Consider adding a brief "Saved" indicator (toast or temporary button text change).

### S5. Consider extracting the confirmation-delete pattern

**File:** `src/features/reports/components/ReportsList.tsx` (lines 20-29)

The two-click delete pattern (first click shows "Confirm Delete", second click deletes) is a nice UX pattern. However, once the user clicks "Confirm Delete" and then clicks elsewhere without confirming, the `deletingId` state persists until the user clicks delete on another item. Consider resetting it on a timer or on blur.

### S6. `ENTITY_FIELD_MAPS` imports `DISTRICT_FIELD_MAP` and `PLANS_FIELD_MAP` from explore

**File:** `src/features/reports/lib/field-maps.ts` (lines 4-7)

This creates a cross-feature dependency (reports depends on explore). This is architecturally reasonable since the field maps are shared data, but if the explore module is ever refactored, this import path will break. Consider moving the shared field maps to `src/features/shared/lib/field-maps.ts` in the future.

### S7. Page size not validated in the export endpoint

**File:** `src/app/api/reports/export/route.ts`

The query endpoint validates and clamps `pageSize` to `[1, 200]`. The export endpoint uses a hardcoded `MAX_EXPORT_ROWS = 10_000` which is good, but there is no validation that `columns` or `filters` are within reasonable bounds. With 155+ district columns and complex filters, a single export could generate a very large CSV. Consider logging or monitoring large exports.

---

## Plan Alignment Scorecard

| Plan Task | Status | Notes |
|-----------|--------|-------|
| 1.1 Database Schema | Done | Matches spec exactly. Includes `@@index([createdBy])` beyond spec. Good. |
| 1.2 Field Maps | Done | All 10 entities covered. Column type metadata implemented. |
| 1.3 Schema API | Done | Returns entities with typed columns as specified. |
| 1.4 Query API | Done | Dynamic Prisma access, serialization, pagination all working. |
| 1.5 Export API | Done | CSV generation with proper escaping. 10k row limit. |
| 1.6 CRUD API | Done | All 6 endpoints implemented with proper auth. |
| 2.1 Types | Done | All types defined, FilterDef/FilterOp re-exported. |
| 2.2 TanStack Query Hooks | Done | All 8 hooks implemented following existing patterns. |
| 3.1 Navigation Integration | Done | Sidebar, AppShell, app-store all updated. |
| 3.2 ReportsView | Done | List/builder routing with state management. |
| 3.3 ReportsList | Done | Cards with delete, empty state, loading, error. |
| 3.4 ReportConfigBar | Done | 3-row layout matching spec wireframe. |
| 3.5 SourceSelector | Done | Dropdown with entity labels and loading skeleton. |
| 3.6 ColumnPicker | Done | Pill-based with search. No drag-to-reorder (noted as skip-if-complex in plan). |
| 3.7 FilterBuilder + FilterPill | Done | 3-step popover flow, all filter ops by type. |
| 3.8 ShareModal | Done | Basic implementation (raw IDs, not user search). |
| 3.9 ReportBuilder | Done | Composes all sub-components with DataGrid. |
| 4.1 Home Dashboard Entry Point | Done | Reports quick-access button in FeedTab. |
| 4.2 Loading/Empty/Error States | Done | All states handled as specified. |
| 4.3 Tests | **Not Done** | No tests created. See I2. |

**Plan adherence: 20/21 tasks completed (95%)**

---

## Code Quality Checklist

| Check | Status |
|-------|--------|
| No `any` types | Pass |
| No `@ts-ignore` / `@ts-expect-error` | Pass |
| No Tailwind grays (slate, zinc, gray, neutral, stone) | Pass |
| Brand colors from tokens.md | Pass |
| `fetchJson` used for JSON APIs | Pass |
| `getUser()` auth check on all routes | Pass |
| `export const dynamic = "force-dynamic"` on all routes | Pass |
| Consistent error response format `{ error: string }` | Pass |
| DataGrid integration follows existing patterns | Pass |
| TanStack Query hooks follow project conventions | Pass |
| Components are `"use client"` where needed | Pass |
| Feature files in correct directory structure | Pass |
| Proper Prisma model with `@@map` and `@map` | Pass |
| `UserProfile` relation added correctly | Pass |

---

## Architecture Assessment

The implementation follows SOLID principles well:
- **Single Responsibility:** Each component has a clear, focused purpose.
- **Open/Closed:** The field map registry is extensible -- new entities can be added without modifying existing code.
- **Dependency Inversion:** Components depend on hooks/types abstractions, not concrete API details.

The config-driven query pattern is a good architectural choice -- it keeps the frontend clean and pushes query complexity to the backend where it can be validated and optimized.

The dynamic Prisma model access (`prisma[modelName]`) is the right approach for a generic query builder. The type casting to `PrismaDelegate` is clean and minimal.

---

## Final Verdict

**Overall: Strong implementation.** The feature is well-built, follows existing patterns, and closely matches the spec. The critical items (C1-C3) should be addressed before merging as they represent security/data-exposure concerns. The important items (I2-I6) should be tracked for near-term follow-up. The suggestions are quality-of-life improvements that can be addressed iteratively.

Priority action items:
1. Add user-scoping to query and export APIs (C2, C3)
2. Fix export auth handling (C1)
3. Address CSV injection (I4)
4. Add tests (I2)
5. Fix Share button enabled state for unsaved reports (I6)
