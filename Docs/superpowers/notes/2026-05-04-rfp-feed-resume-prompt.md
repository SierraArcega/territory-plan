# RFP Feed — Resume Prompt for Phase 2

**Use this prompt to start the next session.** Paste the section below the divider into a fresh Claude Code conversation to pick up the work.

---

I'm picking up the RFP Feed feature where it left off. Phase 1 (backend ingest + resolver + read API) shipped as PR #179 and was merged to main. The pipeline is live and pulling K-12 RFPs from HigherGov daily.

**Read these first** (in order, before doing anything):

1. `Docs/superpowers/specs/2026-05-04-rfp-feed-backend-spec.md` — original spec
2. `Docs/superpowers/specs/2026-05-04-rfp-feed-backend-backend-context.md` — patterns this codebase uses for ingest features
3. `Docs/superpowers/plans/2026-05-04-rfp-feed-backend.md` — implementation plan that was executed
4. `prisma/schema.prisma` — search for `model Rfp` and `model RfpIngestRun` (snake_case via @@map)
5. `src/features/rfps/lib/` — the entire feature directory (sync, normalize, resolver, client, types)
6. `src/app/api/admin/unmatched-opportunities/` — the existing admin pattern we're mirroring (route + page + filter bar + columns)

**Live state to verify before designing:**

```sql
-- How many RFPs in prod, what's the resolution rate?
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE leaid IS NOT NULL)::int AS resolved,
  COUNT(*) FILTER (WHERE leaid IS NULL)::int AS unresolved
FROM rfps;

-- What are the top unmatched agencies?
SELECT agency_key, agency_name, state_abbrev, COUNT(*) AS rfp_count
FROM rfps WHERE leaid IS NULL
GROUP BY agency_key, agency_name, state_abbrev
ORDER BY rfp_count DESC
LIMIT 30;

-- Has the daily cron been firing? Status, watermark, last error
SELECT id, status, started_at, finished_at, watermark,
       records_seen, records_resolved, records_unresolved, error
FROM rfp_ingest_runs
ORDER BY started_at DESC
LIMIT 10;
```

## What was shipped in Phase 1 (already in main)

- `Rfp` (table `rfps`) and `RfpIngestRun` (table `rfp_ingest_runs`) Prisma models with snake_case columns via `@@map`/`@map`
- `src/features/rfps/lib/`: types (zod), highergov-client (NAICS 611110 + source_type=sled by default), normalize, district-resolver (3-tier match with tuned stop-words), sync orchestrator (orphan-sweep, watermark, agency-key dedup)
- `GET /api/cron/ingest-rfps` (daily 08:15 UTC, reuses `CRON_SECRET`)
- `GET /api/rfps` minimal read endpoint with leaid/stateFips/state/q filters and cursor pagination
- 21 stop-words tuned for SEA/non-LEA name shapes (board, education, department, etc., plus number-words)
- 8 test files, all passing

**Live results from the cold-start test run:** 2,256 RFPs ingested, 58% resolution rate (varies by state: GA 87%, NC 93%, TX 87%, NY 14%, CT 13%).

## Phase 2 work — pick the order

### Priority A: Manual match UI (`AgencyDistrictMap`)

**Why now:** ~1,029 RFPs are unresolved with patterns that won't fix themselves via stop-words (NYC abbreviations, "Other Virginia Localities (Legacy)", City-of-X wrappers, charter networks). Sales reps need a way to manually map an `agency_key` to a `District.leaid` once, and have it apply to all current + future RFPs from that agency.

**Reference pattern:** Mirror `src/app/admin/unmatched-opportunities/` exactly — same admin page shell, AdminFilterBar, AdminColumnPicker, paginated route. Don't invent a new UX pattern.

**Scope (use the brainstorming + writing-plans skills):**

1. **New Prisma model `AgencyDistrictMap`:**
   ```prisma
   model AgencyDistrictMap {
     agencyKey   Int      @id @map("agency_key")
     leaid       String?  @db.VarChar(7)  // null = "intentionally non-LEA"
     source      String   @default("highergov")
     notes       String?  @db.Text
     resolvedBy  String?  @map("resolved_by")
     resolvedAt  DateTime @default(now()) @map("resolved_at")
     district    District? @relation(fields: [leaid], references: [leaid])
     @@map("agency_district_maps")
   }
   ```

2. **Resolver update** (`src/features/rfps/lib/district-resolver.ts`): check `AgencyDistrictMap` first → if mapped, use that leaid → else run name match → else null. Need to refactor signature from `resolveDistrict(name, state)` to `resolveAgency({ agencyKey, agencyName, stateAbbrev })` so the override lookup is keyed by `agency_key`.

3. **Sync update** (`src/features/rfps/lib/sync.ts`): no behavior change beyond passing `agency_key` to the resolver.

4. **Backfill migration:** when AgencyDistrictMap rows are created, the existing `Rfp` rows with that `agency_key` should re-resolve. Two options:
   - Trigger-based: on AgencyDistrictMap insert/update, `UPDATE rfps SET leaid = ... WHERE agency_key = ?`
   - Application-level: PUT endpoint runs the update inline
   The application-level path is simpler and more auditable.

