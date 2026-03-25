# Shared AppliTrack Vacancy Mis-mapping Fix

**Date:** 2026-03-20
**Problem:** Small districts with shared AppliTrack URLs are getting the entire region's vacancies mapped to them (e.g., Pelican City AK — 12 students, 521 open vacancies from all over Alaska).

## Root Cause

1. `isStatewideBoard("applitrack", url)` calls `isSharedAppliTrack(url)` which does a **synchronous cache check**. If `sharedInstancesCache` is null (first scan of a cron batch, or cache expired), it returns `false`.
2. When `isStatewideBoard` returns `false`, `scan-runner.ts` skips the `groupByDistrict` redistribution path and dumps ALL raw vacancies into the single scanning district.
3. The `unknown` platform safety guard (enrollment < 5000 + 100+ vacancies) only fires for `platform === "unknown"`, not `"applitrack"`.
4. The cron route (`scan-vacancies/route.ts`) DOES call `loadSharedAppliTrackInstances()` to warm the cache, but `runScan` also calls it independently in a `Promise.all` — creating a race where processing can start before the cache is ready.

## Fix 1: Reliable Shared AppliTrack Detection

**Make `isStatewideBoard` async** for the AppliTrack path, ensuring the cache is always loaded before the check.

Changes to `platform-detector.ts`:
- Rename `isStatewideBoard` to `isStatewideBoard` (keep name) but add an `async` variant: `isStatewideBoardAsync(platform, url)` that awaits `loadSharedAppliTrackInstances()` before checking.
- `scan-runner.ts` uses the async variant since it's already async.
- `post-processor.ts` (`checkDistrictAffinity`) uses the sync variant — this is fine because it's called AFTER the scan runner has already loaded the cache.

**Also add an enrollment-based safety net** to `scan-runner.ts` for ALL platforms (not just `"unknown"`):
- If `rawVacancies.length > enrollment * 0.5` and `enrollment < 5000` and `!isStatewideBoard`, skip importing and log a warning. This catches cases where detection still fails.

## Fix 2: Cleanup + Redistribution Script

`scripts/cleanup-shared-applitrack.ts`:

1. Query DB for all shared AppliTrack instances (same query as `loadSharedAppliTrackInstances`)
2. For each instance:
   a. Get all districts pointing to that instance
   b. Delete all open vacancies across those districts (they're all duplicated regional data)
   c. Pick one representative district as the source
   d. Create a VacancyScan, fetch from the URL, run the existing redistribution pipeline (`groupByDistrict` + `redistributeInBackground` logic, but synchronous)
   e. Log results: how many vacancies redistributed to how many districts
3. Uses the same `findBestDistrict` + `processVacancies` pipeline already in scan-runner

**Dedup safety:** `processVacancies` upserts on fingerprint (SHA256 of leaid + title + schoolName). Since we delete first, there are no stale records to collide with. The fingerprint will be freshly generated with the correct leaid.

## Files Changed

| File | Change |
|------|--------|
| `src/features/vacancies/lib/platform-detector.ts` | Add `isStatewideBoardAsync`, ensure cache-first |
| `src/features/vacancies/lib/scan-runner.ts` | Use async detection, add enrollment safety net |
| `src/app/api/cron/scan-vacancies/route.ts` | Use async detection |
| `scripts/cleanup-shared-applitrack.ts` | New: one-time cleanup + redistribution |

## Risk

- **Re-scraping shared instances** will hit external job boards. Rate-limit by processing one instance at a time with a delay between.
- **Deleting vacancies** before re-scraping means a brief window with no data. Acceptable for a one-time cleanup.
- **Fingerprint collisions**: None expected — we delete first, then insert fresh.
