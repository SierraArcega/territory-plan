# Backend Context: News Events Integration

Discovery pass for a News Events feature that ingests RSS (Chalkbeat, K-12 Dive, The 74, EdSurge, Google News queries), runs on nightly + 15-min crons plus on-demand refresh, matches articles to Districts/Schools/Contacts with a tiered matcher (keyword auto + Claude Haiku), and surfaces in the District Signals tab, Home dashboard, and contact sidebars.

Everything below is pulled from the codebase — no speculation. Where something is missing, that's called out.

---

## 1. Cron / Scheduled Job Infrastructure

**Vercel Cron.** Crons are declared in `vercel.json` and hit Next.js App Router handlers under `src/app/api/cron/*`.

### Registered crons (`/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/scan-vacancies?secret=${CRON_SECRET}", "schedule": "0 * * * *" },
    { "path": "/api/cron/vacancy-hygiene?secret=${CRON_SECRET}", "schedule": "0 6 * * *" },
    { "path": "/api/cron/leaderboard-slack-post?secret=${CRON_SECRET}", "schedule": "0 13 * * 1-5" }
  ]
}
```

Note: Vercel's standard cron granularity is hourly on non-Enterprise plans. A **15-minute cron** (for rolling per-district news) may require a different scheduler or a "runs every hour, processes 4 batches" shape. Confirm with infra before spec.

### Existing handler (cite this pattern)

`/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/src/app/api/cron/scan-vacancies/route.ts`

Key patterns to reuse verbatim:
- `export const dynamic = "force-dynamic";` (line 7)
- `export const maxDuration = 300;` — Vercel Pro 5-min limit (line 8)
- Auth gate: accepts `Bearer ${CRON_SECRET}` header **or** `?secret=<CRON_SECRET>` query param (lines 36–44)
- Concurrency via `PQueue` from `p-queue` (already a dep, `package.json` line 36) — `const queue = new PQueue({ concurrency: CONCURRENCY });` (line 110)
- Batches work with a `SCANS_PER_RUN` cap and a `batchId = crypto.randomUUID()` (line 106) so progress can be polled
- Returns structured JSON: `{ batchId, totalStale, scansRun, remaining, results }`

The vacancy-hygiene cron (`src/app/api/cron/vacancy-hygiene/route.ts`) adds a `?mode=` query-param multiplexer — useful if News wants one cron endpoint with `mode=nightly|rolling|refresh`.

### Middleware exemption

`/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/src/middleware.ts` line 84 explicitly excludes `api/cron` (and `api/webhooks`, `api/tiles`, `api/leaderboard-image`) from Supabase session middleware. Cron handlers are reached **without** an authenticated user — auth is handled by `CRON_SECRET` alone.

### Non-Vercel scheduler (separate stack)

There's also a Python scheduler at `/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/scheduler/` (Dockerfile, `run_scheduler.py`, Railway config). This is for opportunity/Salesforce sync — **not** the pattern to use for News. The Next.js cron endpoints are the right target.

---

## 2. ETL / Data-Refresh Patterns

**The existing ETL is Python**, not TypeScript. It lives at `/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/scripts/etl/` with a `run_etl.py` orchestrator and per-source loaders in `scripts/etl/loaders/` (urban_institute.py, census_county_income.py, fullmind.py, etc.). It's invoked manually (`python run_etl.py --all`), uses `psycopg2` directly against `DIRECT_URL`, and is NOT wired into any cron.

**Implication:** News ingestion is better modeled on the **vacancy-scanner pattern** (TS, runs inside Next.js, triggered by Vercel cron or user). The Python ETL is irrelevant for an RSS feed that needs a 15-min cron and an on-demand UI button.

### TS ingestion pattern to follow: vacancy scan pipeline

`/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/src/features/vacancies/lib/scan-runner.ts` is the closest analog:

- `runScan(scanId)` orchestrates one unit of work (lines 22+)
- Wraps with a timeout: `SCAN_TIMEOUT_MS = 180_000` + `AbortController` (lines 10, 23, 118)
- Status state machine: `pending → running → completed | completed_partial | failed` (stored on `VacancyScan` row)
- Writes progress back to a scan row (`prisma.vacancyScan.update`) so the UI can poll
- On fan-out (statewide boards), does one chunk synchronously, then kicks off `redistributeInBackground(...)` which is fire-and-forget (line 191). **Note:** this assumes the Vercel function lifetime persists; the vacancy-scan cron uses `maxDuration = 300`

### Upsert + dedup pattern

`src/features/vacancies/lib/post-processor.ts` and `src/features/vacancies/lib/fingerprint.ts` — fingerprint is `sha256(leaid|title|schoolName normalized)`. For News articles, the equivalent is likely `sha256(url)` or `sha256(sourceFeed|guid)`. Prisma `upsert` on a `@@unique([fingerprint])` column — see `Vacancy.fingerprint` at `prisma/schema.prisma:1348`.

### Retries, logging

- **No formal retry library.** The vacancy scanner does not retry failed fetches; it records `errorMessage` on the scan row and moves on.
- Logging: `console.log("[scan-runner] ...")` / `console.error("[cron] scan-vacancies failed:", error)` — prefixed tags, visible in Vercel runtime logs.
- Progress tracking: a dedicated table (e.g. `VacancyScan`) with `batchId`, `status`, `vacancyCount`, `fullmindRelevantCount`, `errorMessage`, `startedAt`, `completedAt`. News should mirror this with a `NewsIngestRun` table or similar.

---

## 3. Prisma + Raw SQL Patterns

- Prisma client: `/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/src/lib/prisma.ts` — singleton on `globalThis`, dev uses `connection_limit=3`.
- Raw pg Pool: `/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/src/lib/db.ts` — `max: 2` in prod (Supabase Shared Pooler constraint), `max: 3` in dev.

### When is each used?

- **Prisma (default):** 95%+ of API routes. Grep hits on `prisma.$queryRaw` in `src/app/api` = **24** occurrences; `pool.query` imports from `@/lib/db` = ~10 files (mostly `/tiles`, `/map/plans`, `/districts/histogram`, `/metrics/quantiles`).
- **Raw pg Pool:** reserved for PostGIS (`ST_AsMVT` tiles), heavy GROUP BY aggregations, `district_map_features` materialized views. Not relevant to News unless we do geo queries.
- **Prisma `$queryRaw`:** used for complex HAVING/window queries that Prisma's query builder doesn't cover. Good example: `src/app/api/cron/vacancy-hygiene/route.ts:67-81` — tagged template with `${VAR}` interpolation (safe parameterization).

### Fuzzy / text-search helpers already in the codebase

- **No `pg_trgm` extension.** `prisma/schema.prisma:3,10` declares only the `postgis` extension as a preview feature. There are no `pg_trgm` migrations under `prisma/migrations/` or `supabase/migrations/`.
- **Dice-coefficient bigram matching** lives in `src/features/vacancies/lib/school-matcher.ts` (lines 38-65) and duplicated inline in `src/features/vacancies/lib/post-processor.ts:39-57`. Threshold 0.8 for schools, 0.4 for districts (looser, with noise-word stripping). **This is exactly the pattern News's tiered matcher should copy.**
- `ILIKE '%foo%'` is used for stage filtering (`src/app/api/admin/unmatched-opportunities/summary/route.ts:27-29`) and district search (`src/app/api/districts/route.ts:58-63` — Prisma `contains` + `mode: "insensitive"`).
- **No Postgres FTS (`tsvector`)** anywhere in the codebase. Keyword matching for News should either use the same Dice-bigram approach in TS, or add `pg_trgm` in a new migration if we want DB-side similarity.

---

## 4. Anthropic / Claude API Integration

**No `@anthropic-ai/sdk` dependency** — not in `package.json`. All Claude calls go through **raw `fetch` to `https://api.anthropic.com/v1/messages`**.

