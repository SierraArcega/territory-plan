# Implementation Plan: News Events Integration

**Date:** 2026-04-22
**Slug:** news-events-integration
**Branch:** `worktree-news-events-integration`

**References:**
- Spec: [`../specs/2026-04-22-news-events-integration-spec.md`](../specs/2026-04-22-news-events-integration-spec.md)
- Backend context: [`../specs/2026-04-22-news-events-integration-backend-context.md`](../specs/2026-04-22-news-events-integration-backend-context.md)

Cron tier confirmed: **Vercel Pro**. Rolling layer runs every 15 min.

## Phase order

```
P0 (infra)        →  P1 (data model)
                     ↓
                     P2 (ingest)  →  P3 (matcher)  →  P4 (cron wiring)
                                                     ↓
                                                     P5 (API routes)
                                                     ↓
                                                     P6 (query hooks)
                                                     ↓
                                           ┌─────────┼─────────┐
                                           P7         P8        P9
                                        (Signals)  (Home)  (Contact)
                                           ↓         ↓         ↓
                                           └────P10 (/news page)────┘
                                                     ↓
                                                P11 (final QA)
```

P7, P8, P9 can run in parallel if dispatched to separate agents.

---

## P0 — Infra and shared primitives

**0.1 Add `fast-xml-parser` dep**
- `npm install fast-xml-parser`
- Verify with `npm run build`
- **Test:** smoke import in a temp test spec

**0.2 Create shared Anthropic wrapper `src/lib/anthropic.ts`**
- Extract the direct-fetch pattern from `src/features/vacancies/lib/parsers/claude-fallback.ts`
- Export `callClaude({ model, systemPrompt, userMessage, tools?, maxTokens, temperature? })` returning typed content blocks
- Default model: `claude-haiku-4-5-20251001`
- Read `ANTHROPIC_API_KEY` from env; throw a clear error if missing
- **Refactor:** update `claude-fallback.ts` to use this wrapper (keep it passing `claude-sonnet-4-6` explicitly)
- **Tests:** `src/lib/__tests__/anthropic.test.ts` — mock fetch, verify headers, body shape, error mapping for 401/429/500

**0.3 Create `Skeleton` primitive `src/features/shared/components/Skeleton.tsx`**
- Props: `{ className?: string; variant?: 'text' | 'card' | 'thumbnail' }`
- Tailwind-only, uses plum-50 neutrals per brand tokens, `animate-pulse`
- Export from `src/features/shared/components/index.ts`
- **Tests:** `src/features/shared/components/__tests__/Skeleton.test.tsx` — variant class assertions

## P1 — Data model & migrations

**1.1 Update `prisma/schema.prisma`**
- Add `NewsArticle`, `NewsArticleDistrict`, `NewsArticleSchool`, `NewsArticleContact`, `DistrictNewsFetch`, `NewsIngestRun`, `NewsMatchQueue` per spec §Backend Design
- Add back-relations on `District`, `School`, `Contact` models

**1.2 Generate migration**
- `npx prisma migrate dev --name add_news_tables --create-only` (create-only so we can inspect/edit SQL before applying)
- Inspect generated SQL; confirm indexes on `published_at`, `feed_source`, `(leaid, confidence)`, `(priority, last_fetched_at)`

**1.3 Seed `DistrictNewsFetch`**
- Append SQL to the migration or a follow-up migration:
  ```sql
  INSERT INTO district_news_fetch (leaid, priority)
  SELECT leaid,
    (CASE WHEN is_customer THEN 100 ELSE 0 END
     + CASE WHEN has_open_pipeline THEN 50 ELSE 0 END) AS priority
  FROM districts;
  ```

**1.4 Apply migration & regen client**
- `npx prisma migrate deploy` (or `migrate dev` in dev)
- `npx prisma generate`

**Tests:** none at the schema level directly; verified indirectly by P2/P3.

## P2 — Ingest pipeline

**2.1 Config module `src/features/news/lib/config.ts`**
- `EDU_FEEDS: { id: string; url: string; source: string }[]` — Chalkbeat, K-12 Dive, The 74, EdSurge
- `BROAD_QUERIES: string[]` — 10 broad Google News RSS queries per spec
- `PER_STATE_QUERY_TEMPLATE: (stateName: string) => string` — `"school district" {state}`
- `EXCLUDED_DOMAINS: string[]` — maxpreps.com, ihsa.org, (extendable)
- `ACRONYM_MAP: Record<string, { leaid: string; state: string }>` — top 50 districts (CPS/LAUSD/NYCDOE/HISD/MCPS/DCPS/PGCPS/CMS/DISD/BPS/…); sourced from a quick SQL query against `districts` ordered by enrollment desc
- `ROLE_KEYWORDS: string[]` — superintendent, chancellor, CFO, CIO, principal, assistant superintendent (for contact matching)

