# Backend Context: Leads (BDR Lead Management & Pipeline)

Date: 2026-06-10 · Worktree: `.claude/worktrees/leads` · Source handoff: `Docs/design_handoff_leads/README.md`

Two headline corrections to the handoff README, found during discovery:

1. **A `schools` table already exists** (`prisma/schema.prisma:1351`, `@@map("schools")`, PK `ncessch` VARCHAR(12)) and is already populated by the ETL's `--all-schools` mode. Do **not** create a new schools table.
2. **Opportunities are synced from OpenSearch (Fullmind LMS) by a standalone Railway scheduler, not Salesforce and not a Vercel cron.** The sync is a pure upsert keyed on `id` — it never deletes rows it doesn't know about — so **app-created opportunity rows with app-generated ids survive the sync**. Details in § Opportunity Sync Findings.

---

## Data Models (existing — exact field names)

All models in `prisma/schema.prisma`. Conventions: camelCase Prisma fields `@map`-ped to snake_case columns; tables `@@map`-ped to snake_case plural; districts keyed by `leaid` (VARCHAR(7) string PK); contacts use int autoincrement ids; activities/tasks use String uuid ids; users use Supabase uuid. Timestamps: `createdAt DateTime @default(now()) @map("created_at")`, `updatedAt DateTime @updatedAt @map("updated_at")`.

### District (`districts`, schema line 15)
- `leaid String @id @db.VarChar(7)` — the 7-digit NCES LEAID
- `name`, `stateFips` (`state_fips` VARCHAR(2)), `stateAbbrev`, `enrollment`, `cityLocation`, `countyName`, `phone`
- `accountType String @default("district")` — district | CMO | ESA etc.
- CRM: `accountName`, `lmsid`, `isCustomer Boolean?`, `hasOpenPipeline Boolean?` (both recomputed by the opp sync)
- **`ownerId` (`owner_id` UUID) → `UserProfile` via relation `"DistrictOwner"` — the canonical district ownership field** (CRM `sales_executive_id` was dropped in migration `20260604152533_drop_district_sales_executive`)
- PostGIS `pointLocation` managed outside Prisma

### School (`schools`, schema line 1351) — ALREADY EXISTS
- `ncessch String @id @db.VarChar(12)` — NCES 12-char school id (= leaid + 5-digit school number, zero-filled)
- `leaid String @db.VarChar(7)` FK → District (`@@index([leaid])`)
- `schoolName` (`school_name`), `charter Int` (0/1), `schoolLevel Int?` (`school_level`: 1=Primary, 2=Middle, 3=High, 4=Other), `schoolType`, `lograde`/`higrade`, `schoolStatus`
- Location: `latitude`, `longitude`, `streetAddress`, `city`, `stateAbbrev`, `stateFips`, `zip`, `countyName`, `phone`
- `enrollment`, Title I fields, FRPL fields, demographics fields
- Lightweight CRM already present: `ownerId UUID? → UserProfile ("SchoolOwner")`, `notes`, `notesUpdatedAt`
- Relations: `district`, `enrollmentHistory` (`school_enrollment_history`), `schoolTags`, `schoolContacts`, `vacancies`, `newsArticles`
- API already exists: `src/app/api/schools/route.ts` (+ `[ncessch]`, `by-district`, `geojson`)

### SchoolContact (`school_contacts`, schema line 1445) — junction ALREADY EXISTS
- `schoolId VARCHAR(12)` + `contactId Int`, composite PK, cascade deletes both ways.
- This already models contact↔school. The handoff's "nullable `school_nces` FK on contacts" is a design decision, not a gap-fill (see Proposed New Models).