5. **Admin route:** `GET /api/admin/unmatched-rfp-agencies/route.ts` — query `rfps WHERE leaid IS NULL` grouped by `agency_key` with `rfp_count`, LEFT JOIN `agency_district_maps` for any existing override. Filter, sort, paginate per `unmatched-opportunities` shape.

6. **Mutation:** `PUT /api/admin/unmatched-rfp-agencies/[agencyKey]/route.ts` — write to AgencyDistrictMap + cascade-update Rfp rows.

7. **Admin page:** `src/app/admin/unmatched-rfp-agencies/page.tsx` — mirror `unmatched-opportunities/page.tsx` exactly. Click row → search districts → confirm → row updates.

8. **Tests:** unit tests for resolver override path; route tests for admin endpoints; integration test for the cascade update.

**Scope notes:**
- One row per unique `agency_key`, NOT per RFP. Mapping Henrico County once should fix all 40 of its RFPs.
- Sales rep can also mark an agency as "intentionally non-LEA" (leaid=null in the map) so it doesn't appear in the unresolved view forever.
- Don't introduce a new auth pattern — reuse `getUser()` from `@/lib/supabase/server` like the existing admin routes.

### Priority B: Verify the deployed daily cron is firing

After PR #179 merged + Vercel env vars set:

1. Check `RfpIngestRun` table for an entry with `started_at` near 08:15 UTC daily
2. If empty: env vars missing on Vercel, OR `vercel.json` cron didn't pick up. Diagnose via Vercel Dashboard → Crons.
3. If `status='error'`: read the `error` column. Common causes:
   - HigherGov 403 (subscription lapsed or trial)
   - HigherGov field shape changed (zod schema rejection)
   - Prisma column mismatch (very unlikely since schema is deployed)
4. If `status='ok'` but `recordsResolved` looks low: a state's resolution rate may have regressed. Run the per-state breakdown SQL above.

### Priority C (smaller, if time): Abbreviation map for NY

NY is stuck at 14% because:
- HigherGov sends "NYC Department of Education", "NYS Dept. of Education"
- District table has "New York City Department Of Education", "New York State Education Department"

A small dictionary map in `district-resolver.ts` (e.g., `{ "NYC": "New York City", "NYS": "New York State", "DOE": "Department of Education" }`) applied before normalization would fix this. Keep it tiny and only add abbreviations after seeing them in real unresolved data.

## Conventions to keep

- `accountType` on `District` already covers SEA / CMO / cooperative / esa_boces / etc. Don't introduce a parallel classification.
- Sales reps don't see leaids — they're rep-facing, not engineer-facing. Admin page should display district name + state, not leaid string.
- Snake_case at the DB layer, camelCase in Prisma model fields. Always.
- Prefer many small focused commits over one big final one (per user feedback memory).

## Open questions (decide with user before implementing)

1. Should the admin page show **only unresolved agencies** (rfp_count > 0 with leaid IS NULL), or also include resolved-via-override agencies for editing? (Recommend: tab toggle.)
2. When a sales rep maps `agency_key=X → leaid=Y`, should the cascade also re-run the resolver on subsequent RFPs even if name match would have succeeded? (Recommend: AgencyDistrictMap always wins.)
3. Should "intentionally non-LEA" entries (leaid=null in map) hide the agency from the unresolved list, or just mark it as "reviewed"? (Recommend: hide unless filter is "show reviewed".)

## Tools to use

- `superpowers:brainstorming` — kickoff to align on the AgencyDistrictMap design before coding
- `superpowers:writing-plans` — write the implementation plan after spec is locked
- `superpowers:subagent-driven-development` — execute the plan task-by-task
- `superpowers:using-git-worktrees` — create a fresh worktree for Phase 2 work

## Files I'll likely touch

```
prisma/schema.prisma                                 # +AgencyDistrictMap, +relation on District
prisma/migrations/<ts>_add_agency_district_map/     # new migration
src/features/rfps/lib/district-resolver.ts          # check map first
src/features/rfps/lib/sync.ts                       # pass agency_key through
src/features/rfps/lib/__tests__/district-resolver.test.ts  # override tests
src/app/admin/unmatched-rfp-agencies/page.tsx       # admin page
src/app/admin/unmatched-rfp-agencies/AdminFilterBar.tsx
src/app/admin/unmatched-rfp-agencies/AdminColumnPicker.tsx
src/app/admin/unmatched-rfp-agencies/columns.ts
src/app/api/admin/unmatched-rfp-agencies/route.ts   # GET list
src/app/api/admin/unmatched-rfp-agencies/[agencyKey]/route.ts  # PUT mapping
src/app/api/admin/unmatched-rfp-agencies/__tests__/route.test.ts
src/lib/district-column-metadata.ts                 # remove rfps from excludedTables, register in TABLE_REGISTRY (optional, do collaboratively per memory)
```

Let's brainstorm the design first, write a spec, then a plan. Don't start coding until both are committed.
