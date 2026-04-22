# Feature Spec: News Events Integration

**Date:** 2026-04-22
**Slug:** news-events-integration
**Branch:** `worktree-news-events-integration`
**Backend context:** [`2026-04-22-news-events-integration-backend-context.md`](./2026-04-22-news-events-integration-backend-context.md)

## Requirements

Fullmind sales reps need K-12 news context on the districts, schools, and contacts in their territories. News helps them spot openings (superintendent changes, budget crises, curriculum adoptions, referendum outcomes) and time their outreach. The NewsAPI.org key the user added does not cover K-12 education outlets well — probes showed 0 results for mid-sized districts and 0 hits on Chalkbeat / EdWeek / K-12 Dive domains. The feature must use a corpus with actual education coverage.

**Architecture:** collect a broad K-12 news firehose, then match articles to specific districts, schools, and contacts — not per-entity RSS querying. This dedupes, scales to all 13k districts, and lets new contacts retroactively pick up prior coverage.

**In scope:**
- Ingest pipeline with 4 layers (national edu RSS, broad Google News RSS, per-state queries, rolling per-district queries)
- Tiered matcher (Direction C: keyword auto-link + Claude Haiku disambiguation)
- Data model: `NewsArticle` + 3 join tables + supporting bookkeeping tables
- UI: Signals-tab news section (District panel) + Home dashboard news card + contact-sidebar mentions
- On-demand "Refresh news" button on the District panel
- Excluded-sources filter (sports-only sites)

**Out of scope:**
- Full article body scraping beyond RSS content field
- User read/unread state or bookmarks
- Email digests
- Push notifications when a priority district hits news
- Admin UI for tuning acronym map or excluded-domains list (flat TS config for now)
- NewsAPI.org integration (kept as optional future enrichment; not wired up in this PR)

**Success criteria:**
- 7 days after ship, at least 80% of customer districts have ≥1 matched article
- `NewsArticleDistrict` rows with `confidence='high'` have <5% false-positive rate on spot check (20 randomly sampled articles)
- Signals-tab news section renders in <200ms when articles are present (hits local DB, not external)

## Visual Design

Approved direction (see Stage 3 refinement in session log).

**District panel — Signals tab:**
- New collapsible section "Recent News" pinned to top of tab (above existing signal cards)
- Up to 5 most recent articles from `NewsArticleDistrict` where `confidence ∈ ('high', 'llm')`, ordered `publishedAt DESC`
- "Refresh news" button top-right of the section (icon + label), disabled during fetch, toasts on completion
- "View all" link at bottom → opens right-panel overlay with full article list and filters (date range, source, confidence)

**NewsCard primitive:**
- Follows the existing `SignalCard` shell: `border border-gray-100 rounded-xl bg-white`, plum `#403770` body text
- Layout: 48×48 thumbnail (article `imageUrl` with fallback to source-letter avatar on plum-50 bg) + title + 1-line description (truncated, 2 lines max) + footer row with source domain, relative time (`timeAgo` helper), confidence pill if LLM-matched
- Entire card is clickable; opens `url` in new tab with `rel="noopener noreferrer"`
- Hover: bg shifts to plum-50, right-arrow icon appears
- Focus-visible: 2px plum outline

**Home dashboard:**
- New card "Territory news" inserted in `HomeView`, above the existing feed
- Up to 10 articles where any linked district is in the current user's territory plans (joined via `TerritoryPlanDistrict`)
- Each card shows a district-name chip beneath the title ("Cobb County School District, GA")
- "See all →" link opens `/news` (new route) with filters

**Contact sidebar:**
- When a contact card is expanded, new "Mentions in news" section below LinkedIn row
- Up to 3 articles from `NewsArticleContact`
- Minimal variant of `NewsCard` — no thumbnail, no description; source + title + time only
- Section hidden if no matches

