# RFP Feed Backend — Backend Context

Discovery for an ingest of RFPs from the HigherGov API into territory-plan. Backend-only. The closest analog is the `news` feature (cron-driven ingest + entity matching). This doc captures the patterns the implementer should mirror, with file paths and line refs.

---

## 1. Cron route pattern

**Pattern:** Each cron route is hand-rolled with the same prelude: `dynamic = "force-dynamic"`, `maxDuration = 300`, read `CRON_SECRET` from env at module top, then guard `GET()` by checking either `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`. There is **no shared helper** — the 5-line check is copy-pasted across routes. Body wraps work in a try/catch that returns `NextResponse.json(..., { status: 500 })` on error and a JSON stats object on success. Logging uses `console.log` with either a `[route-name]` prefix string or a `JSON.stringify({ event, ... })` structured-log object.

**Where:**
- `src/app/api/cron/ingest-news-rolling/route.ts:30-86` — canonical "ingest with run-tracking" pattern
- `src/app/api/cron/ingest-news-daily/route.ts:23-73` — same, simpler (no batch param)
- `src/app/api/cron/match-articles/route.ts:22-80` — drain-loop pattern with `budgetMs` deadline
- `src/app/api/cron/scan-vacancies/route.ts:38-281` — try/catch wraps the whole body, no run-tracking row, structured `vacancy_cron_summary` log at the end
- `vercel.json:1-36` — every cron path is invoked as `?secret=${CRON_SECRET}` (query-param path), so the Bearer-header path is purely for manual invocation/testing

**Snippet** (the auth check, repeated identically in every cron route):
```ts
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && secretParam !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... work ...
}
```

**Implication for RFP feature:** Copy this prelude verbatim into `src/app/api/cron/ingest-rfps/route.ts`. Don't refactor the auth check into a helper as part of this feature — the existing routes don't share one, and adding one now would be cross-cutting scope creep. Use `[ingest-rfps]` as the log prefix and emit a `JSON.stringify({ event: "rfp_cron_summary", ... })` line at the end for parity with `vacancy_cron_summary`.

---

## 2. Checkpoint / sync state pattern

**Pattern:** There is **no generic checkpoint table**. The closest analogs are three different shapes:

1. **Per-entity "last-fetched" row** — `DistrictNewsFetch` has one row per district keyed by `leaid`, holding `lastFetchedAt`, `lastStatus`, `lastError`. Updated after each per-district fetch.
2. **Per-run audit row** — `NewsIngestRun` writes a row at the start of every cron tick (`status: "running"`) and updates it with totals + `finishedAt` at end. There's also an orphan-sweep that flips stuck `running` rows older than 10 min to `error`.
3. **Per-record `*At` timestamp** — `NewsArticle.matchedAt` is null until matched; the `match-articles` cron `findMany({ where: { matchedAt: null }, orderBy: { fetchedAt: "asc" } })`. Effectively a queue using a nullable timestamp column.

For the RFP brief's proposed `RfpSyncCheckpoint(lastSyncedAt)` — closest existing pattern is **option 3**: store `firstSeenAt` / `lastSeenAt` on each RFP row and compute `lastSyncedAt` per run by querying `MAX(fetchedAt)` on the target table, OR store a single-row run-tracking table modeled on `NewsIngestRun`.

**Where:**
- `prisma/schema.prisma:1815-1826` — `DistrictNewsFetch` schema
- `prisma/schema.prisma:1828-1842` — `NewsIngestRun` schema
- `prisma/schema.prisma:1758` — `NewsArticle.matchedAt` field
- `src/features/news/lib/ingest.ts:157-166` — `prisma.districtNewsFetch.update` call after a successful per-district fetch
- `src/app/api/cron/ingest-news-rolling/route.ts:49-66` — `NewsIngestRun.create({ status: "running" })` then update with totals
- `src/features/news/lib/orphan-sweep.ts` (and test at `src/features/news/lib/__tests__/orphan-sweep.test.ts`) — 10-min orphan reaper