### Single existing integration

`/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/src/features/vacancies/lib/parsers/claude-fallback.ts`

Key reusable patterns:
- Constants at top (lines 4-6):
  ```ts
  const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
  const CLAUDE_MODEL = "claude-sonnet-4-6";
  const ANTHROPIC_VERSION = "2023-06-01";
  ```
- API key read from `process.env.ANTHROPIC_API_KEY` (line 24), throws if missing.
- **Tool-use pattern** for structured extraction — defines `VACANCY_TOOL` with JSONSchema `input_schema` (lines 123-171), forces `tool_choice: { type: "tool", name: "extract_vacancies" }` (line 221). Response parsing finds the `tool_use` block and casts `.input` to the expected shape (lines 244-258). **This is exactly the shape the News tiered matcher wants** for "given this article + district candidate list, which match?".
- `max_tokens: 4096`, 30s timeout via `AbortSignal.timeout(30_000)` (line 232).
- Headers: `x-api-key`, `anthropic-version`, `Content-Type` (lines 225-230).

### No shared client wrapper

There is no `src/lib/anthropic.ts` or similar. The `callClaude` function is private to `claude-fallback.ts`. For News (which will make many Haiku calls on ambiguous article→district matches), we should **extract a shared client** at `src/lib/anthropic.ts` or `src/features/news/lib/claude-matcher.ts` that:
- Takes model name as a param (Haiku for cheap matching, Sonnet for fallback)
- Supports tool-use + `tool_choice`
- Returns parsed tool input typed by generic

