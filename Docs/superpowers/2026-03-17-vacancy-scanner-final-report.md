# Vacancy Scanner -- Final Review Report

**Date:** 2026-03-17
**Reviewer:** Code Review Agent
**Branch:** `feature/district-search-card/exploreQA`
**Plan:** `docs/superpowers/plans/2026-03-17-vacancy-scanner-plan.md`
**Spec:** (not committed to this branch; plan references `docs/superpowers/specs/2026-03-17-vacancy-scanner-design.md`)

---

## Executive Summary

The vacancy scanner feature adds a job board scraping pipeline, API routes, and frontend UI across 37 changed files (+4,139 lines). The implementation covers all 11 planned tasks and follows the project's existing patterns well. There are several issues to address, the most serious being missing authentication on all new API routes and an N+1 query pattern in the post-processor. Overall the code is well-structured, well-documented, and integrates cleanly with existing systems.

---

## Plan Alignment

All 11 tasks from the plan are implemented:

| Task | Status | Notes |
|------|--------|-------|
| 1. Schema + migrations | Implemented (no migration file) | Schema additions are correct. Migration file was not committed. |
| 2. Platform detector + parsers | Implemented | 3 parsers (AppliTrack, OLAS, SchoolSpring) + detector. |
| 3. Claude fallback scraper | Implemented | Uses raw `fetch` to Claude API instead of `@anthropic-ai/sdk`. Playwright omitted. |
| 4. Post-processor pipeline | Implemented | All 7 sub-steps present. |
| 5. Scan API routes + queue | Implemented | 4 routes + PQueue singleton. |
| 6. Vacancies API route | Implemented | GET endpoint with summary stats. |
| 7. VacanciesCard | Implemented | Uses SignalCard wrapper with VacancyList. |
| 8. Explore modal vacancies tab | Implemented | Tab added, reuses VacancyList. |
| 9. Bulk scan UI | Implemented | BulkScanButton added to PlansView. |
| 10. Admin keyword config | Implemented | Full CRUD with VacancyConfigTab. |
| 11. Seed data | Implemented | 5 relevance + 7 exclusion rules (matches spec). |

**Beneficial deviations from plan:**
- AdminDashboard.tsx was modified instead of AdminShell.tsx (plan was incorrect; AdminDashboard owns tabs).
- Claude fallback uses raw HTTP fetch instead of `@anthropic-ai/sdk` -- avoids a heavy dependency; acceptable tradeoff.
- Playwright was not added -- the fallback uses a simple `fetch` for page HTML instead of headless browser rendering. This will not work for JS-rendered job boards, but avoids a significant deployment complexity. Acceptable for an initial release.
- VacanciesCard is in `src/features/vacancies/components/` rather than `src/features/map/components/panels/district/`. This is actually better -- it keeps vacancy code in the vacancy feature module.
- The `useVacancies` hook in `queries.ts` hits a non-existent route (`/api/vacancies?leaid=...`), but the actual components use direct `fetch` to the correct route (`/api/districts/[leaid]/vacancies`). The hook is dead code.

**Noted omissions:**
- No tests were written (plan called for tests in every task).
- No migration file committed (plan Step 1.2).
- Spec file itself is not in the branch.

---

## Critical Issues (Must Fix)

### C1. No Authentication on Any API Route

**All 6 new API routes** lack authentication checks. The project uses `getUser()` and `getAdminUser()` from `@/lib/supabase/server` -- the existing admin routes call `getAdminUser()` and the district routes call `getUser()` for write operations.

**Affected files:**
- `/src/app/api/vacancies/scan/route.ts` -- no auth (triggers scans)
- `/src/app/api/vacancies/scan/[scanId]/route.ts` -- no auth (reads scan status)
- `/src/app/api/vacancies/scan-bulk/route.ts` -- no auth (triggers bulk scans)
- `/src/app/api/vacancies/batch/[batchId]/route.ts` -- no auth (reads batch status)
- `/src/app/api/districts/[leaid]/vacancies/route.ts` -- no auth (reads vacancies)
- `/src/app/api/admin/vacancy-config/route.ts` -- no auth (CRUD on config)
- `/src/app/api/admin/vacancy-config/[id]/route.ts` -- no auth (CRUD on config)

**Risk:** Anyone can trigger expensive scan operations (including Claude API calls that cost money), read internal vacancy data, and modify admin keyword configurations without being authenticated.

**Fix:** Add `getUser()` checks to scan and vacancy routes. Add `getAdminUser()` checks to admin/vacancy-config routes. The plan explicitly called for "Validate auth (session user)" in the scan flow.

### C2. `triggeredBy` Field Always Hardcoded to `"api"`

The `VacancyScan.triggeredBy` field is always set to the string `"api"` instead of the actual user who triggered the scan. This is directly related to C1 -- once auth is added, the user's email or ID should be stored.

**Affected files:**
- `/src/app/api/vacancies/scan/route.ts` (line 55)
- `/src/app/api/vacancies/scan-bulk/route.ts` (line 78)

**Fix:** After adding auth, set `triggeredBy` to the authenticated user's email.

