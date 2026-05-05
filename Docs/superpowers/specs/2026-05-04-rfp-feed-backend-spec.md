# Feature Spec: RFP Feed (Backend)

**Date:** 2026-05-04
**Slug:** rfp-feed-backend
**Branch:** `worktree-rfp-feed-backend`
**Backend context:** [`2026-05-04-rfp-feed-backend-backend-context.md`](./2026-05-04-rfp-feed-backend-backend-context.md)

## Summary

Add a K-12 RFP data layer to Territory Planner, sourced from the HigherGov SLED opportunity API. **Backend only** — ingest, schema, and minimal read API. No UI, no Zustand slice, no TanStack Query hooks. Mirrors the `news` feature's "backend ready, UI deferred" shape.

## Requirements

- Pull SLED opportunities filtered to K-12 via a HigherGov saved search (`HIGHERGOV_K12_SEARCH_ID`).
- Resolve every RFP to a state (always) and to a `District.leaid` when possible (best-effort name match, scoped by state). Unresolved RFPs are still queryable at the state level via `stateFips`.
- Persist runs in an audit table so a silent sync failure is visible.
- Cron-driven daily ingest, rate-limit-friendly, idempotent (re-runs upsert without duplicating).
- One minimal read API endpoint to verify data is queryable; full UI-facing API deferred.

## Visual Design

N/A — backend-only feature. No components, hooks, or pages.

## Backend Design

### Endpoint we're integrating

- **Real path:** `https://www.highergov.com/api-external/opportunity/`
  *(Brief had `/sled_opportunity/`; that path 404s. Verified by capturing a real payload.)*
- **Auth:** `?api_key=` query parameter
- **Filter to K-12:** `?search_id=<HIGHERGOV_K12_SEARCH_ID>` (saved search managed in HigherGov UI; re-tuning is not a code change)
- **Pagination:** DRF-style (`results`, `next`, `previous`, `count`)
- **Rate limits:** 10 req/sec, 100k req/day per docs

### Sample payload reference

`src/features/rfps/lib/__fixtures__/sample-opportunity.json` — captured on 2026-05-04 against the production HigherGov saved search. Top-level fields confirmed in the captured record:

```
opp_cat, title, description_text, ai_summary, source_id, source_id_version,
captured_date, posted_date, due_date, agency, naics_code, psc_code, opp_type,
primary_contact_email, secondary_contact_email, set_aside, nsn,
val_est_low, val_est_high, pop_country, pop_state, pop_city, pop_zip,
opp_key, version_key, source_type, sole_source_flag, product_service,
dibbs_*, path, source_path, document_path
```

`agency` is nested:
```json
"agency": {
  "agency_key": 29140,
  "agency_name": "United Independent School District",
  "agency_abbreviation": null,
  "agency_type": "SLED",
  "path": "https://www.highergov.com/agency/tx-29140/"
}
```

State is returned as USPS abbreviation (`pop_state: "TX"`). FIPS must be derived locally.

### Prisma schema additions

Append to `prisma/schema.prisma`:

```prisma
model Rfp {
  id              Int       @id @default(autoincrement())
  externalId      String    @unique                 // = opp_key (stable across amendments)
  versionKey      String                            // = version_key (changes per amendment)
  source          String    @default("highergov")

  // Identity / classification
  title           String
  solicitationNumber String?                        // = source_id (e.g. "RFP 2026-008")
  oppType         String?                           // = opp_type.description ("Solicitation", "Sources Sought", ...)
  description     String?   @db.Text                // = description_text
  aiSummary       String?   @db.Text                // = ai_summary (HigherGov-generated)

  // Agency
  agencyKey       Int                               // = agency.agency_key — stable HigherGov agency ID
  agencyName      String                            // = agency.agency_name (raw, for audit)
  agencyPath      String?                           // = agency.path (HigherGov URL)

  // Geography
  stateAbbrev     String?   @db.VarChar(2)          // = pop_state (USPS)
  stateFips       String?   @db.VarChar(2)          // derived from stateAbbrev
  popCity         String?                           // = pop_city
  popZip          String?                           // = pop_zip

  // District resolution (nullable; populated by resolver)
  leaid           String?   @db.VarChar(7)

  // Classifiers
  naicsCode       String?                           // = naics_code.naics_code
  pscCode         String?                           // = psc_code.psc_code
  setAside        String?                           // = set_aside

  // Value
  valueLow        Decimal?  @db.Decimal(15,2)       // parsed from val_est_low (string-encoded by API)
  valueHigh       Decimal?  @db.Decimal(15,2)

  // Contact (sales-relevant)
  primaryContactName  String?
  primaryContactEmail String?
  primaryContactPhone String?

  // Dates
  postedDate      DateTime?
  dueDate         DateTime?
  capturedDate    DateTime                          // when HigherGov first saw it

  // Links
  highergovUrl    String?                           // = path (HigherGov canonical)
  sourceUrl       String?                           // = source_path (originating portal)

  // Lifecycle
  status          String    @default("open")        // "open" | "closed" — for future close-out sweep
  rawPayload      Json                              // full HigherGov record

  firstSeenAt     DateTime  @default(now())
  lastSeenAt      DateTime  @default(now())
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  district        District? @relation(fields: [leaid], references: [leaid])

  @@index([leaid, dueDate])
  @@index([stateFips, dueDate])
  @@index([agencyKey])
  @@index([capturedDate])
  @@index([status, dueDate])
}

model RfpIngestRun {
  id                Int       @id @default(autoincrement())
  source            String    @default("highergov")
  status            String    @default("running")  // "running" | "ok" | "error"
  startedAt         DateTime  @default(now())
  finishedAt        DateTime?
  watermark         DateTime?                       // captured_date watermark used for the pull
  recordsSeen       Int       @default(0)
  recordsNew        Int       @default(0)
  recordsUpdated    Int       @default(0)
  recordsResolved   Int       @default(0)           // had leaid set
  recordsUnresolved Int       @default(0)           // leaid=null
  error             String?   @db.Text              // truncated to 2000 chars on write

  @@index([source, status, startedAt])
  @@index([source, finishedAt])
}
```

Inverse on `District`:
```prisma
rfps Rfp[]
```

Migration name: `add_rfps`.

### File layout

```
src/features/rfps/
  lib/
    types.ts                       # zod schemas + inferred types for HigherGov payload
    highergov-client.ts            # fetch wrapper (api_key, retry, rate-limit honoring)
    normalize.ts                   # HigherGov record -> Prisma Rfp shape
    district-resolver.ts           # (agencyName, stateAbbrev) -> leaid | null
    sync.ts                        # orchestrates one ingest run (testable apart from route)
    __tests__/
      normalize.test.ts
      district-resolver.test.ts
      sync.test.ts
    __fixtures__/
      sample-opportunity.json      # captured 2026-05-04 (already exists)

src/lib/states.ts                   # ADD: USPS_TO_FIPS, FIPS_TO_USPS, abbrevToFips(), fipsToAbbrev()

src/app/api/cron/ingest-rfps/
  route.ts                         # GET handler: auth + run-tracking + delegate to sync.ts
  __tests__/
    route.test.ts

src/app/api/rfps/
  route.ts                         # GET /api/rfps (filtered list, paginated)
  __tests__/
    route.test.ts

prisma/schema.prisma                # +Rfp, +RfpIngestRun, +rfps relation on District
prisma/migrations/<ts>_add_rfps/migration.sql

vercel.json                         # +cron entry
```

**Diff vs. brief file layout:**
- `src/lib/highergov/` → `src/features/rfps/lib/` (matches feature-folder convention).
- `/api/rfps/sync/` → `/api/cron/ingest-rfps/` (matches existing `/api/cron/*` convention).
- Drop `/api/rfps/[id]/route.ts` (defer to v2 — no UI consumer in v1).
- Add `sync.ts` as a separate module so route stays thin and ingest logic is unit-testable without mocking `NextRequest`.

### Cron flow

```
GET /api/cron/ingest-rfps?secret=<CRON_SECRET>

1. Auth: header Bearer or ?secret check (copy from ingest-news-rolling).
2. Orphan sweep: flip RfpIngestRun rows with status="running" AND startedAt < now-10min to "error".
3. Compute watermark:
     lastOk = MAX(finishedAt) FROM RfpIngestRun WHERE source='highergov' AND status='ok'
     watermark = lastOk ?? (now - 90 days)   // cold-start backfill
4. Create RfpIngestRun row (status="running", watermark).
5. Page HigherGov:
     /api-external/opportunity/?api_key=...&search_id=<K12>&captured_date__gte=<watermark>&ordering=-captured_date&page_size=100
   For each page:
     - Group records by agency.agency_key (resolver dedup).
     - For each unique agency: resolveDistrict(agencyName, stateAbbrev) -> leaid | null
     - For each record:
         - normalize(record) -> Rfp shape, attach resolved leaid
         - prisma.rfp.upsert({ where: { externalId: opp_key }, create, update: { ...fields, lastSeenAt: now } })
         - increment counters (new vs updated, resolved vs unresolved)
6. Update RfpIngestRun: status="ok", finishedAt, all counters.
7. Return JSON summary; emit structured log: console.log(JSON.stringify({ event: "rfp_cron_summary", ... }))

On error: try/catch wraps body. Update run row status="error", error=String(err).slice(0, 2000), return 500.
```