**2.2 RSS fetcher `src/features/news/lib/rss.ts`**
- `fetchRssFeed(url: string): Promise<RawArticle[]>` — native `fetch` with `AbortSignal.timeout(10_000)`, parse with `fast-xml-parser`, handle both `<rss>` and `<feed>` (Atom) shapes
- `fetchGoogleNewsRss(query: string): Promise<RawArticle[]>` — URL-encodes query, hits `https://news.google.com/rss/search?q=…&hl=en-US&gl=US&ceid=US:en`
- Returns normalized `{ url, title, description, publishedAt, author?, source, imageUrl? }`
- **Tests:** `src/features/news/lib/__tests__/rss.test.ts` — feed XML fixtures (chalkbeat RSS, Atom feed, Google News RSS sample), excluded-domain filter applied

**2.3 Article upsert `src/features/news/lib/store-article.ts`**
- `upsertArticle(raw: RawArticle, feedSource: string): Promise<{ article: NewsArticle; isNew: boolean }>`
- Uses `urlHash` (sha256 of url) for idempotency — ON CONFLICT DO NOTHING returning
- Strips tracking query params before hashing (`utm_*`, `fbclid`, etc.)
- Filters excluded domains
- **Tests:** Prisma mocked; verify dedup behavior, tracking-param stripping, excluded-domain filter

**2.4 Layer orchestrator `src/features/news/lib/ingest.ts`**
- `ingestDailyLayers(runId: string): Promise<IngestStats>` — runs all 4 edu feeds + broad queries + per-state queries with p-queue concurrency=4; writes `NewsIngestRun` rows; catches per-feed errors and continues
- `ingestRollingLayer(runId: string, batchSize: number): Promise<IngestStats>` — pulls top-N rows from `DistrictNewsFetch` by `(priority DESC, last_fetched_at ASC NULLS FIRST)`, fetches Google News RSS for each, updates `last_fetched_at` and `last_status`
- `ingestOneDistrict(leaid: string): Promise<IngestStats>` — Layer 4 on-demand
- **Tests:** integration-style with mocked `fetchRssFeed`, Prisma mocked; verify run bookkeeping, error isolation per feed, queue update

## P3 — Matcher

**3.1 State extractor `src/features/news/lib/extract-states.ts`**
- `extractStates(text: string): string[]` — regex for US state full names and postal abbreviations (word-boundary)
- **Tests:** fixtures covering full-name, abbrev, multi-state, false positives ("Mississippi Burning" as movie)

**3.2 Keyword matcher `src/features/news/lib/matcher-keyword.ts`**
- `matchArticleKeyword(article, { districts, schools, contacts }): KeywordMatches`
- Reuses `dice` / `normalize` helpers from `src/features/vacancies/lib/school-matcher.ts` and noise-word stripping from `post-processor.ts`
- Returns `{ confirmedDistricts, confirmedSchools, confirmedContacts, ambiguousCandidates }`
- Confidence is `'high'` when: district.name is found as substring AND district's state is in article's `stateAbbrevs` AND no other district in a different state shares this name → auto-link
- Ambiguous (goes to queue): district name match but multiple states have the same district name; OR bare contact name without title keyword AND no district anchor; OR school name without district anchor
- **Tests:** fixtures for clear matches, ambiguous names (Lincoln, Madison), acronym hits, state-scoping

**3.3 LLM matcher `src/features/news/lib/matcher-llm.ts`**
- `matchArticleLLM(article, candidates): Promise<LlmMatches>` — calls `callClaude()` with Haiku, short system prompt, JSON output via tool use
- Prompt asks: "Which entities are actually the subject of this article? Return JSON [{ entityType, entityId, confirmed: bool, reason }]"
- Validates JSON shape with zod; silently drops invalid rows, logs warning
- **Tests:** mocked `callClaude`; verify prompt shape, JSON validation, graceful degradation on malformed response

**3.4 Matcher orchestrator `src/features/news/lib/matcher.ts`**
- `matchArticles(articleIds: string[], { runId }): Promise<MatchStats>` — Pass 1 on all; queue ambiguous for Pass 2
- `processMatchQueue(limit = 20): Promise<QueueStats>` — runs Pass 2, called at end of each cron run
- Candidate narrowing: before calling Pass 1 or populating queue, pre-fetch districts/schools/contacts scoped to the article's `stateAbbrevs` to keep candidate lists small
- **Tests:** end-to-end with mocked LLM — verify Pass 1 + Pass 2 paths, queue behavior

## P4 — Cron wiring