**Empty / loading / error states:**
- Loading: 3 skeleton cards (build `Skeleton` primitive — doesn't exist yet per backend discovery)
- Empty (Signals tab): plum-subtle panel "No recent news for this district. News refreshes every ~2 days, or click Refresh." Uses the token neutrals from `Documentation/UI Framework/tokens.md` (no Tailwind grays).
- Empty (Home): hide the card entirely if zero articles — don't render an empty state on the dashboard.
- Error: inline banner "Couldn't load news. Retry." preserves any previously loaded cards below it.

## Component Plan

**Reuse (existing):**
- `SignalsTab` shell — `src/features/map/components/panels/district/tabs/SignalsTab.tsx` (add "Recent News" section; keep existing signal cards below)
- `timeAgo` from `src/features/shared/lib/pretty-duration.ts`
- `cn` from `src/features/shared/lib/cn.ts`
- Dice-coefficient fuzzy matcher from `src/features/vacancies/lib/school-matcher.ts` + noise-word stripping from `src/features/vacancies/lib/post-processor.ts`
- TanStack Query patterns from `src/features/vacancies/lib/queries.ts`
- Cron-auth pattern from `src/app/api/cron/scan-vacancies/route.ts`

**New components (`src/features/news/components/`):**
- `NewsCard.tsx` — primary card (thumbnail variant)
- `NewsCardCompact.tsx` — contact-sidebar variant (no thumbnail)
- `NewsSection.tsx` — Signals-tab section with refresh button, skeleton/empty/error states
- `HomeNewsCard.tsx` — home dashboard wrapper showing district chip
- `NewsListOverlay.tsx` — "View all" right-panel overlay with filters
- `Skeleton.tsx` — shared primitive at `src/features/shared/components/Skeleton.tsx` (doesn't exist yet; used by news but generically useful)

**New routes (`src/app/api/news/`):**
- `route.ts` — `GET` with filters: `?leaid=`, `?schoolId=`, `?contactId=`, `?territoryPlanId=`, `?since=`, `?limit=` (auth: `getUser()`)
- `refresh/[leaid]/route.ts` — `POST` triggers on-demand per-district refresh (auth + 1/min rate limit per district)

**New cron routes (`src/app/api/cron/`):**
- `ingest-news-daily/route.ts` — nightly: pulls Layers 1 + 2 (edu RSS + broad queries + per-state queries), runs matcher
- `ingest-news-rolling/route.ts` — rolling: pulls next batch from `DistrictNewsFetch` queue, runs matcher

**New app page (`src/app/news/`):**
- `page.tsx` — territory news list view (filters: source, date range, district)

## Backend Design

Full context: [`2026-04-22-news-events-integration-backend-context.md`](./2026-04-22-news-events-integration-backend-context.md).

### New models

```prisma
model NewsArticle {
  id           String   @id @default(cuid())
  url          String   @unique @db.VarChar(2000)
  urlHash      String   @unique @map("url_hash") @db.VarChar(64)  // sha256 for cheap uniqueness
  title        String   @db.VarChar(500)
  description  String?
  content      String?
  imageUrl     String?  @map("image_url") @db.VarChar(1000)
  author       String?  @db.VarChar(255)
  source       String   @db.VarChar(255)       // domain, e.g. "chalkbeat.org"
  feedSource   String   @map("feed_source") @db.VarChar(40)  // 'chalkbeat'|'k12dive'|'the74'|'edsurge'|'google_news_query'|'google_news_district'|'manual_refresh'
  publishedAt  DateTime @map("published_at")
  fetchedAt    DateTime @default(now()) @map("fetched_at")
  stateAbbrevs String[] @map("state_abbrevs") @db.VarChar(2)   // states detected in article

  districts NewsArticleDistrict[]
  schools   NewsArticleSchool[]
  contacts  NewsArticleContact[]

  @@index([publishedAt])
  @@index([feedSource])
  @@map("news_articles")
}

model NewsArticleDistrict {
  articleId  String
  leaid      String   @db.VarChar(7)
  confidence String   @db.VarChar(10)  // 'high' | 'llm' | 'low'
  createdAt  DateTime @default(now()) @map("created_at")
  article    NewsArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)
  district   District    @relation(fields: [leaid], references: [leaid])
  @@id([articleId, leaid])
  @@index([leaid, confidence])
  @@map("news_article_districts")
}

model NewsArticleSchool   { /* articleId, ncessch, confidence — same shape */ }
model NewsArticleContact  { /* articleId, contactId, confidence — same shape */ }

model DistrictNewsFetch {
  leaid          String   @id @db.VarChar(7)
  lastFetchedAt  DateTime? @map("last_fetched_at")
  priority       Int      @default(0)   // higher runs first; customers=+100, open pipeline=+50
  lastStatus     String?  @map("last_status") @db.VarChar(20)  // 'ok'|'error'|'empty'
  lastError      String?  @map("last_error")
  district       District @relation(fields: [leaid], references: [leaid], onDelete: Cascade)
  @@index([priority, lastFetchedAt])
  @@map("district_news_fetch")
}

model NewsIngestRun {
  id           String   @id @default(cuid())
  layer        String   @db.VarChar(20)  // 'daily' | 'rolling'
  startedAt    DateTime @default(now()) @map("started_at")
  finishedAt   DateTime? @map("finished_at")
  articlesNew  Int      @default(0) @map("articles_new")
  articlesDup  Int      @default(0) @map("articles_dup")
  districtsProcessed Int @default(0) @map("districts_processed")
  llmCalls     Int      @default(0) @map("llm_calls")
  status       String   @db.VarChar(20)  // 'running'|'ok'|'error'
  error        String?
  @@index([layer, startedAt])
  @@map("news_ingest_runs")
}

model NewsMatchQueue {
  articleId     String   @id
  candidates    Json                    // { districts: [{leaid,name,state}], schools: [...], contacts: [...] }
  processedAt   DateTime? @map("processed_at")
  createdAt     DateTime @default(now()) @map("created_at")
  article       NewsArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)
  @@index([processedAt])
  @@map("news_match_queue")
}
```

Migration: `prisma/migrations/<timestamp>_add_news_tables/migration.sql`. `DistrictNewsFetch` gets seeded for all existing districts with priority computed from `isCustomer`/`hasOpenPipeline`.

### Ingest layers

**Layer 1 — National edu firehose** (runs in `ingest-news-daily`):
- Feeds: Chalkbeat (`https://www.chalkbeat.org/arc/outboundfeeds/rss/?outputType=xml`), K-12 Dive (`https://www.k12dive.com/feeds/news/`), The 74 (`https://www.the74million.org/feed/`), EdSurge (`https://www.edsurge.com/articles_rss`)
- Excluded domains: `maxpreps.com`, `ihsa.org`, plus a configurable list in `src/features/news/lib/config.ts`

**Layer 2 — Broad Google News RSS** (runs in `ingest-news-daily`):
- Static query list (`src/features/news/lib/config.ts`): `"school district" budget`, `"school district" lawsuit`, `"school board" election`, `"superintendent" (resigned OR appointed OR fired)`, `"public schools" (strike OR walkout OR vote)`, `"curriculum adoption" schools`, `"referendum" schools`, ~10 queries total
- Per-state queries: 50 queries — `"school district" <state name>` for each US state

**Layer 3 — Rolling per-district** (runs in `ingest-news-rolling`):
- Each run pulls ~50 districts from `DistrictNewsFetch` ordered by `(priority DESC, lastFetchedAt ASC NULLS FIRST)`
- For each: Google News RSS query `"{District.name}" {city or state}` (pick whichever disambiguates — city if `cityLocation` exists, else state)
- Ingest, matcher runs, update `lastFetchedAt` / `lastStatus`

**Layer 4 — On-demand refresh:**
- `POST /api/news/refresh/{leaid}` runs the Layer 3 per-district query synchronously, rate-limited 1/min per district via in-memory map (or Redis if present — check; backend discovery says no Redis found)

### Matcher (Direction C tiered)

`src/features/news/lib/matcher.ts` — runs after each ingest batch.

**Pass 1 (keyword auto-link):**
1. Extract US state mentions from `title + description` via regex (full names + postal abbrevs) → populates `stateAbbrevs`
2. For each detected state:
   - Candidate districts = `District.where(stateAbbrev = S)` (cached by state)
   - For each candidate: test article text for exact `District.name` match OR acronym-map hit. Acronym map is a hand-curated `Record<string, { leaid: string; state: string }>` in `src/features/news/lib/acronyms.ts` (~50 entries: CPS/LAUSD/NYCDOE/…)
   - If match AND district.name isn't also present in another state's district set (check uniqueness) → write `NewsArticleDistrict(confidence='high')`
3. For each high-confidence district match:
   - Candidate schools = `School.where(leaid = matched)` — scan for exact `School.name` → write `NewsArticleSchool(confidence='high')`
   - Candidate contacts = `Contact.where(leaid = matched)` — require contact.name co-occurrence AND title-keyword co-occurrence (superintendent/CFO/CIO/etc.) → write `NewsArticleContact(confidence='high')`

**Pass 2 (LLM disambiguation):**
- Articles with partial hits (ambiguous district name across states, bare contact name without district context, orphaned school name) get queued in `NewsMatchQueue` with candidate list
- Separate worker function `processMatchQueue()` in the same cron: pulls up to 20 queued articles, batches into one Haiku call per article (to keep prompts small):
  - Input: article title + description + state-scoped candidate list (≤10 entities)
  - Output: JSON `[{ entityType, entityId, confirmed, reason }]`
  - Writes confirmed matches with `confidence='llm'`

**New shared module `src/lib/anthropic.ts`:**
- Extract the direct-fetch pattern from `src/features/vacancies/lib/parsers/claude-fallback.ts`
- Signature: `callClaude({ model, systemPrompt, userMessage, tools?, maxTokens })`
- Default model: `claude-haiku-4-5-20251001` per the environment note
- Vacancy-scanner's existing code is refactored to use this wrapper (in-scope cleanup — small touch)

### New dependency

- `fast-xml-parser` (RSS parsing). No existing RSS dep in `package.json`.

### API routes

All follow existing conventions (NextResponse.json, `getUser()` auth, Next 16 `params: Promise<…>`).

- `GET /api/news?leaid=&schoolId=&contactId=&territoryPlanId=&since=&limit=` — returns matched articles
- `POST /api/news/refresh/[leaid]` — on-demand refresh, rate-limited
- `GET /api/cron/ingest-news-daily` — protected by `CRON_SECRET` (Bearer header OR `?secret=`), Vercel Cron target
- `GET /api/cron/ingest-news-rolling` — same protection

### TanStack Query hooks

`src/features/news/lib/queries.ts`:
- `useDistrictNewsQuery(leaid, { limit? })` — staleTime 10 min (detail pattern)
- `useTerritoryNewsQuery({ territoryPlanId, limit? })` — staleTime 5 min (list pattern)
- `useContactNewsQuery(contactId)` — staleTime 10 min
- `useRefreshNewsMutation()` — POSTs refresh endpoint, invalidates the district query on success, toasts count via simple inline state (no toast system exists yet — keep minimal)

### Cron schedule in `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/ingest-news-daily",   "schedule": "0 9 * * *" },     // 2am PT = 9am UTC
    { "path": "/api/cron/ingest-news-rolling", "schedule": "*/15 * * * *" }   // every 15 min — REQUIRES VERCEL PRO
  ]
}
```

**Risk flagged by backend discovery:** Vercel free/hobby tier only supports daily cron granularity; 15-min requires Pro. Verify billing tier before ship. If not on Pro, rolling layer falls back to `"0 * * * *"` (hourly) and batch size increases to ~200 districts/run to keep the same 2.7-day full rotation.

## States

| Surface | Loading | Empty | Error |
|---|---|---|---|
| Signals-tab news section | 3 skeleton cards | Branded plum-50 panel with Refresh CTA | Inline banner; keep cached cards below |
| Home news card | 3 skeleton cards | Hide card entirely | Inline banner above card list |
| Contact sidebar mentions | 1 skeleton row | Hide section | Silent fail (log, don't show error to user) |
| Refresh button | Button spinner, disabled | — | Toast "Couldn't refresh" |

## Out of Scope (explicit)

- NewsAPI.org integration (deferred enrichment)
- Article full-body scraping
- Per-user read/unread state, saved/bookmarked articles
- Email or Slack digests
- Admin UI for acronym map / excluded domains (TS config only)
- Dedicated Contacts tab news list (only the collapsed sidebar surface)
- Search within news (filters only, no text search)
- Translation for non-English articles (all feeds English)
- Historical backfill beyond what the RSS feeds return on first poll (each RSS gives ~last 30-50 items)
