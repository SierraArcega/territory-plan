# News Coverage Monitoring in Admin Dashboard

**Date:** 2026-04-22
**Status:** Design — pending implementation
**Scope:** v1 admin-dashboard visibility for the news ingestion pipeline, modelled on the existing vacancy monitoring pattern.

## Problem

News ingestion is already running in production: `news_articles` (~12K rows), `news_article_districts` (~6.5K matches), `district_news_fetch` (~19K fetch records), and `news_ingest_runs` (~26 runs) all exist in the DB and are being populated. Nothing in the admin dashboard surfaces its health or coverage, so there is no way to answer basic operational questions ("is the pipeline healthy right now?", "are we covering our customers?") without writing SQL by hand.

The vacancy ingestion pipeline already has a mature monitoring pattern in the admin dashboard (`VacancyScanCard` + the sync log on the Data Sync tab). This spec brings the news pipeline to parity with that pattern.

## Goals

1. At-a-glance answer to **"is the news ingestion pipeline healthy?"** (last run status, failure count, throughput).
2. At-a-glance answer to **"are we covering the districts we care about?"** — where "care about" means customers, pipeline accounts, or districts in any territory plan.
3. A unified sync log that shows both data-refresh and news-ingest runs in a single paginated/filterable table.

## Non-goals (v1)

- No mutations — no "retry failed" or "trigger run" buttons.
- No drill-down — no per-state or per-district coverage views.
- No content-quality metrics — no relevance distribution, sentiment breakdown, duplicate rate.
- No DB migrations. No Prisma model additions. News tables stay outside Prisma; the admin UI reads via raw SQL through `src/lib/db.ts`.
- No changes to the ingest pipeline itself.
- No alerting integration (Slack/email/etc).

See v2 direction at the bottom for where these go later.

## Scope decisions (locked with user)

| Question | Decision |
|---|---|
| Primary focus | Pipeline health + customer coverage |
| Coverage definition | Tiered: green = article in last 30d; amber = fetch attempt in last 30d with no article; red = no fetch in last 30d |
| Coverage denominator | Districts where `is_customer = true` OR `has_open_pipeline = true` OR present in `territory_plan_districts`, deduplicated |
| Interactivity | Read-only |
| Placement | Rename "Data Sync" tab → "Ingest Health"; both monitoring cards live at top |
| Drill-down | None — aggregate stats only |
| Sync log integration | Unified view-layer: one table shows rows from both `data_refresh_logs` and `news_ingest_runs`, normalized to common columns; news-specific fields (`articles_dup`, `districts_processed`, `llm_calls`, `layer`) exposed in the expanded row detail |

## Architecture

```
Admin nav: "Ingest Health" tab (renamed from "Data Sync")
│
├─ VacancyScanCard         ← unchanged, reuses /api/admin/vacancy-scan-stats
├─ NewsIngestCard          ← NEW, hits /api/admin/news-ingest-stats
└─ Unified sync log table  ← existing component, now fed by extended /api/admin/sync
                              which merges data_refresh_logs + news_ingest_runs
```

**Unification layer:** API-level (TypeScript normalizer in the route handler), not a DB view. Data volumes are small (tens to hundreds of visible rows); the merge-sort cost in memory is negligible. DB-layer unification (via a Postgres view) is the right move if `news_ingest_runs` grows past ~10K rows — noted as v2 migration path.

### Data flow

**Card:** `NewsIngestCard` → `useAdminNewsStats` (TanStack Query) → `GET /api/admin/news-ingest-stats` → handler runs ~5 parallel SQL queries via `Promise.all` against `news_ingest_runs`, `news_articles`, `district_news_fetch`, `districts`, `territory_plan_districts` → returns a typed stats blob.

**Log:** `DataSyncTab` → existing `useAdminSync` → `GET /api/admin/sync` (extended) → handler fetches from both `data_refresh_logs` and `news_ingest_runs`, normalizes each row through `ingest-log-normalizer`, merge-sorts by `started_at DESC`, paginates, returns. News rows carry an optional `detail` object for the expanded-row UI.

## API contracts

### New: `GET /api/admin/news-ingest-stats`