**Cold-start (no prior `ok` runs):** pull last 90 days. Bounded so first sync stays manageable; HigherGov saved search is already filtered to K-12.

**Cron schedule:** `vercel.json` entry — `15 8 * * *` (daily, 8:15am UTC; non-colliding offset vs. existing 9:00 daily news cron). `maxDuration = 300` in route file.

### District resolver

Module: `src/features/rfps/lib/district-resolver.ts`

Signature: `resolveDistrict(agencyName: string, stateAbbrev: string): Promise<string | null>` — returns `leaid` or `null`.

```
Inputs: agencyName ("United Independent School District"), stateAbbrev ("TX")

1. Convert stateAbbrev -> stateFips via abbrevToFips(). If unknown -> return null.
2. Pre-filter: SELECT leaid, name FROM District WHERE stateFips = <fips>
3. Tier 1: case-insensitive exact match on District.name -> return leaid.
4. Tier 2: normalized match. Lowercase + strip stop-words from both sides:
     ["public", "schools", "school", "district", "isd", "unified",
      "independent", "consolidated", "cooperative", "borough", "township",
      "central", "county"]
   (Copied from src/features/news/lib/dice.ts — discovery flagged that
    consolidating to a shared utility is its own refactor.)
   If exactly one match -> return leaid. >1 -> proceed.
5. Tier 3: Dice coefficient over normalized names. Threshold >= 0.85.
   Return single best match if score >= 0.85. >1 ties -> return null.
6. No match -> return null.
```

**Dedup at sync layer:** `sync.ts` groups records by `agency.agency_key` and calls the resolver once per unique agency per run, applying the result to all records in that group. ~5x reduction in resolver calls in practice.

**Out of scope (v2):** `AgencyDistrictMap` table (persists `agency_key -> leaid` overrides set by sales reps via admin triage). Schema design here is forward-compatible — `agencyKey` column on `Rfp` is the join key.

### Read API

`GET /api/rfps`

Query params (all optional):

| Param | Type | Notes |
|-------|------|-------|
| `leaid` | string | Filter to a single district. |
| `stateFips` | 2-digit string | State-level rollup. Preferred. |
| `state` | 2-letter USPS | Convenience alias; resolved to `stateFips` server-side via `abbrevToFips`. |
| `q` | string | Case-insensitive `contains` over `title` + `agencyName`. |
| `cursor` | base64 string | Encodes `{ capturedDate, id }` for stable pagination. |
| `limit` | number | Default 50, max 50 (per `CLAUDE.md` perf rule). |

Default sort: `capturedDate DESC, id DESC`.

Response shape:
```json
{
  "items": [ /* Rfp records */ ],
  "nextCursor": "<base64>" | null
}
```

No `totalApprox` in v1 — `count(*)` on every list call is wasted DB work without a UI. Add when UI lands.

No `GET /api/rfps/:id` in v1 — deferred to v2.

Auth: this is an internal API, follows existing `/api/*` convention (Supabase auth via `@supabase/ssr` in middleware). No special public access.

### `src/lib/states.ts` additions

Currently only USPS-side utilities. Add:

```ts
export const USPS_TO_FIPS: Record<string, string> = {
  AL: "01", AK: "02", /* ... 51 entries incl. DC ... */ WY: "56",
};
export const FIPS_TO_USPS: Record<string, string> =
  Object.fromEntries(Object.entries(USPS_TO_FIPS).map(([k, v]) => [v, k]));

export function abbrevToFips(abbrev: string): string | null {
  return USPS_TO_FIPS[abbrev?.toUpperCase()] ?? null;
}
export function fipsToAbbrev(fips: string): string | null {
  return FIPS_TO_USPS[fips] ?? null;
}
```

Round-trip test in `src/lib/__tests__/states.test.ts`.

### Env vars (already in `.env`)

```
HIGHERGOV_API_KEY=6c155853f76443ad91d095b249941bc6
HIGHERGOV_K12_SEARCH_ID=9DntNZ-D-B2pkola-09Y5
```