### No Haiku/Sonnet selection pattern yet

The only existing Claude call hardcodes `claude-sonnet-4-6`. News will be the first consumer to need model tier selection (Haiku for per-article cheap match, Sonnet/Opus for higher-stakes disambiguation). **Model IDs follow the `claude-<tier>-<version>` pattern** (`claude-sonnet-4-6`, so presumably `claude-haiku-4-6` — verify current IDs against Anthropic docs before coding).

Other references: `scan-runner.ts:98-113` shows the runtime decision tree (uses Claude only when `process.env.ANTHROPIC_API_KEY` is set and Playwright is unavailable).

---

## 5. RSS / HTTP Fetching

**No RSS / XML parser dependency.** Confirmed by grep across `src` — no hits for `rss-parser`, `feedparser`, `fast-xml-parser`, `xml2js`, `parseXML`. Nothing in `package.json` (see §"dependencies" in `/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/package.json`).

### Recommendation

Add `fast-xml-parser` (zero deps, smallest footprint, handles RSS 2.0 + Atom). It's commonly used for this use case and won't balloon bundle size. Alternative `rss-parser` pulls in `xml2js` transitively.

### HTTP client

- **Native `fetch`** is used everywhere. Examples: `src/features/vacancies/lib/parsers/claude-fallback.ts:56, 224`, all feature `queries.ts` via `fetchJson` helper.
- **`AbortSignal.timeout(ms)`** is the idiomatic way to set timeouts — see `claude-fallback.ts:58, 232`.
- No `axios` or other HTTP lib. No retry wrapper (no `p-retry`, `async-retry`, etc.) — retries would need to be hand-rolled or added as a dep.
- **User-Agent:** set explicitly when scraping external sites — `claude-fallback.ts:3` uses `TerritoryPlanBuilder/1.0 (vacancy-scanner)`. News should follow suit with `FullmindTerritoryPlan/1.0 (news-ingest; contact@fullmindlearning.com)` or similar, especially for Google News / publisher RSS (some publishers block default UAs).

### Playwright (for JS-rendered pages)

Already a dep (`playwright: ^1.58.2`). `claude-fallback.ts:70-86` shows the lazy-import + serverless gate pattern: `const { chromium } = await import("playwright"); ... if (!process.env.VERCEL) { ... }`. Probably not needed for RSS (pure XML), but useful if we later scrape article bodies.

