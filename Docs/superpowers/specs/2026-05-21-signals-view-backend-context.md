# Backend Context: Signals View (merged Vacancies + News + RFPs, district-grouped tree)

> Discovery only — no code changed. All paths are absolute under the
> `saved-views-sidebar` worktree.

## TL;DR for implementers

- The **Saved Views grids do NOT call `/api/vacancies`, `/api/news`, `/api/rfps`
  directly.** They go through the unified read endpoint
  `GET /api/views/data?source=…` (raw SQL compiler over the readonly pool).
  Vacancies + RFPs already flow through it; News *table mode* does too, but
  News defaults to **cards mode** which hits the legacy `GET /api/news?territoryPlanId=`.
- Detail panels DO call the per-entity routes: `GET /api/vacancies/[id]`,
  `GET /api/news/[id]`, `GET /api/rfps/[id]` via the shared `useEntity(kind,id)` hook.
- The cleanest path for a unified, district-grouped, freshness-sorted tree is a
  **new `GET /api/signals` endpoint** (recommendation A below). The existing
  `/api/views/data` compiler can't do a cross-source UNION or per-district
  rollup, and merging 3 paginated endpoints client-side breaks the
  "never render >50 / paginate" rules for freshness sort.

---

## 1. The three data sources / API routes

### 1a. Vacancies

**Primary list route** — `src/app/api/vacancies/route.ts`
- `GET` only. Auth required (`getUser()`, 401 if none).
- Params: `leaid` (single) **or** `leaids` (CSV, preferred for plan/list scope —
  one is REQUIRED, 400 otherwise), `status` (open|closed|expired, default `open`),
  `fullmindRelevant=1`, `category`, `limit` (default 50, max 200). (A `cursor`
  param is documented in the header comment but not implemented in the handler.)
- Order: `orderBy: [{ datePosted: "desc" }, { id: "desc" }]` (`src/app/api/vacancies/route.ts:71`).
- District association: **`leaid`** (`Vacancy.leaid`, the FK). Also returns
  `districtName` (joined `district.name`) and `stateAbbrev`.
- **Chronological date field: `datePosted`** (nullable). Also `firstSeenAt` /
  `lastSeenAt` (non-null) as fallbacks.
- Entity id field: **`id: String`** (cuid).
- Response shape (`src/app/api/vacancies/route.ts:79-101`):
```ts
{ vacancies: Array<{
  id: string; leaid: string; districtName: string | null; stateAbbrev: string | null;
  status: string; title: string; category: string | null;
  schoolNcessch: string | null; schoolName: string | null;
  hiringManager: string | null; hiringEmail: string | null; contactId: number | null;
  startDate: string | null;        // VarChar, not a real date
  datePosted: string | null;       // ISO — chronological key
  fullmindRelevant: boolean; relevanceReason: string | null; sourceUrl: string | null;
  firstSeenAt: string; lastSeenAt: string; // ISO
}> }
```

**Nested plan route** — `src/app/api/territory-plans/[id]/vacancies/route.ts`
- `GET`. Resolves the plan's `districts.districtLeaid` set internally, then
  `where: { leaid: { in: leaids }, status: "open", districtVerified: true }`
  (`includeUnverified=true` lifts the verified filter). Order `datePosted desc`.
- Returns `{ vacancies: [...], summary: { total, fullmindRelevant, byCategory, byDistrict } }`
  where `byDistrict` is keyed by **district NAME** (not leaid). Row fields:
  `id, title, category, status, districtName, districtLeaid, schoolName,
  hiringManager, hiringEmail, startDate, datePosted (ISO), daysOpen,
  fullmindRelevant, relevanceReason, sourceUrl`. Good precedent for the
  "scope to a plan → all in-scope districts" pattern, but it filters to
  `districtVerified` and computes a per-district *name* tally.

**Map route** — `src/app/api/map/vacancies/route.ts` — GeoJSON, bounds-scoped,
raw SQL over `vacancies v JOIN districts d`. Not relevant to the tree; noted for
completeness. Uses `v.date_posted` for `daysOpen`.

### 1b. News

**Primary list route** — `src/app/api/news/route.ts`
- `GET` only. Auth required (401).
- Scope params (mutually exclusive, pick one): `leaid`, `ncessch`, `contactId`,
  `stateAbbrev`, **`territoryPlanId`** (← what the Signals tree's plan scope can
  reuse today), or `scope=my-territory`. **There is NO `leaids` CSV param** and
  no `listId`.
