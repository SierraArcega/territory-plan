# Backend Context: Plans & Lists Sidebar

Date: 2026-05-13
Author: backend-discovery agent
Feature: Unified "Plans & Lists" sidebar + list-builder modal + 6 entity-kind detail panels.

## Important caveat about source design materials

The task references `design_handoff_saved_views/README.md`, `district-panel.jsx`,
and `detail-panel.jsx`. **None of these exist in this worktree.** The only
handoff present is `design_handoff_activities_calendar/` (Activities + Calendar
redesign). This document infers the new feature's surface area from the task's
seven section prompts and the existing codebase. Before treating any field
shape as authoritative, confirm with the user that the design handoff
referenced was indeed `activities_calendar` or supply the saved-views handoff.

---

## 1. Existing Plans data model (Prisma)

### `TerritoryPlan` (`prisma/schema.prisma:494-533`)

```prisma
model TerritoryPlan {
  id              String    @id @default(uuid())
  name            String    @db.VarChar(255)
  description     String?
  ownerId         String?   @map("owner_id") @db.Uuid
  color           String    @default("#403770") @db.VarChar(7)
  status          String    @default("planning") @db.VarChar(20)   // "planning" | "working" | "stale" | "archived"
  fiscalYear      Int       @map("fiscal_year")
  startDate       DateTime? @map("start_date")
  endDate         DateTime? @map("end_date")
  userId          String?   @map("user_id") @db.Uuid               // creator (separate from ownerId)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Denormalized rollup columns (synced when targets change)
  districtCount     Int     @default(0)
  stateCount        Int     @default(0)
  renewalRollup     Decimal @default(0) @db.Decimal(15, 2)
  expansionRollup   Decimal @default(0) @db.Decimal(15, 2)
  winbackRollup     Decimal @default(0) @db.Decimal(15, 2)
  newBusinessRollup Decimal @default(0) @db.Decimal(15, 2)

  // Bulk enrichment tracking
  enrichmentStartedAt  DateTime?
  enrichmentQueued     Int?
  enrichmentActivityId String?  @db.Uuid

  // Relations
  ownerUser     UserProfile?                @relation("PlanOwner")
  districts     TerritoryPlanDistrict[]
  states        TerritoryPlanState[]
  collaborators TerritoryPlanCollaborator[]
  activityLinks ActivityPlan[]
  taskLinks     TaskPlan[]
}
```

Junction tables:
- `TerritoryPlanDistrict` — composite PK (planId, districtLeaid), holds per-district `renewalTarget`, `winbackTarget`, `expansionTarget`, `newBusinessTarget`, `notes`. Has nested `TerritoryPlanDistrictService` (per-district service-line targets).
- `TerritoryPlanState` — composite PK (planId, stateFips).
- `TerritoryPlanCollaborator` — composite PK (planId, userId).
- `ActivityPlan`, `TaskPlan` — many-to-many to activities and tasks.

### Where the README's required fields fit