### Contact (`contacts`, schema line 355)
- `id Int @id @default(autoincrement())`
- `leaid String @db.VarChar(7)` FK → District (`@@index([leaid])`) — contact always belongs to a district
- `salutation`, `name`, `title`, `email VARCHAR(255)?`, `phone`, `isPrimary`, `linkedinUrl`, `persona`, `seniorityLevel`, `createdAt`, `lastEnrichedAt`
- Relations: `activityLinks ActivityContact[]`, `taskLinks`, `schoolContacts SchoolContact[]`, `vacancies`, `newsArticles`
- **No unique constraint on email** — ETL dedupes on (leaid, lower(email)) with (leaid, name) fallback (`scripts/etl/loaders/contacts.py`). CSV activity-import "match contact by email" must handle multi-district duplicates.

### Activity (`activities`, schema line 685)
- `id String @id @default(uuid())`
- `type String @db.VarChar(30)` — app-validated against `ALL_ACTIVITY_TYPES`, **not a DB enum**
- `title`, `notes`, `startDate`/`endDate`, `status @default("planned")` (planned | requested | planning | in_progress | wrapping_up | completed | cancelled)
- `createdByUserId UUID?` (`created_by_user_id`) — the owner field; `source @default("manual")` (manual | calendar_sync | system; `source = "system"` rows are excluded from lists and protected from edits)
- Outcome block: `outcome VARCHAR(500)?`, `outcomeType`, `rating Int?`, `sentiment`, `nextStep`, `followUpDate`, `dealImpact @default("none")`, `outcomeDisposition` (completed | no_show | rescheduled | cancelled) — directly reusable for the "Log engagement outcome" modal
- Integration dedup keys: `googleEventId`, `gmailMessageId`, slack fields, `integrationMeta Json?`, Mixmax sequence fields (`mixmaxSequenceName/Step/Total/Status/OpenCount/ClickCount`) — relevant for lead "sequence" data
- `metadata Json?` catch-all

### Activity junctions — all confirmed to exist
- `ActivityDistrict` → `activity_districts` (line 785): `activityId` + `districtLeaid VARCHAR(7)` composite PK, plus `visitDate`, `visitEndDate`, `position`, `notes`, `warningDismissed`. Cascade delete. `@@index([districtLeaid])`.
- `ActivityContact` → `activity_contacts` (line 801): `activityId` + `contactId Int` composite PK. Cascade delete.
- `ActivityOpportunity` → `activity_opportunities` (line 811): `activityId` + `opportunityId` + `createdAt`.
- Also: `ActivityPlan`, `ActivityState`, `ActivityExpense`, `ActivityAttendee`, `ActivityRelation`, `ActivityNote`, `ActivityAttachment`.
- **There is NO `ActivitySchool` junction** — this is the one genuinely missing piece for school-keyed engagement.

### Opportunity (`opportunities`, schema line 1523)
- `id String @id @db.Text` — **no default; ids come from the LMS** (numeric-ish text). App-created rows must generate their own id.
- `stage String? @db.Text` — text values, see canonical list below
- `salesRepName`, `salesRepEmail`, `salesRepId UUID?` (resolved via `RESOLVE_OPP_REP` in `src/lib/opp-rep-sql.ts` — valid `sales_rep_id` wins, else email match)
- `districtLeaId VARCHAR(7)?` FK → District; also `districtNcesId`, `districtLmsId`, `districtName`
- `netBookingAmount Decimal(15,2)?`, `leadSource Text?`, `schoolYr`, `contractType`, `closeDate`, `stageHistory Json @default("[]")`, `syncedAt Timestamptz?` (NULL for rows the sync never touched)
- Indexes: `schoolYr`, `districtNcesId`, `districtLeaId`, `stage`, `(districtLeaId, schoolYr, stage)`, `stateFips`

**Canonical stage strings** (`src/features/views/lib/opp-stage-columns.ts:24-33`):
`"0 - Meeting Booked"`, `"1 - Discovery"`, `"2 - Presentation"`, `"3 - Proposal"`, `"4 - Negotiation"`, `"5 - Commitment"`, `"Closed Won"`, `"Closed Lost"`. Live-pipeline regex `LIVE_STAGE_REGEX = "^[0-5] - "` (`src/lib/opp-rep-sql.ts:17`). So the handoff's "Stage 0 opp" = `stage = '0 - Meeting Booked'` and "Stage 1 · Discovery" = `stage = '1 - Discovery'` — exact existing values, no new stages needed. Avoid the four erroneous child-op stage texts (`ERRONEOUS_CHILD_OP_STAGES` in `src/lib/district-column-metadata.ts:1585`).