**4.1 `src/app/api/cron/ingest-news-daily/route.ts`**
- Copy auth + bearer-token pattern from `src/app/api/cron/scan-vacancies/route.ts`
- Export `GET` handler; call `ingestDailyLayers` then `processMatchQueue`
- `export const maxDuration = 300` (Vercel)
- Return `{ runId, stats }`
- **Tests:** integration test — mock ingest/matcher fns, verify auth rejection on bad secret, happy-path response

**4.2 `src/app/api/cron/ingest-news-rolling/route.ts`**
- Same pattern; call `ingestRollingLayer(runId, 50)` then `processMatchQueue`
- **Tests:** same shape

**4.3 `vercel.json`**
- Add the two cron entries per spec
- **Tests:** JSON lint only; no runtime

## P5 — API routes

**5.1 `src/app/api/news/route.ts` (GET)**
- Supports query params `leaid`, `schoolId` (ncessch), `contactId`, `territoryPlanId`, `since`, `limit`
- Auth via `getUser()` from `src/lib/supabase/server.ts`
- Joins against appropriate `NewsArticle*` table based on which param is set
- Response: `{ articles: NewsArticleDto[] }` where DTO strips `urlHash` + any internal fields
- Default `limit=10`, max `100`
- **Tests:** `src/app/api/news/__tests__/route.test.ts` — each filter path, auth required, limit clamping

**5.2 `src/app/api/news/refresh/[leaid]/route.ts` (POST)**
- Auth via `getUser()`
- In-memory rate-limit map: `Map<leaid, lastRefreshedAt>`; 429 if <60s since last
- Calls `ingestOneDistrict(leaid)`, then `matchArticles(newArticleIds)`
- Returns `{ newArticles: number }`
- Await `params` per Next 16 convention
- **Tests:** rate-limit behavior, auth, happy path

## P6 — TanStack Query hooks

**6.1 `src/features/news/lib/queries.ts`**
- `useDistrictNewsQuery(leaid, opts?)` — `staleTime: 10 * 60 * 1000`
- `useTerritoryNewsQuery({ territoryPlanId }, opts?)` — `staleTime: 5 * 60 * 1000`
- `useContactNewsQuery(contactId)` — `staleTime: 10 * 60 * 1000`
- `useRefreshNewsMutation()` — `mutationFn: POST /api/news/refresh/{leaid}`, on success invalidates the matching `districtNews` query key; exposes `newArticles` count for toast
- Query keys: `['news','district',leaid]`, `['news','territory',planId]`, `['news','contact',contactId]`
- **Tests:** `src/features/news/lib/__tests__/queries.test.ts` using `renderHook` + `QueryClientProvider` wrapper (existing pattern in `vacancies`)

## P7 — UI: Signals-tab news section (parallel with P8, P9)

**7.1 `NewsCard` `src/features/news/components/NewsCard.tsx`**
- Per spec §Visual Design
- Props: `{ article: NewsArticleDto; onClick?(): void }`
- Uses `timeAgo`, `cn`, tokens from `Documentation/UI Framework/tokens.md`
- Image fallback: source-letter avatar on plum-50 bg
- **Tests:** render with + without imageUrl, click target, aria-label, long-title truncation

**7.2 `NewsCardCompact` `src/features/news/components/NewsCardCompact.tsx`**
- Minimal variant for contact sidebar
- **Tests:** render, click target

**7.3 `NewsSection` `src/features/news/components/NewsSection.tsx`**
- Wraps `useDistrictNewsQuery` + `useRefreshNewsMutation`
- Renders: header with refresh button, 3 skeletons while loading, empty state, list of NewsCards, "View all" link at bottom
- Handles refresh click: call mutation, show inline spinner on button, display toast-like inline message with returned count (auto-dismiss after 3s)
- **Tests:** loading / empty / list / error state renders, refresh button disable during mutation

**7.4 Wire into `SignalsTab`**
- `src/features/map/components/panels/district/tabs/SignalsTab.tsx` — prepend `<NewsSection leaid={district.leaid} />` before existing signal cards
- **Tests:** update existing SignalsTab tests to assert NewsSection renders

**7.5 `NewsListOverlay` `src/features/news/components/NewsListOverlay.tsx`**
- "View all" opens right-panel overlay
- Filters: date range (select presets), source (multi-select from distinct sources in the list), confidence (toggle to show `'llm'` matches)
- Paginated by `limit` bump (load 10 more on scroll)
- **Tests:** filter state interactions, pagination

## P8 — UI: Home dashboard news card (parallel)