- Common params: `since` (ISO), `limit` (default 10, max 100),
  `minRelevance` (high|medium|low).
- District association is **indirect**, through the `news_article_districts`
  join table (`NewsArticleDistrict`, keyed `articleId + leaid`, with a
  `confidence` column). Default confidence filter is `["high","llm","source"]`.
  `leaid` / `territoryPlanId` paths join through that table; only the
  `territoryPlanId` path returns `districtLeaid`/`districtName` per article.
- **Chronological date field: `publishedAt`** (non-null DateTime).
- Entity id field: **`id: String`** (cuid).
- `NewsArticleDto` (`src/app/api/news/route.ts:12-27`):
```ts
{ id: string; url: string; title: string; description: string | null;
  imageUrl: string | null; author: string | null; source: string; feedSource: string;
  publishedAt: string;            // ISO — chronological key
  categories: string[]; fullmindRelevance: string | null;
  confidence?: string; districtLeaid?: string; districtName?: string }
```
- Wrapped as `{ articles: NewsArticleDto[] }`.

> **Scope limitation:** News has no `leaids` set / list scope. For a plan it
> uses `territoryPlanId` (joins each district's `territoryPlans`). For a list
> (which is just a leaid set today) there is no equivalent — a Signals endpoint
> would need to scope news via `news_article_districts.leaid IN (...)`.

### 1c. RFPs

**Primary list route** — `src/app/api/rfps/route.ts`
- `GET` only. **No auth guard** (unlike vacancies/news).
- Params: `leaid` (single) **or** `leaids` (CSV), `agency_key`, `stateFips`,
  `state` (abbrev → fips via `abbrevToFips`), `q` (title/agency ILIKE),
  `cursor` (base64url of `{capturedDate, id}`), `limit` (default/max 50).
  Neither leaid nor leaids is required (unscoped query is allowed).
- Order: `orderBy: [{ capturedDate: "desc" }, { id: "desc" }]`
  (`src/app/api/rfps/route.ts:78`). Cursor pagination is real here.
- District association: **`leaid: String?`** (NULLABLE — RFPs may be unresolved
  to a district). No district name in the list response (raw `prisma.rfp` rows).
- **Chronological date field options:** `capturedDate` (non-null, used for the
  feed order + cursor), `postedDate` (nullable), `dueDate` (nullable). The list
  endpoint sorts by `capturedDate`; the detail panel surfaces `postedDate`/`dueDate`.
- Entity id field: **`id: Int`** (autoincrement — note: numeric, unlike the
  cuid string ids of vacancies/news).
- Response: `{ items: Rfp[], nextCursor: string | null }` — `items` are raw
  Prisma `Rfp` rows (camelCase, Decimals as Prisma `Decimal`).

---

## 2. The Views data layer (how GridView fetches per source)

**`useViewsData`** — `src/features/views/hooks/useViewsData.ts`
- Signature:
```ts
useViewsData({
  source: SavedListSource;        // 'districts'|'contacts'|'opps'|'vacancies'|'news'|'rfps'
  leaids: string[] | null;
  listId: string | null;
  planId?: string | null;
  layout: GridViewLayout;         // { filters, sort, groupBy }
  limit: number; offset: number;
})
```
- **Every source hits the same endpoint:** `GET ${API_BASE}/views/data?source=…`
  (`useViewsData.ts:52`). It serializes `leaids` (CSV), `listId`, `planId`,
  `filters` (JSON), and repeatable `sort=<id>:<dir>`.
- Query key uses serialized primitives (sorted leaids joined, JSON filter/sort
  strings) per the CLAUDE.md stable-key rule. `enabled = leaids !== null || listId !== null`.
- Returns `{ rows: Record<string,unknown>[]; total: number; truncated?: boolean }`.

**Per-source wiring (which `source` each view passes):**
- `VacanciesView` (`src/features/views/components/views/VacanciesView.tsx`)
  → `<GridView source="vacancies" listId={null} … />`.
- `RfpsView` (`src/features/views/components/views/RfpsView.tsx`)
  → `<GridView source="rfps" listId={null} … />`.
- `NewsView` (`src/features/views/components/views/NewsView.tsx`) → **dual mode.**
  Default `mode="cards"` renders `NewsCards`, which calls
  `GET /api/news?territoryPlanId=<planId>&limit=N` directly (its own `useQuery`,
  key `["views","news",territoryPlanId,visibleCount]`). Switching to
  `mode="table"` renders `<GridView source="news" … />` (→ `/api/views/data`).
  **Cards mode is plan-only** — when `parentKind !== "plan"` it shows
  "News available on plans only".

**`GridView`** — `src/features/views/components/grid/GridView.tsx`
- `PAGE_SIZE = 50`; `limit = page * PAGE_SIZE` (Show-more increments page),
  `offset: 0` always (re-fetches the whole window). `planId` is forwarded only
  when `parentKind === "plan"` (`GridView.tsx:197-198`). Honors a `truncated`
  banner and a filtered-empty state.

**Unified read endpoint** — `src/app/api/views/data/route.ts`
- `GET`, auth-guarded, runs raw parameterized SQL via `readonlyPool`
  (`src/lib/db-readonly.ts`, role `query_tool_readonly`, 5s statement timeout).
- Compiles `layout.filters` → WHERE via `compileFilterTree`
  (`src/lib/saved-views/sql-compiler.ts`), ORDER BY via `buildOrderBy`, then
  `SELECT t.*, COUNT(*) OVER() AS __total FROM <table> t WHERE … LIMIT/OFFSET`.
- **Leaids scoping** uses `SOURCE_TABLES[source].districtJoinColumn`:
  `t.<joinCol> = ANY($N)`. For `source="news"` the join column is `null`, so
  **leaids scoping is silently skipped for news** (documented v1 limitation,
  `route.ts:222-231`). Vacancies/RFPs scope on `leaid`.
- Rows are camelCased before return. The `districts` source gets extra
  per-leaid plan enrichment (target/pipeline/won/lost/activities/churn) — see §5.

**Row shapes returned by `/api/views/data` (raw `SELECT t.*` columns, camelCased):**
- `vacancies` table → `id, leaid, scanId, fingerprint, status, title, category,
  schoolNcessch, schoolName, hiringManager, hiringEmail, contactId, startDate,
  datePosted, fullmindRelevant, relevanceReason, sourceUrl, districtVerified,
  firstSeenAt, lastSeenAt, notes, createdAt, updatedAt`. (No `districtName` —
  it's a raw single-table select; the grid column set only surfaces
  status/category/relevant/title/datePosted, see `SOURCE_COLUMNS.vacancies`.)
- `news_articles` table → `id, url, urlHash, title, description, content,
  imageUrl, author, source, feedSource, publishedAt, fetchedAt, stateAbbrevs,
  categories, fullmindRelevance, classifiedAt, matchedAt`. (No district fields —
  the join table isn't joined here.)
- `rfps` table → full `Rfp` row (id Int, leaid?, capturedDate, postedDate,
  dueDate, status, fullmindRelevance, valueLow/High, agencyName, title, …).

**Filterable/sortable fields per source** — `SOURCE_FIELDS`
(`src/lib/saved-views/source-fields.ts`) and the grid column registry
`SOURCE_COLUMNS` (`src/features/views/lib/columns.ts`). Relevant date columns:
- vacancies: `date_posted` (field id `date_posted`)
- news: `published_at` (field id `published_at`)
- rfps: `due_date` (field id `due_date`) — note the list endpoint orders by
  `captured_date`, which is NOT in the SOURCE_FIELDS allowlist.

---

## 3. Plan/List scope plumbing

**`useScopeLeaids`** — `src/features/views/components/GroupCanvas.tsx:59-72`
```ts
if (kind === "plan") return plan?.districtLeaids ?? [];
// Lists: returns null  → "no narrowing"; views fall back to sample/empty.
return null;
```
- For **plans**: leaids = `plan.districtLeaids` (from `usePlansWithStats`, which
  hits `/api/territory-plans?stats=1`; `PlanWithStats.districtLeaids: string[]`).
- For **lists**: **leaids are `null` today** (Phase E will wire the list
  preview's sample leaids). Consequence: every entity grid currently shows an
  empty/sample state for lists, and News cards mode is plan-only.
- `GroupCanvas` passes `leaids` + `parentKind`/`parentId` down to each view body;
  `parentId` is the plan/list id and is used as `planId` only when `kind==="plan"`.

> **Tree implication:** "all in-scope districts incl. 0-signal ones" works
> cleanly for plans (you have the full `districtLeaids` array up front). For
> lists you must first resolve the list's leaid set (the live-preview /
> `/api/lists/preview` path) before the tree can enumerate districts — same gap
> the rest of Saved Views has.

---

## 4. Detail-panel routing contract

**`DetailKind` union** (`src/features/views/lib/view-types.ts:37-43`):
`"district" | "contact" | "opp" | "vacancy" | "news" | "rfp"`.

**URL parsing** — `useViewsRouter` (`src/features/views/hooks/useViewsRouter.ts`)
- `?detail=kind:id` is parsed by `parseDetailParam` (`:` separator, id length 1–200,
  kind validated via `isDetailKind`). Yields `{ kind, id } | null`.
- `openDetail(kind, id)` sets `?detail=${kind}:${id}` preserving sibling params;
  `closeDetail()` removes it. Row clicks are wired centrally via event delegation
  in `GroupCanvas.CanvasBody` on the first ancestor with
  `[data-row-kind][data-row-id]` (`GroupCanvas.tsx:157-177`). **A Signals row only
  needs `data-row-kind="vacancy|news|rfp"` + `data-row-id="<id>"` to open the
  existing detail panel — no new wiring.**

**Dispatch** — `DetailPanel` (`src/features/views/components/detail/DetailPanel.tsx`)
mounts once at the layout level, keyed on `${kind}:${id}`, and `ContentSwitch`
routes to `VacancyDetailContent` / `NewsDetailContent` / `RfpDetailContent`
(plus district/contact/opp). `DetailPanelTabs` is district-only.

**What each detail component fetches** (all via `useEntity(kind, id)` →
`entityUrl()` in `src/features/views/lib/queries.ts:405-444`):
- **Vacancy** — `useEntity("vacancy", id)` → `GET /api/vacancies/[id]`.
  Expects **string id (cuid)**. Route returns the vacancy + flattened
  `districtName`, `schoolName`, `leaid`. The component reads `id, title,
  category, status, notes, postedDate, leaid, districtName, schoolName`
  (NB: it reads `postedDate`, but the route returns `datePosted` — minor
  existing field-name drift, not introduced by Signals).
- **News** — `useEntity("news", id)` → `GET /api/news/[id]`.
  Expects **string id (cuid)**. Returns article + `districts[]` (with confidence,
  leaid, name, stateAbbrev) + `contacts[]` + `content` + `publishedAt`.
- **RFP** — `useEntity("rfp", id)` → `GET /api/rfps/[id]`.
  Expects an **id that `parseInt`s to a number** (RFP PK is `Int`). The route
  400s on a non-numeric id. Returns the full RFP + joined `district`
  (`{leaid,name,stateAbbrev}`), `valueLow/High` as numbers, ISO dates.

> **Id-type gotcha for the tree:** vacancy/news ids are strings, rfp ids are
> numbers. The mixed signal list must carry both the kind and the id as a string
> in the row, and the detail route for rfp will coerce it. The `?detail` URL
> already round-trips ids as strings, so this is fine end-to-end.

---

## 5. District metadata for the tree rows (name + pipeline/ARR)

- **District display name** lives on `districts.name` (`District.name`,
  `prisma/schema.prisma:17`); districts are keyed by `leaid` (VarChar(7) PK).
  Other handy columns on the same row: `stateAbbrev`, `enrollment`,
  `isCustomer`, `hasOpenPipeline`, `totalRevenue`.
- **There is no single "district summary by leaid set" helper that returns
  name + pipeline/ARR.** Candidates inspected:
  - `GET /api/districts/summary` (`src/app/api/districts/summary/route.ts`) — a
    *vendor/category rollup aggregate* (counts + revenue SUMs grouped by
    `fyXX_fullmind_category`), filtered by states/owner/planId — NOT a per-leaid
    name lookup. Not reusable for tree rows.
  - `src/features/districts/lib/queries.ts` — single-district detail hooks, no
    batch-by-leaid query.
- **Best existing per-leaid-set rollup precedent:** the `districts` branch of
  `/api/views/data` (`src/app/api/views/data/route.ts:324-376` +
  `fetchDistrictPlanEnrichment` at `:457-639`). Given a `planId` + leaid set it
  returns, **batched and keyed by leaid (no N+1)**: `target`, `pipelineMin/Max`,
  `wonMin/Max`, `open/won/lostCount`, last/next activity, `activitiesCount90d`,
  `churnRisk`, plan notes, plus a global `customerRank`. This is the pattern a
  Signals endpoint should mirror for any per-district ARR/pipeline chips: one
  `SELECT … WHERE leaid = ANY($1)` per metric, merged in a Map.
- For the **name + state for an arbitrary leaid set with no N+1**, a single
  `SELECT leaid, name, state_abbrev, enrollment FROM districts WHERE leaid = ANY($1)`
  is the right primitive (the same shape vacancies/news routes already use to
  join `district`).

---

## 6. Recommendation: feed the tree with a NEW unified `GET /api/signals`

**Recommend (A): a new unified endpoint** rather than (B) client-side merge of
the 3 existing endpoints.

### Why not (B) client-side merge
- **Freshness sort breaks pagination.** Reverse-chronological-across-sources +
  "district with the newest signal first" requires knowing the global newest
  date per district before you can sort districts. Three independently paginated
  endpoints (vacancies `limit/datePosted`, news `limit/publishedAt`, rfps
  `cursor/capturedDate`) can't give a correct global ordering without
  over-fetching all three to large limits — which violates the CLAUDE.md
  "never render >50 / paginate" rule and the stable-key rule (you'd juggle three
  query keys + a client merge).
- **Per-type counts + 0-signal districts need a server group-by.** The client
  would have to fetch the plan's full `districtLeaids`, fetch all three sources,
  bucket by leaid, and synthesize empty districts — heavy and easy to get wrong.
- **News has no leaid-set scope** in `/api/news` (only `territoryPlanId`/single
  `leaid`), and `/api/views/data?source=news` *silently ignores* leaids. So (B)
  can't even scope news to a list correctly without new server work anyway.

### Why (A) — new `GET /api/signals`
A single endpoint can do the grouping, counts, freshness, and reverse-chron
merge in SQL/one round trip, returning a tree-ready payload that paginates at
the **district** level (≤50 districts per page) with signals nested.

**Proposed contract (for the spec stage to refine):**
```
GET /api/signals?planId=<id>            // plan scope: derive leaids server-side
GET /api/signals?leaids=a,b,c           // list/explicit scope
   &types=vac,news,rfp                  // optional type filter
   &sort=freshness|name                 // default freshness
   &limit=50&offset=0                    // district-level pagination
   &signalsPerDistrict=N                 // cap nested rows (e.g. 20) + hasMore
→ {
  districts: Array<{
    leaid: string; name: string; stateAbbrev: string | null;
    counts: { vac: number; news: number; rfp: number };
    newestSignalAt: string | null;       // for freshness sort + age badge
    signals: Array<{
      type: "vac" | "news" | "rfp";
      id: string;                        // string even for rfp (Int → string)
      title: string;
      date: string;                      // ISO: datePosted | publishedAt | capturedDate
      // type-specific meta (status/category/relevance/value) optional
    }>;                                   // reverse-chron, capped
    hasMoreSignals: boolean;
  }>;
  total: number;                          // district count in scope
}
```

**SQL the unified endpoint needs** (auth-guarded; can use `prisma.$queryRaw` or
the readonly pool). Backing tables/models confirmed:

| Source | Prisma model / raw table | district key | chronological column |
|---|---|---|---|
| Vacancies | `Vacancy` / `vacancies` | `leaid` (FK, non-null) | `date_posted` (nullable) — fall back to `first_seen_at` |
| News | `NewsArticle` / `news_articles` joined via `NewsArticleDistrict` / `news_article_districts` (`leaid`, `confidence`) | `news_article_districts.leaid` | `published_at` (non-null) |
| RFPs | `Rfp` / `rfps` | `leaid` (NULLABLE) | `due_date`/`posted_date`/`captured_date` (use `captured_date` for "freshness", matching the existing feed) |

Sketch:
1. Resolve scope leaids — from `territory_plan_districts.district_leaid` when
   `planId` given, else the `leaids` CSV.
2. Per-district newest + counts via three grouped sub-selects unioned/merged by
   leaid (e.g. `SELECT leaid, COUNT(*), MAX(date_posted) FROM vacancies WHERE
   leaid = ANY($1) GROUP BY leaid`, ditto news through the join table, ditto
   rfps). Combine into a per-leaid `{vac,news,rfp,newest}` Map.
3. Left-join against `SELECT leaid, name, state_abbrev FROM districts WHERE leaid
   = ANY($1)` so **0-signal districts still appear**.
4. Order districts by `GREATEST(maxVac, maxNews, maxRfp)` desc (freshness) or
   `name` asc; paginate at the district level.
5. For the page's districts, fetch the capped reverse-chron signal rows
   (a `UNION ALL` of the three sources with a normalized `(type, id, title, date)`
   projection, `ORDER BY date DESC`, windowed per leaid) — or fetch lazily per
   district on expand if the design wants lighter initial payloads.

**Performance/CLAUDE.md alignment:** district-level pagination keeps rendered
rows ≤50; one TanStack key over serialized primitives (`planId`/sorted leaids /
sort / page); freshness ordering is correct because it's computed server-side;
counts + 0-signal districts come free from the group-by + left join. Reuse the
batched-by-leaid Map merge style from `fetchDistrictPlanEnrichment`
(`src/app/api/views/data/route.ts:457`) — no N+1.

**Detail panel reuse:** none of the detail routes change. Each signal row just
needs `data-row-kind` (`vacancy`/`news`/`rfp`) + `data-row-id`; the existing
`GroupCanvas` delegation + `DetailPanel` dispatch + `useEntity` fetch handle the
rest. (Confirm the row "type" tag maps `vac→vacancy`, `news→news`, `rfp→rfp` for
the `DetailKind` value.)

---

## What needs to be created

- **New API route:** `GET /api/signals` (auth-guarded) — district-grouped,
  freshness-sorted, per-type counts, capped reverse-chron nested signals,
  district-level pagination. Plan scope (`planId`) and explicit `leaids` scope.
  Use the readonly pool or `prisma.$queryRaw` with `leaid = ANY($1)` batches.
- **New TanStack hook:** `useSignals({ planId | leaids, sort, page, … })` in
  `src/features/views/lib/queries.ts` (serialized-primitive key), mirroring
  `useViewsData`'s key discipline.
- **New view component:** a `SignalsView` under
  `src/features/views/components/views/` that renders the expandable tree
  (replacing the 3 separate `VacanciesView`/`NewsView`/`RfpsView` tabs in
  `ViewBody`/`view-types.ts`). Rows carry `data-row-kind`+`data-row-id`.
- **List-scope follow-up (shared gap):** for lists, resolve the list's leaid set
  (via the list preview path) before the tree can enumerate districts — same
  limitation called out in `useScopeLeaids`.
- **No new DB models needed.** All three sources + the district name/ARR data
  already exist (`Vacancy`, `NewsArticle`+`NewsArticleDistrict`, `Rfp`,
  `District`, `territory_plan_districts`).

### Key file references
- `src/app/api/vacancies/route.ts`, `.../vacancies/[id]/route.ts`,
  `src/app/api/territory-plans/[id]/vacancies/route.ts`, `src/app/api/map/vacancies/route.ts`
- `src/app/api/news/route.ts`, `.../news/[id]/route.ts`
- `src/app/api/rfps/route.ts`, `.../rfps/[id]/route.ts`
- `src/app/api/views/data/route.ts` (unified compiler + `fetchDistrictPlanEnrichment`)
- `src/lib/saved-views/source-fields.ts` (`SOURCE_TABLES`, `SOURCE_FIELDS`)
- `src/lib/saved-views/sql-compiler.ts`
- `src/features/views/hooks/useViewsData.ts`, `.../hooks/useViewsRouter.ts`
- `src/features/views/lib/queries.ts` (`useEntity`, `entityUrl`)
- `src/features/views/lib/columns.ts` (`SOURCE_COLUMNS`), `.../lib/view-types.ts`
- `src/features/views/components/GroupCanvas.tsx` (`useScopeLeaids`, row delegation)
- `src/features/views/components/views/{Vacancies,News,Rfps}View.tsx`
- `src/features/views/components/detail/{DetailPanel,VacancyDetailContent,NewsDetailContent,RfpDetailContent}.tsx`
- `prisma/schema.prisma` — `District` (:15), `Vacancy` (:1663),
  `NewsArticle` (:1883), `NewsArticleDistrict` (:1921), `Rfp` (:2004)
- `src/lib/db-readonly.ts` (readonly pool), `src/lib/prisma.ts`, `src/lib/db.ts`