### C3. `useVacancies` Hook Points to Non-Existent Route (Dead Code / Wrong URL)

In `/src/features/vacancies/lib/queries.ts` (line 55-56), the `useVacancies` hook fetches from:
```
/api/vacancies?leaid=...
```

But there is no route at `/api/vacancies`. The actual route is `/api/districts/[leaid]/vacancies`. The hook is currently unused (the components use direct `fetch` to the correct path), but if anyone imports it, it will silently fail.

**Fix:** Either fix the URL to `/api/districts/${leaid}/vacancies` or remove the hook entirely. The `Vacancy` type in queries.ts also has `id: number` when the Prisma model uses `String @id @default(cuid())`.

---

## Important Issues (Should Fix)

### I1. N+1 Query Pattern in Post-Processor

The `processVacancies` function in `/src/features/vacancies/lib/post-processor.ts` calls four async database functions **per vacancy** inside a loop:

```
for (const raw of filtered) {
    categorize(raw.title);            // sync, fine
    await flagRelevance(...);         // DB query per vacancy
    await matchSchool(..., leaid);    // DB query per vacancy
    await matchContact(..., leaid);   // DB query per vacancy
    await prisma.vacancy.upsert(...); // DB query per vacancy
}
```

For a district with 50 vacancies, this is 200+ database queries. The `flagRelevance` and `matchSchool` functions each query the database for the same data every iteration.

**Fix:** Load keyword configs and school lists once before the loop:
- `flagRelevance`: Load all relevance configs once, pass them as a parameter.
- `matchSchool`: Load all schools for the leaid once, pass them as a parameter.
- `matchContact`: Could batch email lookups.

### I2. No Retry Logic in Scan Runner

The plan (Task 5) specifies "On error: status=failed, errorMessage, retry once." The implementation in `/src/features/vacancies/lib/scan-runner.ts` has no retry logic -- it immediately marks the scan as failed on any error.

**Fix:** Wrap the parsing step in a try/catch with a single retry before marking as failed.

### I3. `completed_partial` Status Never Set

The plan specifies that when a scan finds 0 results but the district had >3 open vacancies, the scan status should be set to `completed_partial`. The post-processor in `/src/features/vacancies/lib/post-processor.ts` implements the partial-scrape safety logic (skipping closure of existing vacancies) but never returns an indicator that partial completion occurred. The scan runner in `/src/features/vacancies/lib/scan-runner.ts` (line 112) always sets status to `"completed"`.

**Fix:** Have `processVacancies` return a `partial: boolean` flag, and use it in the scan runner to set the status to `"completed_partial"` when appropriate.

### I4. Stale Scan Recovery Runs at Module Import Time

In `/src/features/vacancies/lib/scan-queue.ts` (line 48), `recoverStaleScans()` is called at module load time. In a serverless/edge environment (Vercel), this will run on every cold start of any request that imports this module. This means:
- Every scan trigger request also runs a recovery query.
- If the module is bundled into API routes that don't need the queue, it will unnecessarily query the database.

**Fix:** Consider making recovery explicit (called once during startup or via a cron endpoint) rather than on module import.

### I5. Duplicated Data Fetching in VacanciesCard + VacancyList

`VacanciesCard` (`/src/features/vacancies/components/VacanciesCard.tsx`) fetches vacancies via TanStack Query, then renders `VacancyList` which fetches the **same data** again with the same query key. While TanStack Query deduplicates concurrent requests, this creates an unnecessarily coupled data flow.

The comment on line 24 says "Use the same query key as VacancyList so data is shared" -- but the `VacanciesCard` only uses `summary.totalOpen` and `summary.fullmindRelevant` from the response. This tight coupling means both components must keep their `queryFn` implementations in sync.

**Fix:** Extract the shared query into a custom hook (like the unused `useVacancies` in queries.ts, but with the correct URL) and use it in both components.

### I6. `require.main === module` in ESM Context

The seed script (`/src/features/vacancies/lib/seed-vacancy-keywords.ts`, line 166) uses `require.main === module`, which does not work in ESM modules. If the project uses ESM (Next.js app router typically does), this guard will never be true.

**Fix:** Remove the `require.main` guard or use a separate entry-point script that imports and calls `seedVacancyKeywords()`.

### I7. Bulk Scan Creates Scans Sequentially with Promise.all

In `/src/app/api/vacancies/scan-bulk/route.ts` (lines 74-83), scan rows are created using `Promise.all` with individual `prisma.vacancyScan.create` calls. For a territory plan with 100+ districts, this creates 100+ individual INSERT queries.

**Fix:** Use `prisma.vacancyScan.createMany` for batch creation, then query back the IDs. Similarly, the `enqueueScan` calls on line 86 could be batched.

---

## Minor Issues (Suggestions)

### M1. Hardcoded Category Rules vs. DB-Driven

The categorizer (`/src/features/vacancies/lib/categorizer.ts`) uses hardcoded keyword rules, while the role filter and relevance flagger use DB-driven `VacancyKeywordConfig` entries. This inconsistency means admins can modify exclusion/relevance keywords but not category assignments.

