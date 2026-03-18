# Implementation Plan: Vacancy Scanner

**Date:** 2026-03-17
**Spec:** `docs/superpowers/specs/2026-03-17-vacancy-scanner-design.md`
**Branch:** `worktree-vacancy-scanner`

## Task Overview

| # | Task | Type | Dependencies | Est. Complexity |
|---|------|------|-------------|-----------------|
| 1 | Database schema + migrations | Backend | None | Medium |
| 2 | Platform detector + parsers | Backend | None | Medium |
| 3 | Claude fallback scraper | Backend | None | Medium |
| 4 | Post-processor pipeline | Backend | 1 | High |
| 5 | Scan API routes + background queue | Backend | 1, 2, 3, 4 | High |
| 6 | Vacancies API route | Backend | 1 | Low |
| 7 | VacanciesCard (district panel) | Frontend | 6 | Medium |
| 8 | Explore modal vacancies section | Frontend | 6 | Low |
| 9 | Territory plan bulk scan UI | Frontend | 5 | Medium |
| 10 | Admin keyword config UI | Frontend | 1 | Medium |
| 11 | Seed data + migration | Backend | 1 | Low |

**Parallelization:** Tasks 2, 3 can run in parallel (no shared state). Tasks 7, 8, 9, 10 can run in parallel after their backend deps are met.

---

## Task 1: Database Schema + Migrations

**Goal:** Add new tables and fields to Prisma schema.

**Changes:**
- `prisma/schema.prisma`:
  - Add `jobBoardPlatform String? @map("job_board_platform") @db.VarChar(50)` to `District` model
  - Add `vacancyScans VacancyScan[]` and `vacancies Vacancy[]` reverse relations to `District`
  - Add `vacancies Vacancy[]` reverse relation to `School`
  - Add `vacancies Vacancy[]` reverse relation to `Contact`
  - Create `VacancyScan` model (per spec)
  - Create `Vacancy` model (per spec — `id` as cuid, `scanId` with `@db.VarChar(30)`, `updatedAt` included)
  - Create `VacancyKeywordConfig` model (per spec)

**Steps:**
1. Edit `prisma/schema.prisma` with all changes above
2. Run `npx prisma migrate dev --name add-vacancy-scanner-tables`
3. Verify migration succeeds

**Test strategy:** Migration itself validates schema. No unit tests needed for this task.

---

## Task 2: Platform Detector + Parsers

**Goal:** Build the platform detection and deterministic parsers for known job board platforms.

**New files:**
- `src/features/vacancies/lib/platform-detector.ts` — Inspects `jobBoardUrl` domain, returns platform string
- `src/features/vacancies/lib/parsers/types.ts` — `RawVacancy` interface
- `src/features/vacancies/lib/parsers/applitrack.ts` — AppliTrack parser
- `src/features/vacancies/lib/parsers/olas.ts` — OLAS parser
- `src/features/vacancies/lib/parsers/schoolspring.ts` — SchoolSpring parser
- `src/features/vacancies/lib/parsers/index.ts` — Router: platform → parser function

**Platform detector logic:**
```typescript
function detectPlatform(url: string): string {
  const hostname = new URL(url).hostname;
  if (hostname.includes("applitrack.com")) return "applitrack";
  if (hostname.includes("olasjobs.org")) return "olas";
  if (hostname.includes("schoolspring.com")) return "schoolspring";
  if (hostname.includes("talented.com")) return "talentEd";
  return "unknown";
}
```

**Each parser:**
- Fetches the listing page HTML
- Parses with Cheerio (existing dependency or add it)
- Returns `RawVacancy[]`
- Handles pagination if the platform uses it

**Test strategy:**
- Unit test `detectPlatform` with various URLs
- Unit test each parser with saved HTML snapshots (fixture files)
- `src/features/vacancies/lib/__tests__/platform-detector.test.ts`
- `src/features/vacancies/lib/parsers/__tests__/applitrack.test.ts` (etc.)

---

## Task 3: Claude Fallback Scraper

**Goal:** Build the fallback scraping path for unknown/self-hosted job board sites.