No `RFP_SYNC_SECRET` — sync route reuses existing `CRON_SECRET` (matches every other cron route). Brief's reference to `RFP_SYNC_SECRET` is dropped.

Read inline via `process.env.X` with a runtime null-check throwing a descriptive error. No env validator (matches codebase).

Update `.env.example` with the two new vars (placeholder values).

## Test Plan

Co-located in `__tests__/` per convention. Vitest, closure-deferred `vi.mock("@/lib/prisma")` style.

| Test file | Covers |
|---|---|
| `src/features/rfps/lib/__tests__/normalize.test.ts` | Fixture record -> expected `Rfp` shape. Decimal parsing of `val_est_low`/`high`. Date string -> `DateTime`. Nested `agency.*` extraction. Missing fields default to null. |
| `src/features/rfps/lib/__tests__/district-resolver.test.ts` | Tier 1/2/3 matching. Stop-word stripping (ISD, Public Schools, Unified, etc.). State-mismatch fallthrough returns null. Ambiguous tier 3 (multiple ≥0.85) returns null. Unknown state abbrev returns null. |
| `src/features/rfps/lib/__tests__/sync.test.ts` | Happy path. Empty pull (no records). Partial failure (one record's upsert throws). Cold-start watermark = now-90d when no prior `ok` run. Orphan-sweep flips stuck `running` rows. Agency dedup: 5 RFPs from same agency_key -> 1 resolver call. |
| `src/app/api/cron/ingest-rfps/__tests__/route.test.ts` | Auth: Bearer pass, ?secret pass, both missing returns 401. Run-row created at start, updated to `ok` on success, `error` on throw. |
| `src/app/api/rfps/__tests__/route.test.ts` | Filter combinations: leaid only, stateFips only, q only, leaid+q. State (USPS) -> stateFips translation. Pagination cursor encode/decode. Default sort. Unknown filters ignored. |
| `src/lib/__tests__/states.test.ts` | `USPS_TO_FIPS` + `FIPS_TO_USPS` round-trip for all 51 jurisdictions. `abbrevToFips("XX")` returns null. Case-insensitive abbrev. |

## States (loading / empty / error)

- **Loading:** N/A (no UI).
- **Empty pull:** `RfpIngestRun.status="ok"`, all record counters = 0. No error.
- **HigherGov non-2xx:** retry 3x with exponential backoff (1s, 4s, 9s). On final failure: cron route catches, sets run status="error", returns 500. Vercel cron will retry on its own next tick.
- **HigherGov rate-limited (429):** honor `Retry-After` header if present, else exponential backoff. Same 3-retry budget.
- **Single-record normalize failure:** log via structured log (`event: "rfp_normalize_error"`), increment a `normalizeErrors` counter on the run row, continue with remaining records. Don't fail the whole run on one bad record.
- **District resolver returns null:** record stored with `leaid=null` (still queryable by `stateFips`). Counted in `recordsUnresolved`.

## Out of Scope (v1 — explicit)

- All UI: components, Zustand slice, TanStack Query hooks, `/rfps` page, district right-rail RFP panel.
- `GET /api/rfps/:id` single-record route.
- `UnmatchedRfp` model + admin view.
- `AgencyDistrictMap` persistent override table (resolver always re-derives from name in v1).
- Forecasts (`/api-external/...` forecast endpoint — separate brief if pursued).
- Coverage validation script (`scripts/rfps-coverage.ts`). First run will be eyeballed instead.
- Fuzzy matching beyond Dice ≥ 0.85. If unmatched > 30% after first real pull, plan a v2 fuzzy pass.
- Awarded contract ingest (`/sl-contract/` endpoint exists but is a separate dataset).
- Document/attachment ingest (`document_path` field is captured in `rawPayload` but not extracted).
- Consolidating the three name-normalization stop-word lists in the codebase (its own refactor).
- Refactoring cron-auth into a shared helper (its own cross-cutting refactor).

## References

- Backend context doc: `Docs/superpowers/specs/2026-05-04-rfp-feed-backend-backend-context.md`
- HigherGov API root index: `https://www.highergov.com/api-external/?format=json`
- HigherGov saved search (K-12): id `9DntNZ-D-B2pkola-09Y5`
- Sample payload fixture: `src/features/rfps/lib/__fixtures__/sample-opportunity.json` (committed in this branch)
- Closest analog feature: `news` (cron-driven ingest + entity matching, UI deferred). See `src/features/news/lib/`.