**Snippet** (per-run tracking pattern, lifted from `ingest-news-rolling`):
```ts
const run = await prisma.newsIngestRun.create({
  data: { layer: "rolling", status: "running" },
});
try {
  const stats = await ingestRollingLayer(batchSize);
  await prisma.newsIngestRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), articlesNew: stats.articlesNew, /* ... */ status: "ok" },
  });
} catch (err) {
  await prisma.newsIngestRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), status: "error", error: String(err).slice(0, 2000) },
  });
}
```

**Implication for RFP feature:**
- If HigherGov supports a `?modified_since=ts` filter, add an `RfpIngestRun` table modeled on `NewsIngestRun` and read `MAX(finishedAt) WHERE status='ok'` at the start of each run for the `since` watermark. This is simpler than a dedicated checkpoint table and matches what the codebase already does.
- If you do want a single-row checkpoint, name it `RfpSyncCheckpoint` per the brief — but keep `RfpIngestRun` separately for per-run audit. Don't conflate the two roles into one row.
- Mirror the orphan-sweep pattern: a 10-min `running`-status reaper before each run keeps the audit table clean if a cron times out.

---

## 3. District resolution by name + state

**Pattern:** There is **no shared `(name, state) → leaid` resolver**. Three near-misses exist, each tuned to its callsite's tolerance for false positives:

1. **News matcher (multi-tier, state-scoped)** — `matchArticleKeyword` in `src/features/news/lib/matcher-keyword.ts`. Loads `districtsByState` keyed by `stateAbbrev`, then runs four passes: (A) acronym + state, (B) full-name literal substring with distinctiveness gate, (B2) city + district-context phrase with compound-prefix guard, (B3) school-first lookup. Anything ambiguous goes to an LLM disambiguation queue. **State must be USPS abbrev** (`"PA"`, `"NY"`).
2. **Vacancy redistribution (fuzzy + state)** — `findBestDistrict` in `src/features/vacancies/lib/scan-runner.ts:492-536`. Strips noise words (`school`, `district`, `unified`, `central`, etc.) from both employer name and district name, then exact-substring → Dice ≥ 0.6 → school-name fallback. State-scoping uses `leaid.startsWith(fipsPrefix)` (the first 2 chars of leaid are the state FIPS).
3. **Vacancy school matching (intra-district fuzzy)** — `matchSchool` in `src/features/vacancies/lib/school-matcher.ts:75-114`. Scoped to one leaid only, so not directly reusable for cross-state district resolution.

**Name normalization** is duplicated in three places with slightly different stop-word lists:
- `src/features/news/lib/dice.ts:22-44` — `normalizeName` with `["public", "schools", ..., "cooperative"]`
- `src/features/vacancies/lib/scan-runner.ts:447-458` — `normalizeForMatch` with overlapping but different list (adds `township`, `borough`)
- `src/features/vacancies/lib/post-processor.ts:69-83` — `normalizeDistrictName`, similar list

**Unmatched admin view:** there's already an admin scaffold for `UnmatchedOpportunity` (Salesforce sync residue), not for any ingest feature. Files:
- `src/app/admin/unmatched-opportunities/page.tsx` + `columns.ts` + `AdminFilterBar.tsx`
- `src/app/api/admin/unmatched-opportunities/route.ts` (filterable list endpoint with state/stage/rep filters)
- `prisma/schema.prisma:1468-1486` — `UnmatchedOpportunity` model with `resolved`/`resolvedDistrictLeaid` columns

The `UnmatchedAccount` model (`prisma/schema.prisma:376-395`) is closer in spirit — failed matches from a CRM-style import — and stores `(accountName, stateAbbrev, stateFips, lmsid, leaidRaw, matchFailureReason)`.

