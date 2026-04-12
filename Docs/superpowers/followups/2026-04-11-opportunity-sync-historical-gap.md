# Follow-up: Opportunity sync drops historical years, leaving 95K orphaned sessions

## Summary

The OpenSearch opportunity sync filters by recency (~3 fiscal years deep), but the session sync brings back **all historical sessions**. This asymmetry leaves **95,345 sessions (33.1% of all sessions)** with `opportunity_id` values that point to opportunities not present in the local `opportunities` table.

These aren't bad references — the opportunity IDs are real Salesforce-format IDs, and the parent opportunities still exist in OpenSearch/Salesforce. They just aren't being synced down to the local Postgres because they're outside the active window.

## Discovered during

DB normalization work on 2026-04-11. We were about to add a `Session.opportunity_id → Opportunity.id` foreign key constraint and discovered the orphan rate during the pre-migration cleanup check.

## Numbers

| Metric | Value |
|---|---|
| Total sessions | 287,821 |
| Total opportunities | 2,565 |
| Orphaned sessions | 95,345 (33.1%) |
| Distinct missing opportunity IDs | 294 |
| Sessions in `unmatched_opportunities` table | 0 (none are tracked there) |
| Sync state | Up to date — `sync_state.last_synced_at` was 2 hours ago at investigation time |

## Opportunity counts by school year (showing the recency filter)

| School Year | Opportunity Count |
|---|---|
| 2026-27 | 345 |
| 2025-26 | 1,334 |
| 2024-25 | 747 |
| 2023-24 | 108 |
| 2022-23 | 14 |
| 2021-22 | 3 |
| 2020-21 | 2 |
| 2019-20 | 2 |
| 2018-19 | 1 |

## Orphaned session distribution by year (showing where the gap is)

| Session start_time year | Orphan Sessions | Distinct Missing Opportunity IDs |
|---|---|---|
| 2026 | 5 | 1 |
| 2025 | 314 | 13 |
| 2024 | 1,089 | 38 |
| **2023** | **24,051** | **102** |
| **2022** | **33,048** | **122** |
| **2021** | **21,101** | **94** |
| 2020 | 12,794 | 87 |
| 2019 | 2,942 | 48 |

~94K of 95K orphans are from 2019-2023.

## Likely root cause

The OpenSearch opportunity sync query is filtered by some combination of stage, close date, or fiscal year that excludes historical opportunities. The session sync doesn't apply the same filter.

## Impact

1. **Session→Opportunity foreign key cannot be added** without losing 95K linkages. We deferred adding the constraint as part of the 2026-04-11 normalization work.
2. **Financial reports** that join sessions to opportunities will under-count historical data.
3. **MCP tools** that try to navigate from a session to its opportunity will hit nulls for 33% of sessions.

## Proposed fix

One of the following:
- **Backfill option:** Run a one-time backfill of all historical opportunities from OpenSearch → local Postgres, then maintain them going forward. After this, the Session→Opportunity FK can be added.
- **Expand sync window option:** Change the OpenSearch opportunity sync query to remove the recency filter (or expand it to cover all historical years that have sessions). Pulls more data per cycle but creates referential integrity.
- **Document and accept option:** Document the asymmetry as intentional, add a NULL check helper, and don't add the FK. Cheapest but leaves 33% of sessions orphaned permanently.

## Files to investigate

- `scheduler/sync/` (Railway scheduler) — opportunity sync query and session sync query
- `prisma/migrations/20260409000000_add_opensearch_sync_fields/` — recent sync field additions
- `src/lib/opportunity-actuals.ts` — how the app reads opportunity↔session data today

## Acceptance criteria

- [ ] Investigation: identify which opportunities are missing and why
- [ ] Decide which fix option to pursue
- [ ] If backfilling: run the backfill, verify orphan count drops to 0 (or small known set)
- [ ] If FK is now safe: add `sessions.opportunity_id → opportunities.id` foreign key
- [ ] Add `Session.opportunity` Prisma relation (or remove the optional one we left in place)
- [ ] Document the decision in `Documentation/.md Files/data-model.md`