---

## 6. API Route Conventions

Sampled 3 routes: `src/app/api/districts/route.ts`, `src/app/api/districts/[leaid]/vacancies/route.ts`, `src/app/api/vacancies/scan/route.ts`.

### Consistent boilerplate

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// export const maxDuration = 120; // when the route does heavy work
```

### Auth gate (every non-cron, non-webhook route)

```ts
const user = await getUser();
if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

`getUser()` is defined in `/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/src/lib/supabase/server.ts:55`. Uses `@supabase/ssr`'s `createServerClient` with Next.js cookies. Returns `null` when unauthenticated; returns `{ ...user, isImpersonating }` when an admin is impersonating (lines 55-87). For admin-only endpoints use `getAdminUser()` (line 105) or check `isAdmin(userId)` (line 92). Cron routes DO NOT call `getUser()` — they check `CRON_SECRET`.

### Route params (Next 16)

```ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> }
) {
  const { leaid } = await params;
}
```
Params are a **Promise** — must be awaited. Example: `src/app/api/districts/[leaid]/vacancies/route.ts:17-25`.

### Response shape

- Always `NextResponse.json(...)` with an explicit `status` when it's not 200.
- List endpoints: `{ items: [...], total: N }` (see `districts/route.ts:130`).
- Detail endpoints: flat object or `{ summary: {...}, items: [...] }` (see `[leaid]/vacancies/route.ts:123-131`).
- Errors: `{ error: "Failed to fetch X" }` with status 4xx/5xx.

### Error handling

Wrap the body in `try/catch`, log with `console.error("Error fetching X:", error)`, return generic 500 message (don't leak internals). Example: `districts/route.ts:134-139`.

### Pagination

`limit`/`offset` via query params, parsed with `parseInt(searchParams.get("limit") || "100")`. `prisma.findMany({ take, skip })`. Example: `districts/route.ts:48-49, 108-109`.

### The shared fetch helper

`/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/src/features/shared/lib/api-client.ts` — `fetchJson<T>(url, options)` with `API_BASE = "/api"`. Handles non-JSON redirects (detects session expiry when Supabase middleware returns HTML).

---

## 7. TanStack Query Hook Conventions

Canonical example: `/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/src/features/vacancies/lib/queries.ts`.

### Naming + shape

```ts
export function useVacancies(leaid: string | null) {
  return useQuery({
    queryKey: ["vacancies", leaid],
    queryFn: () =>
      fetchJson<VacanciesResponse>(`${API_BASE}/districts/${encodeURIComponent(leaid!)}/vacancies`),
    enabled: !!leaid,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### staleTime defaults observed

- Lists that don't change fast: **5 minutes** (`useVacancies`, `useDistricts`)
- Detail views: **10 minutes** (`useDistrictDetail` at `districts/lib/queries.ts:58`)
- Polling (batch progress): `staleTime: 0` + `refetchInterval: 2000` with a conditional return-`false` when done (`vacancies/lib/queries.ts:136-152`). **Reuse this pattern** for polling the news refresh/ingest status.

### Query keys

Arrays, feature-name first: `["vacancies", leaid]`, `["planVacancies", planId]`, `["district", leaid]`. Keep compatible across hooks so invalidations hit the right scope.

### Mutations + invalidation

```ts
export function useScanDistrict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leaid: string) =>
      fetchJson<ScanDistrictResponse>(`${API_BASE}/vacancies/scan`, {
        method: "POST",
        body: JSON.stringify({ leaid }),
      }),
    onSuccess: (_data, leaid) => {
      queryClient.invalidateQueries({ queryKey: ["vacancies", leaid] });
    },
  });
}
```
See `vacancies/lib/queries.ts:94-109`.

---

## 8. Shared UI Components (Reusable for News Cards)

Located at `/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/src/features/shared/components/` and `src/features/shared/lib/`.

### What exists

- `src/features/shared/lib/format.ts` — `formatCurrency`, `formatNumber`, `formatPercent`, `formatCompactNumber`. No date formatter.
- `src/features/shared/lib/pretty-duration.ts` — **`timeAgo(date)`** returning "just now" / "5m ago" / "3h ago" / "yesterday" / "5 days ago" / "Mar 11". Exactly what news cards need. Also `timeUntil(date)` for future dates. Uses `parseLocalDate` from `date-utils` for YYYY-MM-DD to avoid TZ shift.
- `src/features/shared/lib/error-boundary.tsx` — shared `<ErrorBoundary>` wrapper (class component).
- `src/features/shared/lib/cn.ts` — `clsx` + `tailwind-merge` classname helper.
- `src/features/shared/components/DataGrid/` — full data-grid primitive with skeleton/loading states baked in.
- `src/features/shared/components/AsyncMultiSelect.tsx`, `MultiSelect.tsx` — for filter UIs.

### What does NOT exist (you'll need to build or reuse)

- **No standalone `Skeleton` component** (grep for `Skeleton` in shared components returns 1 file: `DataGrid` tests). DataGrid has its own inline skeleton animation (keyframe in `DataGrid.tsx:207-208`).
- **No standalone `EmptyState` component.** Most empty states are inline — see `AlertRow.tsx` pattern for how alert/info rows are styled.
- **No toast/notification system.** Grep hits nothing for `toast`, `notification`, `sonner`. Mutations today just display inline error text from the `useMutation` error.
- **No Card primitive** — each feature builds its own (see `SignalCard.tsx` below, `PlanCard.tsx` in home, `AlertRow.tsx`). News should follow suit or introduce a generic `Card` in `features/shared/components/` (brand-compliant per `Documentation/UI Framework/tokens.md`).

### Styling notes from existing cards

- `src/features/home/components/AlertRow.tsx:47` uses the exact Fullmind plum palette: bg `#F7F5FA`, hover `#EFEDF5`, text `#403770`. Matches CLAUDE.md token guidance.
- `src/features/map/components/panels/district/signals/SignalCard.tsx` — `border-gray-100 rounded-xl bg-white`, header + body + expandable detail. **This is the Signals tab card style that news cards must match** (see §10).