```ts
{
  articles: {
    last7d: number;
    prior7d: number;                 // for delta display
  };
  coverage: {
    targetDistrictCount: number;     // denominator
    green: number;                   // article in last 30d
    amber: number;                   // fetch attempted in 30d, no article
    red: number;                     // no fetch in 30d
    percentGreen: number;            // green / targetDistrictCount * 100
  };
  lastRun: {
    finishedAt: string | null;
    status: 'success' | 'failed' | 'running' | 'pending' | null;
    layer: string | null;
  };
  failures24h: number;
  layerBreakdown: Array<{
    layer: string;
    runsLast24h: number;
    lastStatus: 'success' | 'failed' | 'running' | 'pending';
  }>;
  health: 'green' | 'amber' | 'red';
}
```

Health thresholds (constant at top of route; tune after observing real numbers). Evaluated in this order — the first matching rule wins:
1. **Green override** — `targetDistrictCount === 0` (nothing to cover is not a failure)
2. **Red** — `failures24h > 3` OR `percentGreen < 40`
3. **Amber** — `percentGreen < 70` OR last run > 24h old OR last run status is `failed`
4. **Green** — otherwise (coverage ≥70, last run ≤24h old, last run succeeded, ≤3 failures)

Boundaries are inclusive on the green side: 70.0% exactly → green; 40.0% exactly → amber; 39.9% → red.

### Extended: `GET /api/admin/sync`

Unified row shape:
```ts
{
  id: string;                        // prefixed: "drl:123" or "nir:<text-id>"
  source: string;                    // data_source for DRL; `news:${layer}` for NIR
  status: 'success' | 'failed' | 'running' | 'pending';
  recordsUpdated: number | null;     // articles_new for NIR
  recordsFailed: number | null;      // null for NIR (no equivalent)
  startedAt: string;
  completedAt: string | null;        // finished_at for NIR
  durationMs: number | null;
  errorMessage: string | null;
  detail?: {                         // only populated for news rows
    articlesDup: number;
    districtsProcessed: number;
    llmCalls: number;
    layer: string;
  };
}
```

**Merge strategy in the handler:**
1. Fetch up to `offset + limit` rows from each table sorted by `started_at DESC`, applying source/status filters server-side where possible.
2. Merge-sort the two result sets on `started_at`.
3. Apply `offset + limit` on the merged array.

**Filter-based optimization:** if a `source` filter is set and resolves only to one table (e.g., `source = 'news:*'` or a specific `data_source`), skip the other query entirely.

**Backwards-compat note:** the `id` field changes from a bare integer to a prefixed string (`drl:123`). Must grep for consumers keying on numeric id before implementation and update them.

## Component spec: `NewsIngestCard`

Visually mirrors `VacancyScanCard`: same container, same 4-stat grid, same health-color semantics.

**Top row — 4 stats:**

| Stat | Value |
|---|---|
| Articles (7d) | count in last 7d, with delta vs prior 7d |
| Districts Covered | count of target districts with article in 30d |
| Coverage % | `green / targetDistrictCount * 100` |
| Last Run | relative time of `news_ingest_runs.finished_at` most recent; sub-label shows "N failures in 24h" |