| README field | Status | Notes |
|---|---|---|
| `archived` | **Already covered** via `status = "archived"` | No new column needed unless we want both a hide-toggle and a status enum |
| `hidden_by_user` | **MISSING** | No per-user hide flag exists. `status` is a global single-value enum — archiving hides the plan from everyone. To support "hide from my list without archiving for the team," need a new junction table (e.g., `TerritoryPlanHidden { planId, userId, hiddenAt }`) or a `hiddenByUserIds String[]` array column. Recommend a junction table for cleaner indexing |
| `progress` | **Computable, not stored** | `taskCount` / `completedTaskCount` are computed in the list endpoint from `taskLinks.task.status === "done"`. A "progress %" derived metric could either (a) reuse task completion ratio, (b) sum-of-targets vs sum-of-actuals from `district_opportunity_actuals`, or (c) be a new persisted field |
| `pipeline_value` | **Computable, partially stored** | List endpoint computes `pipelineTotal` as Σ over plan districts of `districtFinancials.openPipeline` (vendor=fullmind, FY=plan's). Detail endpoint instead uses `district_opportunity_actuals.weighted_pipeline`. The two paths give different numbers — see "Gaps" |
| `contacts_count` | **MISSING** at plan level | The endpoint `/api/territory-plans/[id]/contacts` exists for the detail panel but the list endpoint does not include a count. Need a denormalized `contactCount` on `TerritoryPlan` (synced when contacts change on member districts) or an aggregate per-request |
| `opps_count` | **MISSING** at plan level | Same situation as contacts. Could derive from `district_opportunity_actuals.opp_count` summed over plan leaids for the plan's FY, but not currently exposed |

### Recommended additions to `TerritoryPlan` (or new junction)

```prisma
model TerritoryPlan {
  // ... existing
  // Denormalized counts for sidebar list (synced on contact/opportunity write)
  contactCount Int @default(0) @map("contact_count")
  oppCount     Int @default(0) @map("opp_count")
  // Optional progress 0-100; meaning TBD with design
  progressPct  Int? @map("progress_pct")
}

model TerritoryPlanHidden {
  planId    String   @map("plan_id")
  userId    String   @map("user_id") @db.Uuid
  hiddenAt  DateTime @default(now())
  plan      TerritoryPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  user      UserProfile   @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([planId, userId])
}
```

If progress is computed on read instead, drop `progressPct` and document the
formula. Counts probably should also be lazy-computed on the list endpoint
unless the sidebar is hit on every nav.

---

## 2. Existing Plans API routes

Routes live at `src/app/api/territory-plans/`:

| Route | Methods | Purpose |
|---|---|---|
| `/route.ts` (`route.ts:8-136`) | GET list, POST create | List with `pipelineTotal`, `taskCount`, `completedTaskCount`, `renewalRollup`, etc. Computes `totalEnrollment` and `pipelineTotal` from each plan's districts in memory |
| `/[id]/route.ts` | GET, PUT, DELETE | Single plan with full district list, actuals (`district_opportunity_actuals`), pacing (current vs prior FY), session breakdown by service type |
| `/[id]/districts/route.ts` | GET, POST, DELETE | Member district CRUD |
| `/[id]/districts/[leaid]/route.ts` | PUT, DELETE | Per-district edits (targets, notes, services) |
| `/[id]/contacts/route.ts` | GET, POST | Contacts of all districts in this plan |
| `/[id]/contact-sources/route.ts` | GET | Sources for the contact-finder modal |
| `/[id]/contacts/bulk-enrich/route.ts` | POST | Clay enrichment trigger |
| `/[id]/contacts/enrich-progress/route.ts` | GET | Clay enrichment status polling |
| `/[id]/opportunities/route.ts` | GET | Opps tied to plan districts |
| `/[id]/vacancies/route.ts` | GET | Plan-level vacancy roll-up — `PlanVacanciesResponse` w/ summary by category and district |
| `/[id]/expand-rollup/route.ts` | POST | Migrate NYC-style rollup leaids to their children |

### Gaps for the new sidebar

| Need | Gap |
|---|---|
| Per-plan contact count | Not in list endpoint; would need either `_count.contacts` (no direct relation — contacts join via district), an aggregate subquery, or denormalized column |
| Per-plan open-opp count | Not in list endpoint; would need to sum `district_opportunity_actuals.opp_count` for plan leaids + plan FY, or query `opportunities` filtered to plan districts + non-closed stages |
| Per-plan progress % | No existing field — design must decide formula (task completion vs revenue actual vs targets met) |
| Per-user hide flag | Missing — see §1 |
| Bulk hide / unhide endpoint | Missing — currently the only "archive-like" action is `PATCH status=archived` which is global |
| List filter on `status != archived` | The current list returns ALL plans regardless of status; the UI must filter client-side. For a sidebar with 1000s of plans this won't scale — add `?status=` and `?hidden=` query params |

The list endpoint sets `revenueActual: 0`, `takeActual: 0`, `priorFyRevenue:
0` explicitly with the comment "Actuals deferred to detail view to avoid N*2
DB round-trips" (`route.ts:122-124`). For the sidebar, if we want these
numbers visible per-plan, we either need a materialized view rolled up to the
plan level, or accept the additional `district_opportunity_actuals` aggregate
on every list call.

---

## 3. Lists — fresh entity design

The sidebar's second-class citizen is the "List" — saved filtered selection
over one of six entity kinds. There is no existing equivalent. The two closest
relatives are:

- `MapView` (`schema.prisma:1084-1098`) — saved snapshot of map filter/layer
  state, owner + `isShared` flag + `state Json`. **No filter tree, no source
  selector, no scope** — it's a screenshot of the map UI, not a logical
  selection.
- `SavedReport` (`schema.prisma:1764-1787`) — saved SQL + summary for the
  reports tab. Has `userId`, `isTeamPinned`, `pinnedBy`. The whole point is
  it stores SQL, which the README says we don't want for Lists.

### Proposed `SavedList` model

```prisma
model SavedList {
  id              String   @id @default(uuid())
  name            String   @db.VarChar(200)
  description     String?  @db.Text
  ownerId         String   @map("owner_id") @db.Uuid
  // One of: "districts" | "contacts" | "opportunities" | "vacancies" | "news" | "rfps"
  kind            String   @db.VarChar(20)
  // Logical filter tree; opaque to the DB. Same shape regardless of `kind`.
  // Compiled to SQL or Prisma WHERE at read time.
  filterTree      Json     @map("filter_tree")
  // How to seed the candidate set before applying filterTree:
  //   "all"           — every row of `kind`
  //   "plan"          — start from districts/contacts/opps of a plan
  //   "list"          — start from another saved list (composition)
  //   "manual"        — explicit ID set (selection list); see scopeIds
  scopeMode       String   @default("all") @map("scope_mode") @db.VarChar(20)
  scopeRefId      String?  @map("scope_ref_id")             // planId or other listId
  scopeFilterTree Json?    @map("scope_filter_tree")         // optional pre-filter pruning of the scope
  scopeIds        String[] @default([]) @map("scope_ids")    // for scopeMode=manual
  shared          Boolean  @default(false)
  // Optional pin so a list shows up at the top of the sidebar for everyone
  isTeamPinned    Boolean  @default(false) @map("is_team_pinned")
  pinnedBy        String?  @map("pinned_by") @db.Uuid
  // Last-evaluated count + ts, for sidebar badges without re-running the query
  lastCount       Int?     @map("last_count")
  lastEvaluatedAt DateTime? @map("last_evaluated_at")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  owner UserProfile @relation("SavedListOwner", fields: [ownerId], references: [id], onDelete: Cascade)

  @@index([ownerId])
  @@index([kind])
  @@index([scopeMode, scopeRefId])
  @@index([isTeamPinned])
  @@map("saved_lists")
}

// Per-user hide so a shared/team-pinned list can be dismissed locally
model SavedListHidden {
  listId   String   @map("list_id")
  userId   String   @map("user_id") @db.Uuid
  hiddenAt DateTime @default(now())
  list     SavedList   @relation(fields: [listId], references: [id], onDelete: Cascade)
  user     UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([listId, userId])
}
```

Add inverse relations on `UserProfile`:

```prisma
ownedLists       SavedList[]       @relation("SavedListOwner")
hiddenLists      SavedListHidden[]
```

### Tensions / open questions

1. **No FK on `scopeRefId`** — it points to either a plan UUID or a list UUID
   depending on `scopeMode`. Acceptable but means application-level integrity.
   Alternative: separate `scopePlanId` / `scopeListId` columns with at-most-one
   non-null. The single-column approach is simpler for the AI builder.
2. **`filterTree` shape is undefined here.** Should align with the eventual
   query-builder AST that the reports agent fork produces (see §6). Suggest
   `{ op: "and" | "or", clauses: [{ field, op, value }, ...] }` recursively.
3. **No "selection list" type yet.** README §"Backend / API Considerations"
   should clarify whether `scopeMode = "manual"` (explicit ID set, used for
   "save the current selection") needs its own validation — the array could
   grow large (10k+ districts for a national selection). Cap at a sensible
   limit and document.
4. **Overlap with `MapView`** — the existing `MapView.state Json` could in
   theory hold a list filter, but it's currently the entire map UI state. Keep
   them separate; do NOT try to repurpose `MapView`.
5. **No multi-kind lists.** A list is always a homogeneous set of one entity
   kind. If the design implies "mixed-bag" saved selections, this model needs
   to change.

### API routes to add

- `GET /api/lists` — list user's lists + team-pinned + shared (filter by `kind`)
- `POST /api/lists` — create
- `GET /api/lists/[id]` — get metadata
- `PUT /api/lists/[id]` — update
- `DELETE /api/lists/[id]` — delete
- `POST /api/lists/[id]/hide` / `DELETE /api/lists/[id]/hide` — per-user hide
- `GET /api/lists/[id]/results?limit=&cursor=` — evaluate filterTree and
  return paginated rows of the appropriate entity kind. The endpoint
  dispatches per `kind` to a shared compiler.
- `POST /api/lists/[id]/preview` — compile + count without fetching rows.

---

## 4. Entity detail endpoints

For the six detail-panel kinds:

### Districts

- **Endpoint:** `/api/districts/[leaid]/route.ts` (GET)
- **Returns:** `{ district, fullmindData, edits, tags, contacts, territoryPlanIds, educationData, enrollmentDemographics, trends }` — extremely rich payload (`route.ts:71-240+`).
- **Fields covered:** core attrs, address, centroid, isRollup, rollup children, school count, fullmind CRM (customer flag, pipeline flag, sales exec), tags, contacts, finance, demographics, trends vs state/national, ICP scores (on the model but not all currently in the response).
- **Gaps:** The endpoint already drives the existing district detail panel; for a new sidebar-driven detail panel the response should also include:
  - Open opportunities count + top 3 deals (currently you'd need a second call to `/api/deals/open?leaid=...`)
  - Recent activity count
  - Recent news count (via `/api/news?leaid=...`)
  - Recent vacancy count (via `/api/districts/[leaid]/vacancies`)
- Either bundle these into the detail GET or have the panel fan out 4 parallel TanStack queries with stable keys.

### Contacts

- **Endpoint:** `/api/contacts/route.ts` (GET list/search), `/api/contacts/[id]/route.ts` (GET/PUT/DELETE).
- **List returns:** id, leaid, name, title, email, phone, isPrimary, districtName (`contacts/route.ts:39-48`). Search by name/title/email.
- **Gaps for a detail panel:**
  - No "contact detail" endpoint that returns related activities/notes/news for the contact. The schema has `ActivityContact`, `NewsArticleContact`, and `TaskContact` join tables — easy to add.
  - No persona/seniority enrichment view; the model has those fields (`schema.prisma:363-364`) but the list endpoint doesn't return them.
  - `linkedinUrl`, `persona`, `seniorityLevel`, `lastEnrichedAt` are not in the list response. Add to detail.

### Opportunities

- **Endpoint:** `/api/opportunities/route.ts` (GET search-only, name/id substring). Plus `/api/deals/open/route.ts` for open-deal listing (scoped by `ownerId`, `state`).
- **List returns:** id, name, stage, netBookingAmount, districtName, districtLeaId, closeDate (`opportunities/route.ts:49-57`). `/api/deals/open` returns similar + salesRepId, detailsLink.
- **Gaps for a detail panel:**
  - **No GET /api/opportunities/[id]** — must be added. Should return everything on the `Opportunity` model (50+ fields including `serviceTypes`, `stageHistory`, `completedRevenue`, etc.) plus related sessions/subscriptions, activity links, and history snapshots (`OpportunitySnapshot`).
  - No deal-history endpoint (`OpportunitySnapshot` table is there but unread by any route).

### Vacancies

- **Endpoint:** `/api/vacancies/[id]/route.ts` (GET/PATCH), plus list at the district level via `/api/districts/[leaid]/vacancies` and plan level via `/api/territory-plans/[id]/vacancies`.
- **Detail returns:** all model columns + flattened `districtName` and `schoolName` (`vacancies/[id]/route.ts:48-62`).
- **Gaps:** No bare GET `/api/vacancies` list endpoint with filters (status, category, fullmindRelevant, state, etc.) — needed for the "Vacancies" list-builder kind. Today you can only get vacancies scoped to a district or plan.

### News

- **Endpoint:** `/api/news/route.ts` — GET with mutually-exclusive scoping params (`leaid`, `ncessch`, `contactId`, `stateAbbrev`, `territoryPlanId`, or `scope=my-territory`).
- **Returns:** `NewsArticleDto[]` — id, url, title, description, imageUrl, author, source, feedSource, publishedAt, categories, fullmindRelevance, confidence, districtLeaid, districtName.
- **Gaps:**
  - No GET `/api/news/[id]` for single-article detail — currently the article body (`content`) is on the model but never returned. Add for the detail panel.
  - Filtering by `categories` (array column) or `fullmindRelevance` tier as primary axis is supported via query params (`minRelevance`) but no full filter set (date range, source, etc.) for the list builder.
  - Per-news entity matches (district / school / contact links + confidence) are not returned in the detail response.

### RFPs

- **Endpoint:** `/api/rfps/route.ts` — GET list with cursor pagination, filters: `leaid`, `agency_key`, `stateFips` or `state`, `q` (title/agency substring).
- **Returns:** raw `Rfp` rows (entire model — 50+ columns).
- **Gaps:**
  - No GET `/api/rfps/[id]` for detail panel (returns raw `Rfp` row directly today, which works but is ad-hoc).
  - No filter on `fullmindRelevance`, `status`, `dueDate` range — those are common axes for a sidebar list. The model has the columns; the route just doesn't expose them as query params.

### Shared "detail panel" requirements

Without the actual `district-panel.jsx` / `detail-panel.jsx` source the
required field set is inferred. Per the activities-calendar handoff pattern
(common-bits + tabs), the new detail panels likely need:

- Header: title (entity name), subtitle (district name or other parent), status pill, owner avatar.
- Quick-action row: open in map, add to plan, create activity, create task, share.
- Tabs: Overview (key fields), Related (activities/tasks/notes), Signals (news/vacancies/rfps where applicable).

This implies every detail endpoint needs:
1. Owner / assignee user object (id, fullName, avatarUrl).
2. List of related activities (link to `Activity`).
3. List of related tasks.
4. List of related notes (for entities with notes — currently only districts have `notes`).

---

## 5. Vacancies / News / RFPs data

### Vacancies

- **Models:** `VacancyScan`, `Vacancy`, `VacancyKeywordConfig` (`schema.prisma:1567-1643`).
- **Ingest pipeline:** lives in `src/features/vacancies/lib/`:
  - `scan-runner.ts` — runs a single scan for one district's job board.
  - `scan-queue.ts` — orchestrates batch scans.
  - `categorizer.ts`, `relevance-flagger.ts`, `role-filter.ts` — LLM + keyword classification.
  - `fingerprint.ts` — dedup hash.
- **Cron / API:** `/api/vacancies/scan-next`, `/api/vacancies/scan-bulk`, `/api/cron/vacancies-*` (under `src/app/api/cron/`).
- **UI query path today:** Frontend hits `/api/districts/[leaid]/vacancies` (per-district) or `/api/territory-plans/[id]/vacancies` (plan rollup). For the new sidebar list, queries would hit a new `/api/vacancies` list endpoint.

### News

- **Models:** `NewsArticle`, `NewsArticleDistrict`, `NewsArticleSchool`, `NewsArticleContact`, `DistrictNewsFetch`, `NewsIngestRun`, `NewsMatchQueue` (`schema.prisma:1812-1931`).
- **Ingest:** `src/features/news/lib/` — `ingest.ts` pulls RSS + Google News, `matcher.ts` runs the two-pass matcher (Pass 1 keyword/queue prep, Pass 2 LLM disambiguator), `store-article.ts` writes deduped rows.
- **Crons:** `/api/cron/news-ingest-*`, `/api/cron/match-articles`.
- **API today:** `/api/news/route.ts` (read-only, scoped). Frontend has no `queries.ts` for news yet — the news tab in the UI doesn't exist (handoff explicit: "backend only; UI pending").

### RFPs

- **Models:** `Rfp`, `RfpIngestRun`, `AgencyDistrictMap` (`schema.prisma:1933-2058`).
- **Ingest:** `src/features/rfps/lib/`:
  - `highergov-client.ts` — HigherGov SLED API client.
  - `district-resolver.ts` — name-based resolution to `leaid`, falls back to `AgencyDistrictMap` overrides.
  - `classifier.ts` — Haiku-driven `fullmindRelevance` / `keywords` / `fundingSources` tagging.
  - `refresh-signals.ts` — nightly `districtPipelineState`, `isNew`, `isUrgent` refresh.
  - `sync.ts` — orchestrator.
- **Crons:** `/api/cron/rfps-*`.
- **API today:** `/api/rfps/route.ts` (read-only list). No queries.ts.

For the sidebar list-builder all three entity kinds need:
1. A bare list endpoint `/api/{vacancies|news|rfps}` with a richer filter
   surface (currently all three force scope-by-parent).
2. A queries.ts in `src/features/{vacancies,news,rfps}/lib/` that exposes the
   list-builder hook + the detail hook.

---

## 6. Reports agent infra

Located at `src/features/reports/lib/agent/`.

### `agent-loop.ts` (`agent-loop.ts:108-457`)

`runAgentLoop(args)` is the synchronous-or-streaming Claude agent runner:

- Replays prior turns as structured `tool_use` / `tool_result` pairs (so the
  model doesn't see SQL only in Markdown — fixes "ghost report" copy-from-
  history failures).
- System prompt is built once per call via `buildSystemPrompt()` and cached
  via Anthropic ephemeral cache (`cache_control: { type: "ephemeral", ttl: "1h" }`).
- Each iteration calls `anthropic.messages.create({ model: "claude-opus-4-7", max_tokens: 16000, thinking: { type: "adaptive" }, tools: AGENT_TOOLS, ... })`.
- `pushEvent` forwards each `TurnEvent` to both the in-memory log AND an
  optional streaming callback (used by the SSE chat route).
- **Terminal tool is `run_sql`** — once the model calls it successfully, the
  loop returns `{ kind: "result", sql, summary, rows, ... }`. All other tools
  ("exploratory") loop back and accumulate context.
- Limits: `MAX_SQL_RETRIES = 2`, `MAX_GHOST_REPORT_RETRIES = 1`, `MAX_EXPLORATORY_CALLS_PER_TURN = 20` (`types.ts:78-82`).
- Result variants: `result` (success), `clarifying` (model asked a question
  without tools), `surrender` (model gave up after retries).

### `system-prompt.ts` (`system-prompt.ts:1-155`)

Builds the system prompt at runtime:

- Header copy explaining tool flow, "never show SQL," LIMIT requirements,
  currency-alias rules.
- Pre-bakes compact schemas for 9 frequent tables (`opportunities`,
  `districts`, `district_opportunity_actuals`, `district_financials`,
  `user_profiles`, `activities`, `vacancies`, `subscriptions`, `sessions`)
  via `buildCompactSchema()`.
- Adds an "Other tables already explored in this conversation" section by
  extracting table names from prior-turn SQL (`extractTablesFromSql`) and
  calling `handleDescribeTable()` for each.
- Reads `TABLE_REGISTRY` + `SEMANTIC_CONTEXT` from
  `@/lib/district-column-metadata` — the authoritative metadata source.

### `tool-definitions.ts` (`tool-definitions.ts:1-180`)

Eight tool schemas:

- `list_tables` — every queryable table + description.
- `describe_table` — full per-table columns + relationships + warnings.
- `search_metadata` — full-text search across descriptions and SEMANTIC_CONTEXT.
- `get_column_values` — distinct values in a column.
- `count_rows` — sanity-check filter row count.
- `sample_rows` — peek at SELECT result for the model only.
- `run_sql` — TERMINAL, executes against readonly Postgres pool, returns to user.
- `search_saved_reports` / `get_saved_report` — load prior reports for reuse.

The handlers for each tool live in `src/features/reports/lib/tools/`.

### Forking for the AI list builder

The fork needs to swap the terminal tool. Sketch:

| Reports agent | List-builder agent |
|---|---|
| `run_sql` terminal | `emit_list_spec` terminal |
| Returns rows | Returns `{ kind, filterTree, scopeMode, scopeRefId? }` |
| Renders results table | Persists as `SavedList` draft + previews count |
| `summary.source` is user-facing query header | `summary.source` becomes the proposed list name |

Concrete steps:

1. Copy the agent loop to `src/features/lists/lib/agent/agent-loop.ts` (or
   parameterize the existing one with a "terminal tool name + handler"
   strategy — preferable since `agent-loop.ts` is already 450 LOC and
   duplicate maintenance bites).
2. Replace `run_sql` with `emit_list_spec` in `tool-definitions.ts`. Schema:
   ```ts
   {
     kind: "districts" | "contacts" | "opportunities" | "vacancies" | "news" | "rfps",
     filterTree: <recursive AST>,
     scopeMode: "all" | "plan" | "list" | "manual",
     scopeRefId?: string,
     summary: { source, filters?, columns?, sort? }
   }
   ```
3. Keep the exploratory tools — they're useful for the model to inspect
   `districts`, `opportunities`, etc. before proposing a filter.
4. Replace `handleRunSql` with a compile-only step that resolves
   `filterTree` against the entity's allowed-column set, validates it, and
   returns a preview count (re-using `count_rows` infra).
5. The system prompt needs new rules: "never use SQL — emit `filterTree`",
   "ask for clarification before guessing scope," and the canonical column
   list per entity kind.
6. Reuse `TABLE_REGISTRY` / `SEMANTIC_CONTEXT` for column descriptions but
   limit the visible surface to user-facing columns (no `id` UUIDs, no FK
   strings — see SEMANTIC_CONTEXT's "no IDs in output" rule).

The `QueryLog` table can host AI-list-builder runs too (it already has
`action` and `actionParams` columns suitable for tagging the variant).
Alternatively, a separate `ListBuilderLog` table mirrors the schema and
keeps reports analytics clean.

---

## 7. Auth & user context

### Server-side

`src/lib/supabase/server.ts`:

- `createClient()` — returns a Supabase SSR client wired to Next.js cookies.
- `getRealUser()` — real authenticated user from Supabase (no impersonation).
- `getUser()` — **the standard call in all API routes.** Returns the
  effective user (impersonated if an admin has an `impersonate_uid` cookie,
  otherwise real). Adds `isImpersonating: boolean`.
- `isAdmin(userId)` — admin role check.
- `getAdminUser()` — returns `{ user, profile }` only if admin.

Pattern in every route (`territory-plans/route.ts:10-13`):

```ts
const user = await getUser();
if (!user) {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}
```

### Client-side

`src/features/shared/lib/queries.ts:168-174` — `useProfile()` hook returns
the `UserProfile` (synced from `/api/profile`). `profile.id` is the Supabase
UUID, used as the "current user" default for owner fields.

### Owner-scoped queries

- **Hard-scoped:** `/api/deals/open` defaults `ownerId` to the current user
  (`opp.salesRepId = user.id`), accepts `?ownerId=all` to opt out.
- **Soft-scoped (visibility):** `/api/territory-plans` returns ALL plans
  regardless of ownership — comment at `route.ts:15` says "the team shares
  visibility across plans." Same for the single-plan GET. UI client-side
  filters.
- **User-owned exclusive:** `DELETE /api/territory-plans/[id]` requires the
  current user to be the `userId` (creator) — does not allow non-creators to
  delete, even teammates.
- **Author-or-shared:** `/api/map-views` returns `OR(ownerId = user.id,
  isShared = true)`.
- **Author-only:** `/api/profile` is implicitly the current user only.

For the new sidebar, the visibility model should follow `MapView`:
- Lists owned by the current user: always visible.
- Lists `shared = true`: visible to everyone, but `SavedListHidden` allows
  per-user hide.
- Lists `isTeamPinned = true`: visible to everyone with a "team" badge.

### `app.user_id` for audit logs

`AuditLog` (`schema.prisma:783-797`) is populated by Postgres triggers that
read `current_setting('app.user_id')`. The application must call `SET LOCAL
app.user_id = '<uuid>'` at the start of a mutation transaction for the
trigger to capture `changedBy`. Verify in `src/lib/db.ts` or wherever raw
SQL mutations live — Prisma mutations through the standard client do NOT
set this, so plan/list creates audit-log to NULL today unless explicitly
wrapped. This is worth a one-line note in the implementation plan.

---

## 8. Gaps & Required Backend Work

### New Prisma models

1. **`SavedList`** + `SavedListHidden` (§3). Migration adds two tables, two
   indices, two inverse relations on `UserProfile`.
2. **`TerritoryPlanHidden`** (§1) — per-user plan hide. Optional if the
   product is happy treating `status = "archived"` as "hide from everyone";
   required if reps need a personal hide.

### New / extended columns

- `TerritoryPlan.contactCount`, `TerritoryPlan.oppCount`, optional
  `progressPct` (§1). Backfill via a one-shot SQL update + add denorm
  triggers OR compute lazily in the list endpoint with a single grouped
  query.

### New API routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/lists` | GET, POST | List + create saved lists |
| `/api/lists/[id]` | GET, PUT, DELETE | CRUD |
| `/api/lists/[id]/hide` | POST, DELETE | Per-user hide toggle |
| `/api/lists/[id]/results` | GET (cursor paginated) | Compile filterTree → query entity table → rows |
| `/api/lists/[id]/preview` | POST | Count + first N rows, no persistence |
| `/api/territory-plans/[id]/hide` | POST, DELETE | Per-user plan hide (if `TerritoryPlanHidden` adopted) |
| `/api/opportunities/[id]` | GET | Single-opp detail (currently missing) |
| `/api/vacancies` | GET | Bare list with filters (status, category, fullmindRelevant, state, etc.) |
| `/api/news/[id]` | GET | Single-article detail |
| `/api/rfps/[id]` | GET | Single-RFP detail (currently the list endpoint returns rows directly but no per-ID endpoint exists) |
| `/api/contacts/[id]` extension | GET (extend) | Add related activities/tasks/notes/news rollup |
| `/api/lists/builder` (or `/api/ai/list-builder/stream`) | POST (SSE) | List-builder agent fork — emits `emit_list_spec` events |

### Endpoint augmentations

- **`/api/territory-plans` list endpoint** — add per-plan `contactCount`,
  `oppCount`, optional `progressPct`, and accept `?status=`, `?hidden=`,
  `?ownerId=` filter query params so the sidebar can request the slim
  filtered set instead of the full collection.
- **`/api/territory-plans/[id]`** — already heavy; consider splitting actuals
  and pacing into a separate sub-route so the cold load on the sidebar nav
  doesn't pay for them.
- **`/api/news`** — add `kind=district|state|all` shorthand and a richer
  filter parameter for the list-builder.
- **`/api/rfps`** — expose `fullmindRelevance`, `status`, `dueDate` range,
  `valueLow/valueHigh` range query params.

### Reports-agent reuse

- Parameterize `agent-loop.ts` with a `terminalTool: { name, handler }`
  config so both `run_sql` and `emit_list_spec` share the loop, retry, and
  ghost-detection logic. Avoids forking 450 LOC.
- Add `kind`-specific column metadata for the list-builder system prompt —
  for the six entity kinds, the user-facing column allowlist differs from
  the SQL column set (e.g., never expose `leaid`, `id`, `district_lea_id`).

### Auth + audit

- Audit trigger compatibility — when creating a plan or list, wrap the
  mutation in a transaction that does `SET LOCAL app.user_id = $userId` so
  `audit_log.changed_by` is populated. Currently most Prisma mutations skip
  this.
- Document in the spec that visibility is "everyone sees owner-scoped lists
  except `shared = false`" mirroring MapView, so we don't reinvent ACLs.

### Performance considerations (CLAUDE.md "Performance" section)

- The sidebar will fetch the list of plans + lists on first paint. Cap at 50
  per kind and add "Show more" pagination.
- TanStack Query keys for sidebar slices: `["plans","sidebar",userId,status]`
  / `["lists","sidebar",userId,kind]` — string primitives, never raw objects.
- Wire `/api/territory-plans?ownerId=<id>&status=active` so the list endpoint
  doesn't return 500 rows when the rep only cares about their active plans.

### Tests to add (mirror existing pattern under `__tests__/`)

- `src/app/api/lists/__tests__/route.test.ts` — list CRUD.
- `src/app/api/lists/[id]/results/__tests__/route.test.ts` — filterTree
  compilation against each entity kind.
- `src/features/lists/lib/agent/__tests__/agent-loop.test.ts` — fork of the
  reports agent tests.
- Migration tests for `SavedList`, `SavedListHidden`, optional
  `TerritoryPlanHidden`.

---

## Appendix A — Files referenced

- `prisma/schema.prisma`
  - `District` `:15-289`
  - `Contact` `:353-376`
  - `TerritoryPlan` `:494-533`
  - `TerritoryPlanDistrict` `:535-555`
  - `TerritoryPlanCollaborator` `:568-578`
  - `Activity` `:583-670`
  - `UserProfile` `:890-941`
  - `MapView` `:1084-1098`
  - `Opportunity` `:1391-1446`
  - `DistrictOpportunityActuals` `:1517-1540` (materialized view)
  - `Vacancy` `:1592-1629`
  - `SavedReport` `:1764-1787`
  - `ReportDraft` `:1793-1804`
  - `NewsArticle` `:1812-1848`
  - `Rfp` `:1933-2020`

- `src/lib/supabase/server.ts` — auth helpers
- `src/app/api/territory-plans/route.ts` — plan list + create
- `src/app/api/territory-plans/[id]/route.ts` — plan detail + actuals + pacing
- `src/app/api/districts/[leaid]/route.ts` — district detail
- `src/app/api/contacts/route.ts` + `contacts/[id]/route.ts` — contacts
- `src/app/api/opportunities/route.ts` — opp search (no detail endpoint yet)
- `src/app/api/deals/open/route.ts` — open-deal list
- `src/app/api/vacancies/[id]/route.ts` — vacancy detail (no bare list)
- `src/app/api/news/route.ts` — news list (no detail)
- `src/app/api/rfps/route.ts` — RFP list (no detail)
- `src/app/api/map-views/route.ts` — saved map view CRUD (model template for SavedList)
- `src/features/plans/lib/queries.ts` — plan TanStack hooks
- `src/features/shared/lib/queries.ts:168-174` — `useProfile()`
- `src/features/shared/types/api-types.ts:301-386` — `TerritoryPlan`,
  `TerritoryPlanDistrict`, `TerritoryPlanDetail` shapes
- `src/features/reports/lib/agent/agent-loop.ts` — agent loop
- `src/features/reports/lib/agent/system-prompt.ts` — system prompt builder
- `src/features/reports/lib/agent/tool-definitions.ts` — 8 tools incl.
  terminal `run_sql`
- `src/features/reports/lib/agent/types.ts` — `TurnEvent`, `QuerySummary`,
  loop limits
- `src/features/vacancies/lib/queries.ts` — vacancy TanStack hooks (per-
  district / per-plan only)
- `src/features/news/lib/` — ingest pipeline (no queries.ts)
- `src/features/rfps/lib/` — ingest pipeline (no queries.ts)

## Appendix B — Notable schema patterns to follow

- **Junction tables** for many-to-many (activity↔plan, activity↔district,
  task↔district, news_article↔district). The new `SavedList` should
  similarly use a junction (`SavedListHidden`) rather than an array column
  for the per-user hide.
- **Composite PKs** on junction tables (`@@id([planId, districtLeaid])`).
- **Audit triggers** rely on `current_setting('app.user_id')` — see
  `AuditLog` notes (`schema.prisma:783-797`).
- **`@@ignore`** on materialized views (`DistrictOpportunityActuals`) — the
  Prisma model exists for type safety but the client cannot mutate it.
- **Denormalized counts** on parent models (`TerritoryPlan.districtCount`,
  `stateCount`, `*Rollup`) synced by application code — add `contactCount`
  and `oppCount` the same way if performance demands.