---

## 9. Testing Setup

### Config

- `/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/vitest.config.ts` — jsdom environment, `setupFiles: ["./src/test/setup.ts"]`, globals, `@` alias to `./src`, excludes `e2e/`.
- Setup file `/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/src/test/setup.ts` — imports `@testing-library/jest-dom`, **globally mocks `fetch` as `vi.fn()`**, and `vi.clearAllMocks()` in `beforeEach`.

### Co-location

Tests live in `__tests__/` directories next to source. Examples:
- `src/features/vacancies/lib/__tests__/school-matcher.test.ts`
- `src/app/api/tasks/__tests__/route.test.ts`
- `src/app/api/vacancies/[id]/__tests__/route.test.ts`

### Prisma mocking pattern

Example: `/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/src/app/api/tasks/__tests__/route.test.ts:12-28`.

```ts
vi.mock("@/lib/prisma", () => ({
  default: {
    task: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));
import prisma from "@/lib/prisma";
const mockPrisma = vi.mocked(prisma) as any;
```

Each test stubs specific methods: `mockPrisma.task.findMany.mockResolvedValue([...])`.

### Supabase auth mocking

```ts
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));
// in a test:
mockGetUser.mockResolvedValue({ id: "user-1", email: "test@example.com" });
```

### Request construction

```ts
function makeRequest(url: string, options?: { method?: string; body?: unknown }) {
  const init: RequestInit = { method: options?.method ?? "GET" };
  if (options?.body) {
    init.method = options.method ?? "POST";
    init.body = JSON.stringify(options.body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}
```

### Fetch mocking