**Below the stats:**
- Segmented progress bar showing green / amber / red split across target district set (same visual language as vacancy's platform breakdown)
- Up to 5 ingest-layer chips showing runs in last 24h and last status per layer (parallels vacancy's top-4 platform chips). Ranking: `runsLast24h DESC`, ties broken by most recent `started_at DESC`.

**Card-level health color:** from the `health` field on the stats response (computed server-side).

**States:**
- Loading: skeleton grid (matches VacancyScanCard loading state)
- No runs yet (`lastRun.finishedAt === null`): card renders with "No runs yet" text, health red (pipeline isn't running)
- Nothing to cover (`targetDistrictCount === 0`): card renders normally with coverage "—" and health green per override rule (distinct from "no runs")
- Error: inline error banner using brand tokens

## Edge cases

1. **Empty target district set** (new tenant): render coverage % as "—" (not `NaN%`); health = green by default.
2. **Article matched to multiple districts:** coverage counts distinct districts with ≥1 article, not articles. Denominator unaffected.
3. **Fetch without confirmed status** (`district_news_fetch.last_status` null): treat as amber (attempted, unconfirmed).
4. **Many ingest layers:** cap layer breakdown chips to top 5 by recent run count.
5. **Running row** (`finished_at` null): duration renders as "—"; status badge "running".

## Error handling

- DB query failure → route returns 500; hook surfaces existing error card pattern from VacancyScanCard (or simple inline banner).
- Partial query failure (one of 5 parallel queries fails) → fail the whole request. Avoids misleading health states from missing denominators.
- No runs yet → empty state (not an error).

## File layout

**New:**
```
src/features/admin/components/
  NewsIngestCard.tsx                   (~120 lines, mirrors VacancyScanCard)
  __tests__/NewsIngestCard.test.tsx

src/features/admin/hooks/
  useAdminNewsStats.ts

src/features/admin/lib/
  ingest-log-normalizer.ts             (pure fn: news_ingest_runs row → unified shape)
  __tests__/ingest-log-normalizer.test.ts

src/app/api/admin/news-ingest-stats/
  route.ts
  __tests__/route.test.ts              (if admin routes have tests — match existing convention)
```

**Modified:**
```
src/app/api/admin/sync/route.ts        (extend to merge both tables via normalizer)
src/features/admin/components/
  AdminDashboard.tsx                   (rename tab label + URL slug; add alias for old slug)
  DataSyncTab.tsx                      (add <NewsIngestCard /> alongside <VacancyScanCard />;
                                        rename file to IngestHealthTab.tsx for grep-ability)
  SyncLogRow (wherever expanded row lives)
                                       (render news `detail` block when present)
```

**URL slug:** `?section=data-sync` → `?section=ingest-health`. Add a redirect/alias in `AdminDashboard.tsx` so old bookmarks continue to work.

**Explicitly untouched:** `prisma/schema.prisma` (news tables remain outside Prisma), the news ingest pipeline itself, any mutation endpoints.

## Testing

Vitest + Testing Library, co-located in `__tests__/`.

**Unit tests (highest value):**
- `ingest-log-normalizer.test.ts`:
  - NIR row → unified row with correct `source` prefix (`news:${layer}`)
  - `articles_new` → `recordsUpdated`
  - `recordsFailed` null for news rows
  - `detail` contains `articlesDup`, `districtsProcessed`, `llmCalls`, `layer`
  - Duration null when `finished_at` null; computed correctly when set
  - All four status values pass through

**API route tests:**
- `news-ingest-stats/route.test.ts` (if admin has route tests — otherwise skip and match convention):
  - Denominator correctly unions customers + pipeline + in-plan, deduplicated
  - Tier classification matches green/amber/red definitions
  - Health computation: table-driven test over threshold boundaries
  - Empty state: no runs → `lastRun = null`, `health = 'red'`
- Extended `sync/route.ts`:
  - Merged response ordered by `started_at DESC` across both tables
  - `source = 'news:*'` filter skips DRL query; reverse for DRL-only filter
  - Pagination correct after merge (offset/limit post-merge)
  - `detail` present on news rows, absent on DRL rows

**Component test:**
- `NewsIngestCard.test.tsx`:
  - Renders all 4 stats with mocked query data
  - Health color classes applied per threshold
  - Skeleton on pending; empty state when `lastRun` null
  - Matches `VacancyScanCard.test.tsx` structure if it exists

**Not testing:** the ingest pipeline itself, visual regression (no Chromatic), E2E (no Playwright/Cypress in repo currently).

**Verification before claiming done:**
1. `npm test` passes
2. `npm run dev` on port 3005; visit `/admin?section=ingest-health`; confirm card renders with real data
3. Sanity-check coverage % against direct SQL run

## Performance notes (per CLAUDE.md rules)

- TanStack Query keys use serialized primitives: `['admin','news-ingest-stats']`, `['admin','sync',page,source,status]`. No raw objects.
- Stats endpoint: 60s stale time, refetch on window focus (matches VacancyScanCard).
- Card does not render lists, so pagination rules (`<50 items`, filter hint at 200+) don't apply to the card itself. The sync log inherits pagination from the existing implementation.
- Components subscribe to narrow query slices; no broad store subscriptions needed (admin feature doesn't touch the map Zustand store).

## v2 direction (documented, not built)

- State-level coverage heatmap + searchable per-district table for blind-spot identification
- Retry-failed and manual-trigger actions (would require new mutation endpoints + ingest-pipeline hooks)
- Content-quality card: relevance distribution, unclassified backlog, duplicate rate, sentiment mix
- News Config tab parallel to Vacancy Config (keyword/feed/source management)
- Alerting integration on threshold breach (Slack/email)
- If `news_ingest_runs` grows past ~10K rows, migrate unification from API merge-sort to a Postgres view (Approach 1 → Approach 2)