### UserProfile (`user_profiles`, schema line 1014)
- `id String @id @db.Uuid` — **Supabase `user.id`**; `email @unique`, `fullName`, `avatarUrl`, `role UserRole @default(rep)` (enum: admin | manager | rep), `crmName`, `jobTitle`, `hasCompletedSetup`
- This is the model for "assigned BDR". There is no separate sales_reps table; rep roster = `getActiveReps()` in `src/lib/reps.ts`, served by `GET /api/reps` (`src/app/api/reps/route.ts`) — names + avatars only, no emails.
- No BDR/AE distinction today: `role` is admin/manager/rep only. "My leads vs Team" should follow the activities pattern (default scope to `user.id`, `?ownerId=all` widens) rather than a role gate.

### No existing leads-like model
Greps for lead/MQL models found nothing — only `opportunities.lead_source` (a text attribute) and the news/RFP "signals" domain. The `Lead` model is net-new.

### ActivityCategory (TS, not DB)
`src/features/activities/types.ts:3` — `ACTIVITY_CATEGORIES` const object; categories: `events`, `campaigns`, `meetings`, `outreach`, `gift_drop`, `sponsorships`, `thought_leadership`. Types under `outreach`: `email`, `cold_call`; under `meetings`: `discovery_call`, `program_check_in`, `proposal_review`, `renewal_conversation`. `getCategoryForType()` maps type→category. **Memory note**: adding a new type/category fans out into many `Record<ActivityCategory, …>` maps across calendar/map views, and some (UpcomingRail) are non-exhaustive so tsc won't catch a miss — prefer reusing existing types (`cold_call`, `email`, `discovery_call`) for lead engagement before minting new ones.

---

## Proposed New Models

### `Lead` (new table `leads`)
```prisma
model Lead {
  id                String    @id @default(uuid())
  contactId         Int       @map("contact_id")
  schoolNcessch     String?   @map("school_ncessch") @db.VarChar(12) // null = district office
  districtLeaid     String    @map("district_leaid") @db.VarChar(7)
  status            String    @default("new") @db.VarChar(20) // new|working|meeting_scheduled|sales_qualified|unqualified
  score             Int       @default(0)
  leadType          String?   @map("lead_type") @db.VarChar(30)
  sequence          String?   @db.VarChar(100)
  assignedBdrId     String?   @map("assigned_bdr_id") @db.Uuid
  marketingOwnerId  String?   @map("marketing_owner_id") @db.Uuid   // or VarChar if marketing isn't in user_profiles — open question
  unqualifiedReason String?   @map("unqualified_reason") @db.VarChar(255)
  opportunityId     String?   @map("opportunity_id")                 // the Stage 0 opp created at meeting_scheduled
  assignedAt        DateTime  @default(now()) @map("assigned_at")    // SLA clock start
  acceptedAt        DateTime? @map("accepted_at")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  contact     Contact      @relation(fields: [contactId], references: [id])
  school      School?      @relation(fields: [schoolNcessch], references: [ncessch])
  district    District     @relation(fields: [districtLeaid], references: [leaid])
  assignedBdr UserProfile? @relation("LeadAssignedBdr", fields: [assignedBdrId], references: [id])
  opportunity Opportunity? @relation(fields: [opportunityId], references: [id])

  @@index([assignedBdrId, status])   // board scoped to "my leads" by stage
  @@index([districtLeaid])
  @@index([contactId])
  @@index([status, assignedAt])      // SLA-overdue scans on New
  @@map("leads")
}
```
- House style: status as `@db.VarChar` + TS const whitelist (like `VALID_ACTIVITY_STATUSES`), **not** a Prisma enum — activities/tasks/opps all do this.
- **Do NOT cascade-delete history**: lead deletion must leave activities intact, which falls out naturally because engagement is keyed to contact/school/district junctions, never to the lead. Lead lifecycle events (accepted, restaged, disqualified) can live in a small `lead_events` table or as `activities` rows with `source = "system"` — decide in spec; a dedicated `lead_events (id, lead_id, type, payload jsonb, created_at, actor_id)` table is cleaner since `source="system"` activities are filtered out of activity lists.
- On contact delete: `Restrict` (or soft-guard in app), not cascade — a lead without a contact is meaningless but losing leads via contact merge is worse; existing contact merges are rare/scripted.