**Snippet** (the closest reusable resolver — vacancy redistribution):
```ts
// src/features/vacancies/lib/scan-runner.ts:492
function findBestDistrict(
  employerName: string,
  districts: DistrictCandidate[],          // pre-filtered to one state via leaid.startsWith(fipsPrefix)
  schoolToDistrict: Map<string, string>,
): { leaid: string; name: string } | null {
  const normEmployer = normalizeForMatch(employerName);
  if (!normEmployer || normEmployer.length < MIN_NAME_LENGTH_FOR_FUZZY) { /* ... */ }
  // exact substring → fuzzy Dice ≥ 0.6 → school-name exact fallback
}
```

**Implication for RFP feature:**
- **Build a fresh resolver** at `src/features/rfps/lib/district-resolver.ts`. Don't try to reuse the news or vacancy ones — they're tuned for different inputs (news: extract states from headline text; vacancies: scan one shared board for many districts). RFPs are different: HigherGov gives you `(agencyName, stateFips)` directly, no extraction needed.
- **Use `stateFips` as the join key**, since HigherGov returns FIPS, and `District.stateFips` is non-null/indexed. Avoid the FIPS↔USPS round-trip unless something downstream needs USPS.
- **Reuse the noise-word list** from `src/features/news/lib/dice.ts` (it's the most thorough). Do not extract it into a shared module as part of this feature — keep it copied locally; consolidation is its own refactor.
- **Build a fresh "unmatched RFPs" admin view modeled on `UnmatchedOpportunity`**, not on `UnmatchedAccount`. The opportunity view is the more recent/maintained pattern (filter bar, column picker, paginated route). A new model `UnmatchedRfp` with `(agencyName, stateFips, rfpId, resolved, resolvedDistrictLeaid, reason, lastSeenAt)` mirrors the established convention. The admin route at `src/app/api/admin/unmatched-rfps/route.ts` should copy the filter/sort/paginate skeleton from `src/app/api/admin/unmatched-opportunities/route.ts`.

---

## 4. Prisma upsert at volume

**Pattern:** **Per-record `prisma.upsert()` in a loop** is the established pattern, even at volume. No raw-SQL batching, no `createMany` skipDuplicates trickery. The codebase tolerates the round-trip cost because:
- Per-record upserts give you the inserted/updated row back, used for follow-up writes (e.g., `NewsArticleDistrict` source-link, vacancy fingerprint dedup).
- Concurrency is bounded by `PQueue` at the I/O fan-in (RSS fetches), not at the DB layer — the upserts run sequentially per parsed-feed batch.
- Connection-pool size is throttled to `connection_limit=3` in dev (`src/lib/prisma.ts:11-13`) and Supabase pgbouncer in prod; raw `IN`-list queries get chunked at 500 to avoid pool drops.

`updateMany` is used only for **status flips** that don't need the row back (close stale vacancies, sweep orphan runs).

**Where:**
- `src/features/news/lib/store-article.ts:48-100` — `upsertArticle` does `findUnique` (URL hash) → `findFirst` (title window) → `create`, NOT a Prisma `upsert()`. Rationale: dedup logic is two-stage.
- `src/features/news/lib/ingest.ts:43-78` — sequential `for (const raw of articles)` loop calling `upsertArticle`, then `prisma.newsArticleDistrict.upsert` for the source-link.
- `src/features/news/lib/matcher.ts:179-214` — sequential loops, three separate `prisma.newsArticleDistrict.upsert` / `newsArticleSchool.upsert` / `newsArticleContact.upsert` per article.
- `src/features/vacancies/lib/post-processor.ts:219-262` — `prisma.vacancy.upsert({ where: { fingerprint }, create, update })` per vacancy in a sequential `for` loop.
- `src/features/vacancies/lib/post-processor.ts:267-289` — `prisma.vacancy.updateMany({ where: { ..., fingerprint: { notIn } }, data: { status: "closed" } })` for the close-out.
- `src/features/news/lib/matcher.ts:88-110` — chunked `IN`-list (CHUNK = 500) for bulk `findMany`.

**Snippet** (the canonical upsert pattern from post-processor):
```ts
// src/features/vacancies/lib/post-processor.ts:219
await prisma.vacancy.upsert({
  where: { fingerprint },
  create: { leaid, scanId, fingerprint, status: "open", title: raw.title, /* ... */ firstSeenAt: now, lastSeenAt: now },
  update: { status: "open", scanId, lastSeenAt: now, title: raw.title, /* ... */ },
});
```

**Implication for RFP feature:** Per-record `prisma.rfp.upsert({ where: { sourceId }, create, update })` in a sequential loop. Use HigherGov's stable opportunity ID as the upsert key. For close-out (RFPs that disappeared from the latest pull), `updateMany({ where: { sourceId: { notIn: seenIds }, status: "open" }, data: { status: "closed" } })` mirrors vacancy.post-processor exactly. Don't reach for raw SQL or `createMany` — there's no precedent and you'd lose the per-row return value the matcher needs.

---

## 5. State / FIPS handling

**Pattern:** `District` stores **both** `stateFips` (always present, the join key for the `State` table) and `stateAbbrev` (USPS, nullable but populated for almost all rows). State-level rollups join on `stateFips` (it's the `State.fips` PK). USPS is for display and for matching against text where state names appear as abbreviations.

`src/lib/states.ts` exports **only USPS-side utilities** — no FIPS↔USPS lookup. `normalizeState`, `isValidState`, `stateDisplayName`, `US_STATES`. There is **no `fipsToAbbrev` / `abbrevToFips` helper anywhere in the codebase** — callers either query `State` table or extract FIPS from `leaid.substring(0, 2)`.

**Where:**
- `src/lib/states.ts:1-53` — only USPS utilities, no FIPS map
- `prisma/schema.prisma:18-19` — `District.stateFips` (non-null, VarChar(2), `state_fips`) + `District.stateAbbrev` (nullable, VarChar(2), `state_abbrev`)
- `prisma/schema.prisma:258` — `district.state` relation joins on `stateFips → State.fips`
- `prisma/schema.prisma:274-278` — both indexed: `@@index([stateFips])`, `@@index([stateAbbrev])`, plus composite `(stateAbbrev, isCustomer)`
- `prisma/schema.prisma:414-417` — `State { fips @id, abbrev @unique, name }`
- `src/features/vacancies/lib/scan-runner.ts:620` — uses `scan.leaid.substring(0, 2)` as a FIPS prefix to scope district lookups

**Snippet:**
```prisma
// prisma/schema.prisma
model District {
  leaid       String  @id @db.VarChar(7)
  stateFips   String  @map("state_fips") @db.VarChar(2)   // non-null
  stateAbbrev String? @map("state_abbrev") @db.VarChar(2) // nullable but populated
  state       State?  @relation(fields: [stateFips], references: [fips])
}
model State {
  fips   String @id @db.VarChar(2)  // "06"
  abbrev String @unique @db.VarChar(2)  // "CA"
  name   String @db.VarChar(100)
}
```

**Implication for RFP feature:**
- HigherGov returns FIPS → store and join on `District.stateFips` directly. No conversion needed.
- **Add a `fipsToAbbrev` / `abbrevToFips` helper to `src/lib/states.ts`** if RFP needs to display USPS but the upstream data is FIPS-only. Add `STATE_FIPS_TO_ABBREV: Record<string, string>` and an `abbrevToFips(usps)` function alongside the existing exports. This is a small additive change, justified because the rest of the codebase already tolerates a `State` table query for the same lookup — a static map is faster.
- Where you do display states for users, prefer `stateAbbrev` (matches every other feature's UI conventions).

---

## 6. Test patterns for ingest code

**Pattern:** Vitest + Testing Library + jsdom. Tests are co-located in `__tests__/` next to source. **Prisma is mocked at the module level** with `vi.mock("@/lib/prisma", () => ({ ... }))`. Two mock styles coexist:

1. **Closure-deferred mocks** (preferred for newer tests, dodges Vitest's TDZ on hoisted mocks): declare `const x = vi.fn()` at top, reference inside `vi.mock` factory via a `(...args) => x(...args)` arrow.
2. **Inline factory** (older style, simpler): `vi.mock("@/lib/prisma", () => ({ prisma: { newsArticle: { findUnique: vi.fn(), ... } } }))`, then cast and reach in via `vi.mocked(prisma) as any`.

Some files import `prisma` as default export (`import prisma from "@/lib/prisma"`), others as named (`import { prisma } from "@/lib/prisma"`) — both work because `src/lib/prisma.ts` exports both. **Match the import style of the file under test in your mock factory.**

External APIs are mocked via `vi.mock` of the wrapper module (e.g., `vi.mock("@/features/vacancies/lib/parsers")`), not via `fetch` interception. There are no MSW or fetch-mock libraries in the dep tree. Test fixtures live as inline string constants at the top of the test file (see `RSS_20`, `ATOM`, `GOOGLE_NEWS` in `rss.test.ts:4-43`).

**Where:**
- `vitest.config.ts:1-26` — config: jsdom, `setupFiles: ["./src/test/setup.ts"]`, `globals: true`, alias `@ → ./src`
- `src/features/news/lib/__tests__/store-article.test.ts:5-16` — inline factory style
- `src/features/vacancies/lib/__tests__/scan-runner.test.ts:1-46` — closure-deferred style with explicit type annotations
- `src/features/news/lib/__tests__/orphan-sweep.test.ts:4-16` — minimal closure-deferred (single mocked method)
- `src/features/news/lib/__tests__/rss.test.ts:1-44` — inline XML fixtures

**Snippet** (closure-deferred mock, the modern style):
```ts
const upsert = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    rfp: {
      upsert: (...args: unknown[]) => upsert(...args),
    },
  },
}));
beforeEach(() => { upsert.mockReset().mockResolvedValue({}); });
```

**Implication for RFP feature:**
- Co-locate tests in `src/features/rfps/lib/__tests__/`. One test file per source module.
- Mock Prisma per-file with whichever style matches the module's import.
- Test fixtures: keep HigherGov sample-response JSON inline as a string constant unless it grows past ~200 lines, then move to `__fixtures__/` next to the test file.
- Mock the HigherGov client wrapper, not `fetch` — write a thin client module (`src/features/rfps/lib/highergov-client.ts`) so tests can mock that single boundary.

---

## 7. Env validation

**Pattern:** **There is no env validator.** All env vars are read inline at point of use via `process.env.X`, with `!` non-null assertions for required ones (Supabase) and optional/default fallbacks for others. There's no `src/lib/env.ts`, no `zod` schema, no `t3-env`-style validation.

**Where:**
- `src/lib/anthropic.ts:64` — `const apiKey = process.env.ANTHROPIC_API_KEY;` with a runtime null check inside the function
- `src/lib/db-readonly.ts:26-32` — runtime guard: `if (!process.env.DATABASE_READONLY_URL) throw new Error(...)`
- `src/lib/supabase/server.ts:11-12` — `process.env.NEXT_PUBLIC_SUPABASE_URL!` (non-null assertion)
- `src/lib/prisma.ts:10-13` — uses `process.env.NODE_ENV` and `process.env.DATABASE_URL` directly
- Cron routes — `const CRON_SECRET = process.env.CRON_SECRET;` at module scope, runtime check `if (CRON_SECRET && ...)` (skips auth entirely if unset, which is intentional for local dev)

**Implication for RFP feature:** Read `process.env.HIGHERGOV_API_KEY` and `process.env.HIGHERGOV_K12_SEARCH_ID` inline in the HigherGov client module, with a runtime null-check that throws a descriptive error if either is missing. **Don't introduce a new env-validator pattern as part of this feature** — the codebase has chosen ad-hoc inline reads, and bringing in zod-env now is out of scope. Document the new env vars in `.env.example` (verify it exists at the repo root and add them there if so).

---

## 8. Vercel cron config

**Pattern:** Crons are declared in `vercel.json` as `{ path, schedule }` pairs. The path always includes `?secret=${CRON_SECRET}` (Vercel substitutes the env var at invocation). Schedules use standard 5-field cron syntax. Cadence varies wildly by workload:
- Hourly (`0 * * * *`) — vacancy scan
- Every 15 min (`*/15 * * * *`) — rolling news ingest (Vercel Pro required for sub-hour granularity)
- Mid-hour offsets (`5,20,35,50 * * * *`) — match-articles, deliberately offset so it runs after rolling ingest
- Daily (`0 9 * * *`) — daily news ingest
- Twice-daily windows (`45 */2 * * *`) — drain-match-queue

**Where:**
- `vercel.json:1-36` — full cron list (8 routes)
- Note: `maxDuration = 300` in each route file. Vercel Pro caps function duration at 300s for cron-triggered invocations.

**Snippet:**
```json
{
  "path": "/api/cron/ingest-news-rolling?secret=${CRON_SECRET}",
  "schedule": "*/15 * * * *"
}
```

**Implication for RFP feature:** Add an entry to `vercel.json`. HigherGov isn't real-time-volatile (RFPs don't post every 15 min) — propose either `0 */6 * * *` (every 6 hours) or `0 8 * * *` (daily at 8am UTC) per the brief's expected refresh rate. Pick a non-zero minute offset (e.g., `15 8 * * *`) to avoid colliding with the daily news ingest at `0 9 * * *`. Set `maxDuration = 300` in the route file.

---

## Gaps

Things the RFP brief calls for that have **no existing analog** in this codebase:

1. **No generic checkpoint/sync-state table.** The brief proposes `RfpSyncCheckpoint(lastSyncedAt)` as a single-row table. No precedent. Closest patterns are per-entity rows (`DistrictNewsFetch`) or per-run audit rows (`NewsIngestRun`). Decision needed: single-row checkpoint, or just compute `MAX(finishedAt)` from an `RfpIngestRun` audit table. The latter is more consistent with `NewsIngestRun`.

2. **No FIPS↔USPS conversion utility.** `src/lib/states.ts` is USPS-only. If the RFP feature needs to convert between FIPS (HigherGov input) and USPS (most app-facing UI) at any point beyond the `District` join, a small additive change to `states.ts` is required.

3. **No shared `(districtName, state) → leaid` resolver.** Three near-misses (news matcher, vacancy redistribution, school matcher) all tuned for different callsites. The implementer must build a fresh `src/features/rfps/lib/district-resolver.ts`. Reusing the noise-word stop list from `src/features/news/lib/dice.ts` is fair game; trying to extend the news matcher itself is not.

4. **No env validator.** If the RFP feature wants startup-time validation of `HIGHERGOV_API_KEY` / `HIGHERGOV_K12_SEARCH_ID`, that's a green-field addition. Stick with inline `process.env.X` reads + runtime null-check to match the rest of the codebase.

5. **No "unmatched RFPs" admin view.** Closest is `UnmatchedOpportunity`, which is for Salesforce sync residue, not for ingest. Build a fresh model + route + page modeled on that one.

6. **No HigherGov client / external-API wrapper convention.** The codebase has wrappers for Anthropic (`src/lib/anthropic.ts`), Supabase (`src/lib/supabase/`), Google News RSS (`src/features/news/lib/rss.ts`), and SchoolSpring API (`src/features/vacancies/lib/parsers/schoolspring.ts`) — each is hand-rolled with its own retry/timeout policy. There is no shared HTTP-client base class. Implementer should write a focused `src/features/rfps/lib/highergov-client.ts` modeled on `schoolspring.ts` (plain `fetch` + `AbortSignal.timeout` + structured error returns).

7. **No batching/createMany convention for high-volume upserts.** Per-record sequential upsert is the only pattern. If HigherGov pulls return >1000 RFPs and per-record upserts are too slow, that's a perf decision the brief should call out — but assume per-record is fine until proven otherwise (matches the news matcher, which handles ~14k articles/day this way).