**Dependencies to install:**
- `@anthropic-ai/sdk`
- `playwright` (if not already available — check deployment constraints)

**New files:**
- `src/features/vacancies/lib/parsers/claude-fallback.ts`

**Logic:**
1. Fetch page HTML via Playwright (launch headless Chromium, navigate, wait for content, extract `document.body.innerText`)
2. Strip to text content (remove excessive whitespace)
3. Call Claude API (`claude-sonnet-4-6`) with `tool_use` — define a tool with `RawVacancy[]` schema
4. Parse tool call result into `RawVacancy[]`
5. Timeout: 45 seconds for page load, 30 seconds for Claude API call

**Environment variable:** `ANTHROPIC_API_KEY`

**Test strategy:**
- Unit test the Claude prompt construction
- Integration test with a mocked Anthropic client (don't call real API in tests)
- `src/features/vacancies/lib/parsers/__tests__/claude-fallback.test.ts`

---

## Task 4: Post-Processor Pipeline

**Goal:** Build the shared post-processing pipeline that runs after any parser.

**New files:**
- `src/features/vacancies/lib/post-processor.ts` — Main pipeline orchestrator
- `src/features/vacancies/lib/role-filter.ts` — Exclusion keyword matching
- `src/features/vacancies/lib/categorizer.ts` — Assigns vacancy category
- `src/features/vacancies/lib/relevance-flagger.ts` — Fullmind relevance matching
- `src/features/vacancies/lib/school-matcher.ts` — Fuzzy school name matching
- `src/features/vacancies/lib/contact-matcher.ts` — Email-based contact matching
- `src/features/vacancies/lib/fingerprint.ts` — Fingerprint generation

**Post-processor pipeline (in order):**
1. Load keyword configs from DB (`VacancyKeywordConfig`)
2. **Role filter:** Match each `RawVacancy.title` against exclusion keywords. Discard matches.
3. **Categorize:** Match title against category keywords → assign `category` (SPED, ELL, General Ed, Admin, Specialist, Counseling, Related Services, Other)
4. **Fullmind relevance:** Match title + rawText against relevance keywords → set `fullmindRelevant` + `relevanceReason`
5. **School matching:** For each vacancy with `schoolName`, query schools for that `leaid`, normalize + compare. Exact match first, then Dice coefficient ≥ 0.8.
6. **Contact matching:** For each vacancy with `hiringEmail`, exact-match against contacts for that `leaid`.
7. **Fingerprint:** `hash(leaid + normalize(title) + normalize(schoolName || ""))`
8. **Upsert:** For each processed vacancy:
   - If fingerprint exists + open → update `lastSeenAt`, update changed fields
   - If fingerprint exists + closed → reopen, update `lastSeenAt`
   - If fingerprint new → insert
9. **Mark closed:** Find open vacancies for this `leaid` NOT in current scan's fingerprints. If count > 0 AND current scan found > 0 results (partial-scrape safety), mark them closed. If scan found 0 but district had >3 open, set scan status to `completed_partial` and skip closing.

**Test strategy:**
- Unit test each module independently with mock data
- Integration test the full pipeline with mock DB (Prisma mock or test database)
- Key edge cases: partial scrape safety, fingerprint collision, reopen logic
- `src/features/vacancies/lib/__tests__/post-processor.test.ts`
- `src/features/vacancies/lib/__tests__/role-filter.test.ts`
- `src/features/vacancies/lib/__tests__/school-matcher.test.ts`
- `src/features/vacancies/lib/__tests__/fingerprint.test.ts`

---

## Task 5: Scan API Routes + Background Queue

**Goal:** Build the API endpoints that trigger scans and the background processing queue.

**Dependencies to install:**
- `p-queue`

**New files:**
- `src/features/vacancies/lib/scan-queue.ts` — Singleton `PQueue` instance with concurrency=5, per-district scan orchestration
- `src/features/vacancies/lib/scan-runner.ts` — Orchestrates a single district scan (detect → parse → post-process → update VacancyScan)
- `src/app/api/vacancies/scan/route.ts` — `POST`: trigger single scan
- `src/app/api/vacancies/scan/[scanId]/route.ts` — `GET`: poll scan status
- `src/app/api/vacancies/scan-bulk/route.ts` — `POST`: trigger bulk scan for territory plan
- `src/app/api/vacancies/batch/[batchId]/route.ts` — `GET`: poll bulk scan progress

**Single scan flow (`POST /api/vacancies/scan`):**
1. Validate auth (session user)
2. Validate `leaid`, check district has `jobBoardUrl` (400 if not)
3. Create `VacancyScan` row (status: pending, triggeredBy: session user)
4. Enqueue scan job on `PQueue`
5. Return `{ scanId, status: "pending" }` immediately

**Bulk scan flow (`POST /api/vacancies/scan-bulk`):**
1. Validate auth
2. Fetch all districts in territory plan with non-null `jobBoardUrl`
3. Generate `batchId` (cuid)
4. Create `VacancyScan` rows for each (status: pending, same batchId)
5. Enqueue all on `PQueue`
6. Return `{ batchId, totalDistricts, scansCreated, skipped }`

**Scan runner (per district):**
1. Set scan status to `running`
2. Detect platform (update `District.jobBoardPlatform` if changed)
3. Run parser (platform-specific or Claude fallback)
4. Run post-processor
5. Update scan: status=completed, vacancyCount, fullmindRelevantCount, completedAt
6. On error: status=failed, errorMessage, retry once
7. Per-district timeout: 60 seconds

**Stale scan recovery:** On module load, query for `running` scans older than 10 minutes, mark `failed`.

**Test strategy:**
- Unit test scan runner with mocked parser + post-processor
- API route tests: request validation, auth, response shapes
- `src/app/api/vacancies/scan/__tests__/route.test.ts`
- `src/app/api/vacancies/scan-bulk/__tests__/route.test.ts`
- `src/features/vacancies/lib/__tests__/scan-runner.test.ts`

---

## Task 6: Vacancies API Route

**Goal:** Build the endpoint to fetch vacancies for a district.

**New files:**
- `src/app/api/districts/[leaid]/vacancies/route.ts`

**`GET /api/districts/[leaid]/vacancies`:**
1. Validate auth
2. Query params: `?status=open` (default) or `?status=all`
3. Fetch vacancies for `leaid` with `status` filter
4. Include linked school and contact data (Prisma `include`)
5. Compute summary: totalOpen, fullmindRelevant, byCategory counts, lastScannedAt (from most recent VacancyScan)
6. Compute `daysOpen` for each vacancy (now - firstSeenAt)
7. Return response matching spec schema

**Test strategy:**
- API route test with mock data
- `src/app/api/districts/[leaid]/vacancies/__tests__/route.test.ts`

---

## Task 7: VacanciesCard (District Panel)

**Goal:** Add a vacancies section to the district detail panel.

**New files:**
- `src/features/map/components/panels/district/VacanciesCard.tsx`

**Existing files to modify:**
- `src/features/map/components/panels/district/DistrictDetailPanel.tsx` — Add VacanciesCard

**Component design:**
- Uses `SignalCard` wrapper (like StaffingCard)
- Shows summary line: "N open positions (M Fullmind-relevant) — Last scanned [date]"
- Vacancy list grouped by category
- Fullmind-relevant vacancies highlighted (accent color)
- Each vacancy: title, school (linked if matched), hiring contact, start date, "Posted X days ago"
- "Scan Now" button triggers `POST /api/vacancies/scan`
- Loading/polling state while scan runs
- Empty state if no vacancies or no jobBoardUrl

**Data fetching:**
- TanStack Query: `useQuery(["vacancies", leaid], fetchVacancies)`
- Scan trigger: `useMutation` → then invalidate vacancies query on completion
- Poll scan status while running (refetchInterval)

**Test strategy:**
- Component test: renders summary, list, handles empty state
- `src/features/map/components/panels/district/__tests__/VacanciesCard.test.tsx`

---

## Task 8: Explore Modal Vacancies Section

**Goal:** Add vacancy data to the DistrictExploreModal.

**Existing files to modify:**
- `src/features/map/components/SearchResults/DistrictExploreModal.tsx`
  - Add `"vacancies"` to the `Tab` type
  - Add vacancies tab button
  - Add vacancies tab content (reuse or extract shared vacancy list component)

**Shared component (extract from Task 7 if needed):**
- `src/features/vacancies/components/VacancyList.tsx` — Shared vacancy list used by both panel and modal

**Test strategy:**
- Verify tab renders and switches correctly
- `src/features/map/components/SearchResults/__tests__/DistrictExploreModal.test.tsx` — extend existing tests

---

## Task 9: Territory Plan Bulk Scan UI

**Goal:** Add "Scan Vacancies" button and progress UI to the territory plan view.

**New files:**
- `src/features/vacancies/components/BulkScanButton.tsx` — Button + progress indicator
- `src/features/vacancies/lib/queries.ts` — TanStack Query hooks for vacancy scanning

**Existing files to modify:**
- `src/features/plans/components/PlanCard.tsx` or `FlippablePlanCard.tsx` — Add BulkScanButton to plan actions

**Component design:**
- Button: "Scan Vacancies" (idle) → "Scanning... 12/47" (active) → "234 vacancies found" (complete)
- Triggers `POST /api/vacancies/scan-bulk` with `territoryPlanId`
- Polls `GET /api/vacancies/batch/[batchId]` for progress
- Completion summary: total vacancies, Fullmind-relevant count
- Disabled if no districts in plan have `jobBoardUrl`

**Test strategy:**
- Component test: button states, progress display
- `src/features/vacancies/components/__tests__/BulkScanButton.test.ts`

---

## Task 10: Admin Keyword Config UI

**Goal:** Add CRUD interface for service line keywords and role exclusions in the admin panel.

**New files:**
- `src/features/admin/components/VacancyConfigTab.tsx` — Tab content with two sections
- `src/app/api/admin/vacancy-config/route.ts` — `GET` (list all) + `POST` (create)
- `src/app/api/admin/vacancy-config/[id]/route.ts` — `PUT` (update) + `DELETE`

**Existing files to modify:**
- `src/features/admin/components/AdminShell.tsx` — Add "Vacancy Config" tab

**Component design:**
- Two sections: "Service Line Keywords" (type=relevance) and "Role Exclusions" (type=exclusion)
- Each section: table with label, keywords, service line (relevance only), edit/delete actions
- Add row form: inline or modal
- Edit: inline editing of keywords (comma-separated input)

**Test strategy:**
- API route tests for CRUD operations
- Component test: renders config, handles add/edit/delete
- `src/app/api/admin/vacancy-config/__tests__/route.test.ts`

---

## Task 11: Seed Data + Migration

**Goal:** Seed the `VacancyKeywordConfig` table with initial relevance and exclusion rules.

**New files:**
- `prisma/seeds/vacancy-keywords.ts` — Seed script

**Seed data:** Per spec — 5 relevance rules, 7 exclusion rules.

**Steps:**
1. Write seed script that upserts keyword configs
2. Run seed: `npx prisma db seed` or direct script execution
3. Verify data in DB

**Test strategy:** Verify seed script is idempotent (can run multiple times without duplicates).

---

## Execution Order

```
Phase 1 (parallel):
  Task 1: Schema + migrations
  Task 2: Platform detector + parsers
  Task 3: Claude fallback scraper

Phase 2 (after Task 1):
  Task 4: Post-processor pipeline
  Task 6: Vacancies API route
  Task 11: Seed data

Phase 3 (after Tasks 2, 3, 4):
  Task 5: Scan API routes + background queue

Phase 4 (parallel, after Tasks 5, 6):
  Task 7: VacanciesCard
  Task 8: Explore modal section
  Task 9: Bulk scan UI
  Task 10: Admin config UI
```

## Review Checkpoints

After each phase completes:
1. Run `npx vitest run` — all tests pass
2. Run `npm run build` — no type errors
3. Verify against spec — check off implemented requirements