`global.fetch` is already mocked to `vi.fn()` in `src/test/setup.ts`, so external HTTP calls (Claude, RSS feeds) are easy to stub per-test with `vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({...})))`.

---

## 10. Existing SignalsTab — Style the News Section Must Match

File: `/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/src/features/map/components/panels/district/tabs/SignalsTab.tsx`

```tsx
export default function SignalsTab({ data }: SignalsTabProps) {
  return (
    <div className="p-3 space-y-3">
      <EnrollmentCard district={data.district} demographics={data.enrollmentDemographics} trends={data.trends} />
      <StaffingCard educationData={data.educationData} trends={data.trends} />
      <StudentPopulationsCard district={data.district} educationData={data.educationData} trends={data.trends} />
      <AcademicCard educationData={data.educationData} trends={data.trends} />
      <FinanceCard educationData={data.educationData} trends={data.trends} />
    </div>
  );
}
```

Literally a vertically-stacked list of Card components inside a `p-3 space-y-3` wrapper. **To add News, append a `<NewsCard ... />` as a peer of the other cards.**

### The card primitive to imitate

`/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/src/features/map/components/panels/district/signals/SignalCard.tsx` is the shared card shell all signal tiles pass their content through.

Structure (lines 24-68):
```
<div className="border border-gray-100 rounded-xl bg-white">
  <div className="flex items-center justify-between px-3 pt-3 pb-1">
    <div className="flex items-center gap-2">
      <span className="text-gray-400">{icon}</span>
      <h3 className="text-sm font-semibold text-[#403770]">{title}</h3>
    </div>
    {badge}
  </div>
  <div className="px-3 pb-3">{children}</div>
  {detail && (<expand/collapse "View details" button + detail block when open/>)}
</div>
```

Key tokens in use:
- Shell: `border-gray-100 rounded-xl bg-white`
- Header text: `text-sm font-semibold text-[#403770]` (Fullmind plum)
- Icon: `text-gray-400` — Lucide, `currentColor`, `w-4 h-4`
- Primary metric: `text-2xl font-bold text-[#403770]` (see `EnrollmentCard.tsx:48`)
- Supporting text: `text-xs text-gray-500`
- Expand row: `border-t border-gray-50`, chevron rotates 90° when expanded

### Recommendation for NewsCard

Build `src/features/map/components/panels/district/NewsCard.tsx` that:
1. Passes `icon` (Lucide `Newspaper` or `Rss`), `title="In the news"`, and a `badge` (e.g. article count, or "3 this week")
2. In `children`, renders the 1–3 most recent articles as small rows: `title (link out)` + `source · timeAgo(publishedAt)` using the existing `timeAgo` helper
3. In `detail`, renders the full list + a `<button>Refresh</button>` that fires the on-demand ingest
4. Is added to the peers list in `SignalsTab.tsx` (bottom or between Enrollment and Staffing — design call)

### Home dashboard placement

`src/features/home/components/` has `AlertRow.tsx`, `FeedRows.tsx`, `FeedSummaryCards.tsx`, `FeedSection.tsx`. The home feed already has an "alerts" pattern (`AlertRow`) — News is a good candidate for a similar row shape OR its own `FeedSection` variant. Review with design before committing.

---

## Relevant Prisma Models

From `/Users/sierraarcega/territory-plan/.claude/worktrees/news-events-integration/prisma/schema.prisma`:

- **District** (line 15) — keyed by `leaid @id @db.VarChar(7)`. All matcher outputs anchor to `leaid`.
- **School** (line 1011) — keyed by `ncessch @db.VarChar(12)`, FK `leaid` to district.
- **Contact** (line 337) — `id Int @id`, `leaid`, `name`, `email`, `title`, `persona`, `seniorityLevel`, has `vacancies Vacancy[]` relation — the same `contact.vacancies` pattern we want for `contact.newsMentions`.
- **Vacancy** (line 1344) + **VacancyScan** (line 1320) — closest templates for NewsArticle + NewsIngestRun. Note `@@unique([fingerprint])` for dedup (line 1375) and `triggeredBy String @db.VarChar(100)` to record cron vs user.