**8.1 `HomeNewsCard` `src/features/news/components/HomeNewsCard.tsx`**
- Wraps `useTerritoryNewsQuery({ territoryPlanId })` — but the home view may not have a single plan; use the union of user's plans
- Needs: new API filter `userTerritory=true` (all plans owned by the authenticated user) OR a `useMyTerritoryNewsQuery()` hook that unions multiple plans in a single call
- Decision: add `GET /api/news?scope=my-territory` path for cleanness
- Renders up to 10 NewsCards, each with district chip below title
- Hides card entirely if 0 articles
- **Tests:** 0 articles → no render; N articles → correct chips; loading state

**8.2 Wire into `HomeView`**
- `src/features/home/components/HomeView.tsx` — insert `<HomeNewsCard />` above existing feed
- **Tests:** home renders news card above feed

## P9 — UI: Contact sidebar mentions (parallel)

**9.1 Identify where contacts are rendered**
- Backend discovery didn't explicitly enumerate; find by grep for `Contact` UI usage in right panel + search results
- Most likely: `src/features/map/components/right-panels/` and `src/features/map/components/SearchResults/`

**9.2 `ContactNewsMentions` `src/features/news/components/ContactNewsMentions.tsx`**
- Wraps `useContactNewsQuery(contact.id)`
- Renders up to 3 `NewsCardCompact`s under a "Mentions in news" heading
- Hides section entirely if 0 matches; silent fail on error
- **Tests:** 0 / N article render paths

**9.3 Wire into existing contact surfaces**
- Add `<ContactNewsMentions contactId={c.id} />` after the LinkedIn row in contact expanded cards
- **Tests:** integration — contact card shows news section when articles present

## P10 — Dedicated `/news` page

**10.1 `src/app/news/page.tsx`**
- Server component skeleton + client `NewsPageClient`
- Default view: `useTerritoryNewsQuery` with user's all-territory scope
- Filters: source, date range, district multi-select (from user's territories)
- Uses existing page shell from `src/features/shared/components/layout/`
- **Tests:** `src/app/news/__tests__/page.test.tsx` — filter URL sync, empty state, results render

## P11 — Final QA & tests

**11.1 Run full test suite**
- `npx vitest run`
- Fix any regressions from touching `claude-fallback.ts` or `SignalsTab`

**11.2 Build check**
- `npm run build` — must pass with zero errors

**11.3 Manual smoke**
- `npx next dev -p 3005`; open a district panel, verify Signals-tab news section renders skeletons → empty state (since no articles ingested yet in dev)
- Hit `GET /api/cron/ingest-news-daily` with the cron secret to populate some articles
- Reopen district; confirm news cards render with correct thumbnails, times, confidence pills
- Click Refresh — confirm behavior, rate limit

**11.4 Architectural doc updates**
- `docs/architecture.md`: add `news` to Feature Directory Map table
- `Documentation/.md Files/TECHSTACK.md`: add `NewsArticle` + join tables to Database Schema Overview; add `/api/news/*` and `/api/cron/ingest-news-*` to API Route Structure; add `NEWS_API_KEY` env var note (optional, not wired up in this PR)

## Test strategy summary

| Phase | Test focus | Files |
|---|---|---|
| P0 | Wrapper + primitive unit tests | 2 test files |
| P1 | (schema — indirect) | — |
| P2 | RSS parse fixtures, upsert idempotency | 2 test files |
| P3 | Matcher pass 1/2, state extract, LLM prompt | 3-4 test files |
| P4 | Cron auth + orchestration | 2 test files |
| P5 | API filter paths, auth, rate limit | 2 test files |
| P6 | Hook cache keys + invalidation | 1 test file |
| P7-P9 | Component states + interactions | 4-5 test files |
| P10 | Filter URL sync + render | 1 test file |

All tests use the existing `fetch`-mock pattern from `src/test/setup.ts`. Prisma mocked per spec (`vi.mock("@/lib/prisma", ...)` — see `src/app/api/tasks/__tests__/route.test.ts`).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Google News RSS changes output format / rate-limits us | Wrap in try/catch per feed; `NewsIngestRun.error` captures; Layer 1 edu feeds still produce data |
| `fast-xml-parser` fails on one feed's XML quirks | Per-feed parser config; feed-specific normalizers if needed |
| Matcher false-positive for common-name contacts | Require district anchor + role keyword; LLM pass filters remainder |
| LLM cost runs higher than projection | Cap `processMatchQueue` per run (≤50 articles); add kill switch env var `NEWS_LLM_ENABLED=false` |
| Vercel Cron runs overlap (daily + rolling at the same minute) | Use `NewsIngestRun.status='running'` as an advisory lock; skip new run if one is already running |
| Migration on prod takes too long (13k DistrictNewsFetch rows) | Seed insert runs in <1s; verified on local |
| Home dashboard query fan-out is slow for users with many territories | Add composite index `(published_at DESC)` + denormalize `territory_plan_id` into a materialized view only if EXPLAIN shows >100ms; defer until measured |