This is acceptable for a first release, but consider making categories configurable via `VacancyKeywordConfig` in the future by adding a `type: "category"` config type.

### M2. Duplicated `stripHtml` and `extractCells` Functions

The `stripHtml`, `extractCells`, and `isHeaderText`/`isHeaderRow` functions are nearly identical across all three parsers:
- `/src/features/vacancies/lib/parsers/applitrack.ts`
- `/src/features/vacancies/lib/parsers/olas.ts`
- `/src/features/vacancies/lib/parsers/schoolspring.ts`

**Suggestion:** Extract shared HTML utility functions into a `parsers/utils.ts` file.

### M3. `contact.id` Type Mismatch in VacancyRecord

In `/src/features/vacancies/components/VacancyList.tsx` (line 17), the `VacancyRecord` interface declares `contact: { id: string; name: string } | null`. But the API response in `/src/app/api/districts/[leaid]/vacancies/route.ts` (line 102) returns `contact.id` as a number (from Prisma's `Int` type). The `id` should be `number`.

### M4. Empty Fragment Instead of `null` in VacanciesCard Badge

In `/src/features/vacancies/components/VacanciesCard.tsx` (line 63), the badge returns `<></>` (empty fragment) when there are no open vacancies. This would be cleaner as `null` or `undefined`.

### M5. `BatchProgress` Type Import is Unused

In `/src/features/vacancies/components/BulkScanButton.tsx` (line 6), `BatchProgress` is imported as a type but then used as a type assertion cast on line 105 (`as BatchProgress | undefined`). This assertion is unnecessary -- the `data` from `useBatchProgress` already has the correct type.

### M6. No Input Length Limits on Admin Config

The admin config API routes validate that fields are non-empty but don't enforce maximum lengths. A malicious or accidental request could store extremely long keyword strings. The DB schema uses `VarChar(100)` for label and unbounded `String[]` for keywords, so the DB would catch label overflow but not keyword array size.

### M7. Platform Detector Uses `endsWith` but Plan Shows `includes`

The plan shows `hostname.includes("applitrack.com")` but the implementation uses `hostname.endsWith(".applitrack.com")`. The `endsWith` approach is actually more correct (avoids false positives from substrings like `notapplitrack.com`), but it would miss the bare domain `applitrack.com` (without subdomain). This is fine for the known job board patterns.

### M8. Missing `Content-Type` Header on Some Fetch Calls

In `/src/features/vacancies/components/BulkScanButton.tsx`, the `useBulkScan` hook (via `queries.ts`) sends POST requests through `fetchJson` which may or may not set `Content-Type: application/json`. The `VacancyList.tsx` scan trigger correctly sets the header. Verify that `fetchJson` in `api-client.ts` sets this header.

### M9. No Prisma Migration File

The plan explicitly calls for running `npx prisma migrate dev --name add-vacancy-scanner-tables`. No migration file was committed. This means deploying this branch requires running the migration manually, and there is no version-controlled record of the schema change.

---

## What Was Done Well

1. **Clean feature module boundaries.** All vacancy code lives under `src/features/vacancies/`, following the project's established feature-module pattern. The only cross-feature imports are the `SignalCard` wrapper and shared types.

2. **Correct Prisma schema design.** The new models have appropriate indexes, proper foreign key relationships, and well-chosen column types. The `@@unique([fingerprint])` constraint ensures deduplication at the database level.

3. **Robust HTML parsing.** The three platform parsers use a pragmatic approach -- regex-based extraction with fallback strategies (table then card layout). The `isHeaderRow` checks prevent false positives from table headers.

4. **Well-designed Claude fallback.** The `tool_use` approach with a structured schema for vacancy extraction is the right pattern for getting structured output from Claude. The text truncation at 80K chars prevents context window overflow.

5. **Smart fingerprint design.** Using `SHA-256(leaid + normalize(title) + normalize(schoolName))` provides stable deduplication across scans. The normalization prevents false duplicates from case/whitespace differences.

6. **Proper partial-scrape safety.** The threshold-based logic to avoid closing all vacancies on a zero-result scan prevents data loss from scraping failures.

7. **Clean UI integration.** The VacancyList component is shared between the district panel and the explore modal. The BulkScanButton has clear state management with idle/scanning/complete/error states and a progress bar.

8. **Follows existing UI patterns.** Uses the same color palette (Plum `#403770`, Deep Coral `#F37167`, Steel Blue `#6EA3BE`), the same SignalCard wrapper, and TanStack Query patterns consistent with the rest of the codebase.

---

## Recommended Priority Order for Fixes

1. **C1** -- Add authentication to all API routes (security)
2. **C2** -- Use actual user identity for triggeredBy (depends on C1)
3. **C3** -- Fix or remove dead `useVacancies` hook and `Vacancy` type
4. **I1** -- Fix N+1 queries in post-processor (performance)
5. **I3** -- Implement `completed_partial` status (correctness)
6. **I2** -- Add retry logic to scan runner (reliability)
7. **I4** -- Move stale scan recovery out of module import (serverless safety)
8. **I5** -- Extract shared vacancy query hook (maintainability)
9. **M9** -- Generate and commit the Prisma migration file (deployment)
