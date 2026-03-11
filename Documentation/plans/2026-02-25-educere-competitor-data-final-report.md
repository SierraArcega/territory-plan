# Feature Report: Educere Competitor Data Integration

**Date:** 2026-02-25
**Status:** Needs Attention

## Summary

Adds Educere as a fourth competitor vendor across the full Territory Planner data pipeline: a standalone Python ETL loader script, materialized view SQL updates for FY24-FY27, map tile/layer integration with Plum palette, and a new "Competitor Spend" section in the PurchasingHistoryCard. The existing `competitor_spend.py` TRUNCATE was replaced with a targeted DELETE to prevent Educere data loss on re-runs.

## Changes

| File | Action | Lines |
|------|--------|-------|
| `scripts/etl/loaders/load_educere_data.py` | Created | +348 |
| `scripts/district-map-features-view.sql` | Modified | +25/-11 |
| `scripts/etl/loaders/competitor_spend.py` | Modified | +3/-3 |
| `src/features/map/lib/layers.ts` | Modified | +20/-2 |
| `src/features/map/lib/palettes.ts` | Modified | +4/-3 |
| `src/features/map/lib/palette-storage.ts` | Modified | +2/-1 |
| `src/features/map/lib/store.ts` | Modified | +1/-1 |
| `src/features/map/lib/__tests__/layers.test.ts` | Modified | +22/-4 |
| `src/features/map/lib/__tests__/palettes.test.ts` | Modified | +24/-2 |
| `src/app/api/tiles/[z]/[x]/[y]/route.ts` | Modified | +1/-1 |
| `src/app/api/districts/[leaid]/competitor-spend/route.ts` | Modified | +1/-0 |
| `src/app/api/districts/summary/compare/route.ts` | Modified | +1/-1 |
| `src/app/api/districts/leaids/route.ts` | Modified | +1/-1 |
| `src/features/map/components/MapV2Container.tsx` | Modified | +1/-1 |
| `src/features/map/components/panels/district/PurchasingHistoryCard.tsx` | Modified | +86/-5 |
| `src/features/map/components/panels/district/DistrictDetailPanel.tsx` | Modified | +1/-1 |
| `src/features/map/components/panels/district/tabs/PlanningTab.tsx` | Modified | +1/-1 |

**Uncommitted (on disk but not in the commit):**

| File | Action | Lines |
|------|--------|-------|
| `src/app/api/tiles/[z]/[x]/[y]/__tests__/route.test.ts` | Modified (unstaged) | +87 |
| `src/features/map/components/panels/district/__tests__/PurchasingHistoryCard.test.tsx` | Created (untracked) | +296 |

## Test Results

- New tests (committed in layers.test.ts + palettes.test.ts): updates to existing parameterized test blocks + 7 new Educere-specific test cases
- New tests (uncommitted on disk): 7 route.test.ts tests + 9 PurchasingHistoryCard.test.tsx tests
- Total suite: 693 total, 684 passing, 9 pre-existing failures (not from this change)
- All Educere-related tests pass

## Design QA

Passed -- 7 UI files reviewed, all brand-compliant. Colors, typography, spacing, accessibility all correct.

## Code Review Findings

### Strengths

- **Clean incremental architecture**: The implementation leverages existing infrastructure perfectly. Adding a competitor is purely additive with no architectural changes required, and the code follows established patterns exactly.
- **TRUNCATE fix is well-executed**: Changing `TRUNCATE TABLE competitor_spend` to a targeted `DELETE WHERE competitor IN (...)` is the correct safety fix. Parameterized query in the Educere loader (`DELETE ... WHERE competitor = %s`) prevents SQL injection.
- **TypeScript type safety**: Extending the `VendorId` union type forces compile-time completeness checks on all `Record<VendorId, ...>` literals. The compiler enforces that every vendor record includes `educere`. No `any` types or `@ts-ignore` directives.
- **Consistent patterns**: The ETL script follows `competitor_spend.py` conventions. The Educere vendor config, fill expression, palette entry, and test additions all mirror the existing Proximity/Elevate/TBT patterns precisely.
- **Hardcoded vendor list replaced**: `MapV2Container.tsx` line 356 correctly replaces the hardcoded `["fullmind", "proximity", "elevate", "tbt"]` with `VENDOR_IDS`, and `palettes.ts` replaces its local `vendorIds` array with the imported `VENDOR_IDS` constant. This prevents future drift.
- **Edge cases handled**: Empty NCES IDs, 6-digit IDs (zero-padded), FY column read directly, aggregation by district-FY, LEAID validation against districts table, and idempotent re-runs.
- **PurchasingHistoryCard enhancement is clean**: The competitor spend section renders conditionally, uses the existing API, sorts by total spend descending, handles singular/plural PO labels, and correctly updates visibility logic to show the card when either Fullmind or competitor data exists.
- **Security is solid**: All database queries use Prisma parameterized queries (competitor-spend API) or `%s` placeholders (ETL scripts). No XSS risk -- React handles escaping. API routes validate vendor input against allowlists (`VALID_VENDORS`). No sensitive data exposed.
- **`PREFS_VERSION` bump**: Correctly bumped from 3 to 4 to clear stale localStorage palette caches that lack Educere keys.

### Issues

| Severity | Description | File | Recommendation |
|----------|-------------|------|----------------|
| Important | **Test files not committed.** The route.test.ts changes (+87 lines, 7 new tests) are unstaged, and PurchasingHistoryCard.test.tsx (+296 lines, 9 new tests) is untracked. These 16 tests exist on disk and pass, but are not part of the commit `dbc6782`. They must be staged and committed before merge. | `src/app/api/tiles/[z]/[x]/[y]/__tests__/route.test.ts`, `src/features/map/components/panels/district/__tests__/PurchasingHistoryCard.test.tsx` | Stage both test files and create a follow-up commit (or amend the existing one) to include them. |
| Minor | **Unicode escape replacement in arrow characters.** The diff shows `"\u2191"`, `"\u2193"`, `"\u2014"` replacing the original arrow/dash characters. This is functionally equivalent and renders identically -- likely an artifact of the editor or formatter. Not a bug, but worth noting the change is cosmetic. | `PurchasingHistoryCard.tsx:157` | No action needed. |
| Minor | **`buildDefaultCategoryOpacities` VENDOR_OPACITIES typed as `Record<string, number>` instead of `Record<VendorId, number>`.** The internal `VENDOR_OPACITIES` map in `palettes.ts` line 339 is typed as `Record<string, number>`, which means adding a new vendor to `VendorId` would not produce a compile error if the opacity entry were missing. The PRD specified `Record<VendorId, number>` but the implementation uses the looser type. | `src/features/map/lib/palettes.ts:339` | Consider tightening to `Record<VendorId, number>` for compile-time safety, matching the PRD spec and the pattern in `palette-storage.ts:14`. |

## Recommendation

**NEEDS ATTENTION** -- The implementation is thorough, correct, and follows all codebase patterns. The single important issue is that **16 test files (2 files) are not committed** -- they exist on disk and pass, but must be staged and included in the commit before this feature is merged. Once the test files are committed, this feature is ready for human review.