### `ActivitySchool` (new junction `activity_schools`)
Mirror `ActivityDistrict` exactly:
```prisma
model ActivitySchool {
  activityId String   @map("activity_id")
  ncessch    String   @db.VarChar(12)
  activity   Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  school     School   @relation(fields: [ncessch], references: [ncessch], onDelete: Cascade)
  @@id([activityId, ncessch])
  @@index([ncessch])
  @@map("activity_schools")
}
```

### Contact change — school attachment
Two viable shapes; pick one in the spec:
1. **Nullable scalar FK (matches the handoff)**: add `schoolNcessch String? @map("school_ncessch") @db.VarChar(12)` + relation + `@@index([schoolNcessch])` to `Contact`. "Works at exactly one school or the district office" — matches the design's School row / "District office" rendering and is trivially filterable.
2. Reuse the existing `school_contacts` junction (already populated by other features — vacancies/news matching). Many-to-many, but the leads UI assumes at most one.

Recommendation: **add the nullable FK as the leads-domain source of truth** and backfill it from `school_contacts` where the junction has exactly one school; keep the junction untouched for its existing consumers. Don't try to converge them in this feature.

### Schools table — nothing to create
Exists, is populated (~100K rows via `--all-schools`), and already has name (`school_name`), level (`school_level`), `leaid` FK, and the NCES 12-char PK the import resolution needs.

---

## Opportunity Sync Findings (the critical question)