---

## What Needs to Be Created (forward reference for spec)

### New tables (sketch)
- `NewsArticle` — id, sourceFeed, url (unique), title, summary, publishedAt, fetchedAt, rawBody?, fingerprint.
- `NewsArticleMatch` — articleId, entityType ("district" | "school" | "contact"), entityId, confidence, matchMethod ("keyword" | "claude-haiku" | "manual"), createdAt.
- `NewsIngestRun` — mirror of `VacancyScan`: id, mode (nightly | rolling | refresh), status, articlesFetched, articlesMatched, startedAt, completedAt, errorMessage, triggeredBy.

### New API routes (sketch)
- `GET /api/cron/news-ingest` — nightly full pull (all 5 RSS sources). Auth via `CRON_SECRET`. Pattern: `src/app/api/cron/scan-vacancies/route.ts`.
- `GET /api/cron/news-rolling` — 15-min per-district Google News queries. Same auth. (Confirm Vercel 15-min cron support; may need to be hourly with 4 internal batches.)
- `POST /api/news/refresh` — user-triggered refresh. Auth via `getUser()`. Returns `{ runId, status }`. Pattern: `src/app/api/vacancies/scan/route.ts`.
- `GET /api/districts/[leaid]/news` — list articles for a district. Pattern: `src/app/api/districts/[leaid]/vacancies/route.ts`.
- `GET /api/news/batch/[runId]` — poll ingest progress. Pattern: `src/app/api/vacancies/batch/[batchId]/route.ts`.

### New lib modules (sketch)
- `src/features/news/lib/rss-fetcher.ts` — fetch + parse (fast-xml-parser), with User-Agent, timeout, retries.
- `src/features/news/lib/matcher.ts` — tiered: (1) keyword auto-match using district `name` normalization + Dice ≥ 0.4 (reuse `post-processor.ts:39-57` bigram logic); (2) Claude Haiku disambiguation for ambiguous cases using the tool-use pattern from `claude-fallback.ts`.
- `src/lib/anthropic.ts` — new shared Claude client wrapper (model-agnostic, generic tool-use). Refactor `claude-fallback.ts` to use it.
- `src/features/news/lib/ingest-runner.ts` — orchestrator analogous to `scan-runner.ts`; writes `NewsIngestRun` status updates.
- `src/features/news/lib/queries.ts` — TanStack hooks: `useDistrictNews`, `useRefreshNews` (mutation), `useNewsIngestStatus` (polling).
- `src/features/map/components/panels/district/NewsCard.tsx` — Signals-tab card matching `SignalCard` shell.

### Env vars
- `CRON_SECRET` (already used by existing crons).
- `ANTHROPIC_API_KEY` (already in use by `claude-fallback.ts`).
- Potentially `GOOGLE_NEWS_USER_AGENT` or similar if publishers block default UA.

---

## Gaps / Things I Couldn't Confirm

1. **Vercel cron granularity for 15-min runs** — `vercel.json` only has hourly/daily examples. Check the Vercel plan tier before committing to `*/15 * * * *`; fallback is hourly + 4 internal passes.
2. **Existing `reports` feature** — branch name suggests a query-tool agent loop, but no `src/features/reports/` directory exists yet (only `src/features/reports/lib/agent/` file mentioned in git status at `tool-definitions.ts`). If News should integrate with a shared agent-loop, that infra may still be in-flight.
3. **pg_trgm** — not installed. If we want DB-side fuzzy search for news queries, we'd add it in a new migration. Otherwise in-app Dice-bigram matching is the established pattern.
4. **Toast/notification system** — none exists. On-demand "Refresh news" button will need to show progress via inline UI, not a toast, unless we introduce one.
5. **RSS parser choice** — no existing dep; recommending `fast-xml-parser` but the spec should lock the choice.