**How opportunities are populated today:** by a standalone Python scheduler deployed to Railway (`scheduler/` — has its own `Dockerfile`, `railway.json`, `requirements.txt`). Source is **OpenSearch (Fullmind's LMS)**, not Salesforce. It is NOT one of the Vercel crons (`src/app/api/cron/*` has no opportunity sync; `pipeline-snapshot` only snapshots).

- Schedule: `scheduler/run_scheduler.py:163` — `schedule.every(1).hour.do(scheduled_sync)` (incremental, watermark via `get_last_synced_at`); `:166` — `schedule.every().day.at("04:00").do(scheduled_current_fy_backfill)` (full current-FY pass).
- Flow: `scheduler/run_sync.py` → `fetch_opportunities` / `fetch_sessions` (`sync/queries.py`, OpenSearch client) → `build_opportunity_record` (`sync/compute.py`) → `upsert_opportunities` (`sync/supabase_writer.py:64`) → then `update_district_pipeline_aggregates`, `refresh_map_features`, `refresh_fullmind_financials`, `refresh_opportunity_actuals`.

**Would app-created rows survive?** **Yes.** Evidence:
- `upsert_opportunities` (`scheduler/sync/supabase_writer.py:101-105`) is `INSERT … ON CONFLICT (id) DO UPDATE SET …` — it only ever touches ids present in the OpenSearch payload. **There is no `DELETE FROM opportunities` anywhere in the scheduler.** The only opportunity deletions in the repo are a one-off manual script (`scripts/delete-legacy-fulfillment-opps.mjs:91`) and `unmatched_opportunities` healing (`supabase_writer.py:223`, a different table). Session rows are deleted/replaced, but only `WHERE opportunity_id = ANY(<synced ids>)` (`:156`).
- On id conflict the sync clobbers every synced column **except** `district_lea_id` (COALESCE-preserved, `:95-100`). So the only overwrite risk is **id collision with an LMS opp id**. LMS ids arrive as numeric values stringified (`run_sync.py` coerces `str(opp["id"])`); an app-generated uuid (or any prefixed id like `app-<uuid>`) can never collide. Note `sales_rep_id` is NOT in `OPPORTUNITY_COLUMNS` (`supabase_writer.py:43-58`) — the sync never writes it; it's resolved later via email fallback.
- **The app does not create opportunities anywhere today.** `grep` for `opportunity.create|INSERT INTO opportunities` across `src/` hits only test fixtures (`src/features/rfps/lib/__tests__/refresh-signals.test.ts`). Manual district resolutions flow through `unmatched_opportunities.resolved_district_leaid`, never row creation.

**Conclusion:** lead-created opps CAN be native `opportunities` rows. Requirements:
1. App-generated id with no collision possibility (recommend `@default(uuid())`-style generated in app code since the column has no DB default; consider a recognizable prefix or a `source`/`created_by_app` marker column so reporting can distinguish them).
2. `stage = '0 - Meeting Booked'` on create; advance to `'1 - Discovery'` on sales-qualify — these are the live stage strings, so the rows automatically appear in the opps kanban, pipeline aggregates, and `has_open_pipeline` district flags **the next time the scheduler's refresh steps run** (they recompute from the whole table). That inclusion is almost certainly desired ("meeting booked" is real pipeline) but flag it in the spec: app rows will show in dashboards with NULL `net_booking_amount` and NULL `synced_at`.
3. **Duplicate risk**: when the deal later gets entered in the LMS, the sync inserts a second row with the LMS id. Need a reconciliation story (e.g., a rep/admin action that re-points `leads.opportunity_id` to the LMS row and deletes/archives the app row, or an admin report of app-created opps older than N days). This is a product decision, not a technical blocker.

---

## API Patterns

Representative routes read: `src/app/api/activities/route.ts`, `src/app/api/activities/bulk/route.ts`, `src/app/api/tasks/route.ts`, `src/app/api/reps/route.ts`, `src/app/api/schools/route.ts`.

- **Structure**: Next.js App Router, `src/app/api/{resource}/route.ts` + `[id]/route.ts` + verb-specific subroutes (`bulk/`, `reorder/`). Every route starts with `export const dynamic = "force-dynamic"`.
- **Auth**: `const user = await getUser()` from `src/lib/supabase/server.ts` (Supabase SSR cookie client; supports admin impersonation via `impersonate_uid` cookie — `user.id` is already the effective user). Unauthed → `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`. Admin checks: `isAdmin(user.id)` / `getAdminUser()`.
- **Validation**: manual, no zod. Whitelist consts exported from the feature's `types.ts` (`VALID_ACTIVITY_STATUSES` etc.); allowed-sort-key whitelists inline; 400s as `NextResponse.json({ error: "snake_case_code" }, { status: 400 })`.
- **Owner scoping (the "My leads vs Team" pattern)** — `src/app/api/activities/route.ts:93-104`: default `where.createdByUserId = user.id`; `?ownerId=all` shows everyone; `?ownerId=<uuid>` shows one user; multi-owner `?owner=a,b` wins over the single param. Replicate exactly for `leads.assigned_bdr_id`.
- **Service-layer extraction**: mutations shared with the AI copilot live in `src/features/{name}/lib/service.ts` — see `createActivity(input, userId, db = prisma)` in `src/features/activities/lib/service.ts`, throwing `ServiceError(message, status)` from `src/features/shared/lib/service-error`; routes catch with `isServiceError`. Lead mutations (accept, restage, qualify, disqualify) should follow this shape — lifecycle side-effects (create/advance opp, write lead event) belong in the service, wrapped in a `prisma.$transaction`.
- **Junction writes**: nested `create` arrays inside a single `prisma.activity.create({ data: { …, districts: { create: leaids.map(...) }, contacts: { create: ids.map(...) } }, include: CREATE_INCLUDE })` (`service.ts:135-190`). Updates use replace-all (deleteMany + create) in the `[id]` route.
- **Bulk endpoint pattern** (`activities/bulk/route.ts`): `PATCH` with `{ ids: string[], updates }`, `MAX_IDS = 500`, dedupe ids, per-row auth into `{ succeeded: [], failed: [{id, reason}] }`, always HTTP 200 for partial success visibility.
- **Client hooks**: TanStack Query in `src/features/{name}/lib/queries.ts`; stable serialized-primitive query keys (CLAUDE.md rule).

## Migration Approach

- Prisma 5.22 with `prisma migrate dev --name <snake_name>` → `prisma/migrations/<timestamp>_<name>/migration.sql` (plain SQL, reviewable; e.g. `20260602000000_district_collaborators_watchers/migration.sql` shows the house style: header comment block explaining intent, CreateTable/CreateIndex/AddForeignKey sections). Applied with `prisma migrate deploy` (records into `_prisma_migrations`).
- One-off data backfills live in `prisma/migrations/manual/` (dated `.sql` files, run by hand, not part of migrate history). `MANUAL_RUN_IN_SUPABASE.sql` is a legacy dashboard-run artifact.
- Rules: no TODOs in migration files (CLAUDE.md); some migration dirs are hand-timestamped (`20260602000000_…`) when authored manually — fine either way, keep the SQL self-documenting.
- For Leads: one schema migration (leads table, activity_schools, contacts.school_ncessch) via `prisma migrate dev`, plus optional manual backfill SQL for `contacts.school_ncessch` from `school_contacts`.

## Shared Utilities

- `src/lib/prisma.ts` — PrismaClient singleton (globalThis-cached in dev).
- `src/lib/db.ts` — pg `Pool` singleton for raw/geospatial SQL (max 2 conns in prod — keep new endpoints on Prisma unless geospatial). `src/lib/db-readonly.ts` — readonly role pool (copilot).
- `src/lib/supabase/server.ts` — `getUser` / `getRealUser` / `isAdmin` / `getAdminUser` (impersonation-aware).
- `src/lib/reps.ts` — `getActiveReps()` (role='rep' roster) + `GET /api/reps` for owner/BDR dropdowns.
- `src/lib/opp-rep-sql.ts` — `RESOLVE_OPP_REP` SQL fragment (rep id w/ email fallback), `LIVE_STAGE_REGEX`.
- `src/lib/audit-log.ts` — column-level audit via Postgres triggers (`AuditLog` model; set `app.user_id` before mutations if lead tables should be audited).
- `src/features/shared/lib/service-error.ts` — `ServiceError`, `isServiceError`, `DbClient` type.
- `src/features/shared/lib/date-utils.ts` — `parseLocalDate()` (use for SLA/date math; don't hand-roll).
- `src/features/shared/hooks/useIsMobile.ts`, `useProfile()` in `src/features/shared/lib/queries.ts` (default owner = current user).
- **CSV parsing: no library exists.** Nothing in `package.json` (no papaparse/csv-parse); the only multipart upload endpoint is `src/app/api/activities/[id]/attachments/route.ts`. ETL CSV work is Python-side. The bulk-import modal should parse CSV **client-side** and POST validated JSON rows (matches the bulk-endpoint pattern and avoids adding a server CSV dependency), or add papaparse if server-side parsing is required.

## ETL & Schools

- Entry: `scripts/etl/run_etl.py`. The handoff's claim is **confirmed**: `--all-schools` flag (`run_etl.py:1145`, handler `run_all_schools_etl` at `:467`) loads **all** ~100K U.S. schools (not just charters) from the **Urban Institute Education Data API (CCD directory endpoint)** via `scripts/etl/loaders/urban_institute_schools.py`:
  - `fetch_school_directory(year=2023, charter_only=False)` — normalizes `ncessch` with `.zfill(12)` (`urban_institute_schools.py:85`).
  - `ensure_districts_for_schools(...)` — creates stub `districts` rows for school LEAIDs missing from the table (`ON CONFLICT (leaid) DO NOTHING`, `:535`) — relevant precedent for the import flow's "create district by leaid".
  - `upsert_schools(...)` — `INSERT INTO schools (ncessch, leaid, school_name, charter, school_level, school_type, …) ON CONFLICT (ncessch) DO UPDATE` (`:240-247`). **School data goes into the existing `schools` table** — the same one the Prisma `School` model maps.
  - Enrollment history per year 2019–2023 into `school_enrollment_history`, then `update_district_charter_aggregates`.
  - Variants: `--charter-schools` (charter only), `--schools-by-state` (state-by-state with `--start-fips` resume and `--directory-only`).
- Districts: loaded/enriched by the Urban Institute loaders + `loaders/fullmind.py` (CRM CSV: `account_name`, `lmsid`, `_compute_is_customer`, `_compute_has_open_pipeline` — never inline these).
- Contacts: `scripts/etl/loaders/contacts.py` — CSV with header mapping ("Work Email"→email etc.), `normalize_leaid` util (`scripts/etl/utils/leaid.py`), upsert keyed (leaid, lower(email)) with (leaid, name) fallback, unmatched rows to a report. **No school/NCES-school column today** — the leads/activity CSV import is new ground; reuse `normalize_leaid` semantics (7-digit zfill) and zfill(12) for ncessch.

## Testing Patterns

- Vitest + jsdom, tests co-located in `__tests__/` next to source (`src/app/api/{resource}/__tests__/route.test.ts`, `src/features/{name}/lib/__tests__/`). Run: `npm test`.
- Route-test idiom (`src/app/api/activities/bulk/__tests__/route.test.ts`): `vi.mock("@/lib/supabase/server")` with a `mockGetUser` fn; `vi.mock("@/lib/prisma")` returning an object of `vi.fn()` per model method; build a `NextRequest` directly; import the verb (`PATCH`) from `../route`; assert status + JSON. Cases: 401 unauth, 400 validations, partial-success shapes.
- Integration-ish tests that need real SQL insert via the pg pool directly (`src/features/rfps/lib/__tests__/refresh-signals.test.ts` inserts `opportunities` rows).
- Scheduler has its own Python tests (`scheduler/tests/`) — don't touch unless changing sync behavior.

## Open Questions

1. **Opp reconciliation**: when the LMS later creates the "real" opportunity for a lead-sourced deal, how do we merge/re-point (manual admin action vs. matching heuristic on district+schoolYr)? Blocking only for long-term hygiene, not v1.
2. **Should app-created Stage-0 opps flow into pipeline aggregates immediately?** They will (next scheduler refresh recomputes from the whole table, and the app's own open-pipeline queries use `stage NOT IN ('Closed Won','Closed Lost')` / `^[0-5] - `). Likely desired; confirm with Sierra (NULL booking amounts will appear in kanban cards).
3. **Marketing owner**: a `user_profiles` FK (marketing staff would need accounts) or free-text varchar from the import? Handoff treats it as display-only metadata → varchar is simpler.
4. **Lead lifecycle events**: dedicated `lead_events` table vs `activities` rows with `source="system"`. Recommend the table (system activities are filtered from every list view).
5. **Contact school FK vs `school_contacts` junction** — recommended nullable FK + backfill (see Proposed New Models); needs sign-off since two representations will coexist.
6. **SLA "2 business days"**: compute in app code (TS, shared client+server helper) — no business-day SQL exists; store only `assigned_at`/`accepted_at` and derive state.
7. **CSV import transport**: client-side parse + JSON POST (recommended, no new deps) vs server-side multipart + papaparse.
8. **Score semantics**: imported activity rows "add points to active leads" — is `leads.score` a denormalized running sum (needs recompute on activity delete) or computed on read from activity links? Recompute-on-read is safer; denormalize only if list performance demands it.
