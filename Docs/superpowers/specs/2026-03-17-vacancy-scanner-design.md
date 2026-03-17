# Vacancy Scanner — Design Spec

**Date:** 2026-03-17
**Status:** Draft

## Overview

A "Get Vacancies" feature that scrapes school district job boards, extracts structured vacancy data, and surfaces it to sales reps in the territory planner. Uses a hybrid approach: platform-specific parsers for known job board platforms (AppliTrack, OLAS, SchoolSpring) and Claude API fallback for self-hosted/unknown sites.

## Goals

- Let reps see open positions at any district with one click
- Bulk-scan an entire territory plan's districts in one action
- Link vacancies to existing schools and contacts in the database
- Flag vacancies that align with Fullmind service lines
- Filter out non-instructional roles (bus drivers, custodial, food service, etc.)
- Track vacancy trends over time (new postings, how long positions stay open, closures)

## Data Model

### New field on `District`

```prisma
jobBoardPlatform String? @map("job_board_platform") @db.VarChar(50)
```

Auto-detected from `jobBoardUrl`. Values: `"applitrack"`, `"olas"`, `"schoolspring"`, `"talentEd"`, `"unknown"`, `null`.

### Required additions to existing models

The new tables reference existing models. Add reverse relations:

**District model:** add `vacancyScans VacancyScan[]` and `vacancies Vacancy[]`

**School model:** add `vacancies Vacancy[]`

**Contact model:** add `vacancies Vacancy[]`

### New table: `VacancyScan`

Tracks each scan run for audit and progress reporting.

```prisma
model VacancyScan {
  id                    String    @id @default(cuid())
  leaid                 String    @db.VarChar(7)
  status                String    @db.VarChar(20) // pending, running, completed, failed
  platform              String?   @db.VarChar(50)
  vacancyCount          Int?      @map("vacancy_count")
  fullmindRelevantCount Int?      @map("fullmind_relevant_count")
  startedAt             DateTime  @default(now()) @map("started_at")
  completedAt           DateTime? @map("completed_at")
  errorMessage          String?   @map("error_message") @db.Text
  triggeredBy           String    @map("triggered_by") @db.VarChar(100)
  batchId               String?   @map("batch_id") @db.VarChar(50)

  district  District  @relation(fields: [leaid], references: [leaid])
  vacancies Vacancy[]

  @@index([leaid])
  @@index([batchId])
  @@index([status])
  @@map("vacancy_scans")
}
```

### New table: `Vacancy`

Individual job postings with fingerprint-based dedup.

```prisma
model Vacancy {
  id               String    @id @default(cuid())
  leaid            String    @db.VarChar(7)
  scanId           String    @map("scan_id") @db.VarChar(30)
  fingerprint      String    @db.VarChar(255) // hash of leaid + title + schoolName
  status           String    @default("open") @db.VarChar(10) // open, closed, expired
  title            String    @db.VarChar(500)
  category         String?   @db.VarChar(50) // SPED, ELL, General Ed, Admin, etc.
  schoolNcessch    String?   @map("school_ncessch") @db.VarChar(12)
  schoolName       String?   @map("school_name") @db.VarChar(255)
  hiringManager    String?   @map("hiring_manager") @db.VarChar(255)
  hiringEmail      String?   @map("hiring_email") @db.VarChar(255)
  contactId        Int?      @map("contact_id")
  startDate        String?   @map("start_date") @db.VarChar(50) // "2026-08-15", "ASAP", "Fall 2026"
  datePosted       DateTime? @map("date_posted")
  fullmindRelevant Boolean   @default(false) @map("fullmind_relevant")
  relevanceReason  String?   @map("relevance_reason") @db.VarChar(255)
  sourceUrl        String?   @map("source_url") @db.VarChar(1000)
  rawText          String?   @map("raw_text") @db.Text
  firstSeenAt      DateTime  @default(now()) @map("first_seen_at")
  lastSeenAt       DateTime  @default(now()) @map("last_seen_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  district District  @relation(fields: [leaid], references: [leaid])
  scan     VacancyScan @relation(fields: [scanId], references: [id])
  school   School?   @relation(fields: [schoolNcessch], references: [ncessch])
  contact  Contact?  @relation(fields: [contactId], references: [id])

  @@unique([fingerprint])
  @@index([leaid])
  @@index([scanId])
  @@index([status])
  @@index([fullmindRelevant])
  @@map("vacancies")
}
```

### New table: `VacancyKeywordConfig`

Admin-configurable keywords for relevance flagging and role exclusion.

```prisma
model VacancyKeywordConfig {
  id       Int    @id @default(autoincrement())
  type     String @db.VarChar(20) // "relevance" or "exclusion"
  label    String @db.VarChar(100) // "SPED", "Bus Driver", etc.
  keywords String[] // ["special education", "sped", "resource room"]
  serviceLine String? @map("service_line") @db.VarChar(100) // only for type=relevance

  @@index([type])
  @@map("vacancy_keyword_config")
}
```

**Seed data — relevance rules:**

| Label | Service Line | Keywords |
|-------|-------------|----------|
| SPED / Special Education | SPED | special education, sped, resource room, self-contained, inclusion |
| ELL / Bilingual | ELL | ell, esl, bilingual, dual language, english learner |
| Mental Health / SEL | Mental Health | school psychologist, social worker, counselor, sel, mental health |
| Tutoring / Intervention | Intervention | interventionist, tutor, reading specialist, math specialist, title I |
| Related Services | Related Services | speech pathologist, slp, occupational therapist, ot, pt |

**Seed data — exclusion rules:**

| Label | Keywords |
|-------|----------|
| Transportation | bus driver, bus monitor, bus aide, transportation |
| Custodial | custodian, custodial, maintenance, groundskeeper |
| Food Service | food service, cafeteria, lunch, cook, kitchen |
| Health Support | nurse, health aide, school nurse |
| Security | security, safety officer, school resource officer |
| Clerical | secretary, clerical, receptionist, office aide |
| Paraprofessional | paraprofessional, para, teaching assistant, teacher aide, instructional aide |

## Scraping Pipeline Architecture

```
Request (single or bulk)
        │
        ▼
┌─ Platform Detector ──────────┐
│  Inspect jobBoardUrl domain  │
│  → applitrack.com            │
│  → olasjobs.org              │
│  → schoolspring.com          │
│  → unknown                   │
│  Store on District record    │
└───────────┬──────────────────┘
            │
            ▼
┌─ Router ─────────────────────┐
│  Known? → Platform Parser    │
│  Unknown? → Claude Fallback  │
└─────┬─────────────┬──────────┘
      │             │
      ▼             ▼
  Platform       Fetch HTML
  Parser         (headless browser)
  (structured    → Claude API
   page parse)   (structured output)
      │             │
      └──────┬──────┘
             ▼
     RawVacancy[]
             │
             ▼
┌─ Post-Processor ─────────────┐
│  1. Role filter (exclusions) │
│  2. Categorize               │
│  3. Fullmind relevance flag  │
│  4. Match schools (fuzzy)    │
│  5. Match contacts (email)   │
│  6. Generate fingerprint     │
│  7. Upsert vacancies         │
│  8. Mark disappeared = closed│
└──────────────────────────────┘
```

### Platform Detector

Inspects `jobBoardUrl` domain and sets `jobBoardPlatform`:

| Domain Pattern | Platform |
|---------------|----------|
| `*.applitrack.com` | applitrack |
| `*.olasjobs.org` | olas |
| `*.schoolspring.com` | schoolspring |
| `*.talented.com` | talentEd |
| Everything else | unknown |

### Platform Parsers

Each parser: `(url: string) => Promise<RawVacancy[]>`

```typescript
interface RawVacancy {
  title: string;
  schoolName?: string;
  hiringManager?: string;
  hiringEmail?: string;
  startDate?: string;
  datePosted?: string;
  sourceUrl?: string;
  rawText?: string;
}
```

Parsers fetch the listing page HTML and extract structured data using known DOM structure for each platform. No AI needed — these are deterministic.

### Claude Fallback

For unknown/self-hosted sites:

1. Fetch page HTML via Playwright (runs locally / on Railway — not serverless-compatible, but we deploy on Railway)
2. Strip to text content (remove scripts, styles, nav)
3. Send to Claude API with structured output schema matching `RawVacancy[]`
4. Parse response

**Dependencies:**
- `@anthropic-ai/sdk` — Claude API client
- `playwright` — headless browser for JS-rendered pages

**Claude API details:**
- Model: `claude-sonnet-4-6` (best cost/quality for structured extraction)
- Structured output via `tool_use` — define a tool with `RawVacancy[]` schema, Claude populates it
- Max tokens: 4096 (sufficient for even large job boards)
- Estimated cost: ~$0.02–0.10 per district depending on page size

**Prompt includes:** the `RawVacancy` schema, instructions to extract all job listings, context that this is a school district job board, and instruction to ignore non-teaching/non-administrative roles.

### Post-Processor

Runs the same logic regardless of source:

1. **Role filter:** Match title against exclusion keywords from `VacancyKeywordConfig` (type=exclusion). Discard matches.
2. **Categorize:** Assign category based on title keywords (SPED, ELL, General Ed, Admin, Specialist, Counseling).
3. **Fullmind relevance:** Match title + rawText against relevance keywords from `VacancyKeywordConfig` (type=relevance). Set `fullmindRelevant` and `relevanceReason`.
4. **School matching:** Normalize vacancy `schoolName` and compare against schools in DB for that `leaid`. Exact match first, then string similarity (Dice coefficient, threshold 0.8). Set `schoolNcessch` if matched.
5. **Contact matching:** If `hiringEmail` is present, exact-match against contacts for that `leaid`. Set `contactId` if matched. No name matching — too many false positives.
6. **Fingerprint:** Generate from `leaid + normalize(title) + normalize(schoolName)`. Used as unique key for upsert.
7. **Upsert:** Insert new vacancies, update `lastSeenAt` on existing ones.
8. **Mark closed:** Any previously-open vacancies for this district that were NOT seen in this scan get status set to `"closed"`. **Safety check:** if the scan found zero vacancies but the district previously had many (>3), mark the scan as `partial` instead of auto-closing — this likely indicates a scrape failure rather than all positions being filled. The `VacancyScan.status` will be set to `"completed_partial"` and existing vacancies left untouched.

## API Design

All endpoints require authenticated user session (same auth pattern as existing API routes). The `triggeredBy` field on VacancyScan is populated from the session user.

### `POST /api/vacancies/scan`

Trigger scan for a single district.

**Request:** `{ leaid: string }`

**Response:** `{ scanId: string, status: "pending" }`

Creates a `VacancyScan` row and enqueues the job. Returns immediately. Returns 400 if the district has no `jobBoardUrl`.

### `POST /api/vacancies/scan-bulk`

Trigger scan for all districts in a territory plan.

**Request:** `{ territoryPlanId: string }`

**Response:** `{ batchId: string, totalDistricts: number, scansCreated: number, skipped: number }`

Creates a `VacancyScan` row for each district in the plan that has a `jobBoardUrl`. Returns a `batchId` for progress tracking. `skipped` reports districts without a `jobBoardUrl`.

### `GET /api/vacancies/scan/[scanId]`

Poll single scan status.

**Response:** `{ scanId, status, vacancyCount, fullmindRelevantCount, completedAt }`

### `GET /api/vacancies/batch/[batchId]`

Poll bulk scan progress.

**Response:**
```json
{
  "batchId": "...",
  "total": 47,
  "completed": 12,
  "failed": 1,
  "pending": 34,
  "vacanciesFound": 89,
  "fullmindRelevant": 23
}
```

### `GET /api/districts/[leaid]/vacancies`

Get current vacancies for a district.

**Query params:** `?status=open` (default), `?status=all`

**Response:**
```json
{
  "summary": {
    "totalOpen": 12,
    "fullmindRelevant": 5,
    "byCategory": { "SPED": 3, "ELL": 2, "General Ed": 5, "Admin": 2 },
    "lastScannedAt": "2026-03-15T..."
  },
  "vacancies": [
    {
      "id": "...",
      "title": "Special Education Teacher",
      "category": "SPED",
      "status": "open",
      "schoolName": "Lincoln Elementary",
      "school": { "ncessch": "...", "name": "Lincoln Elementary School" },
      "hiringManager": "Jane Doe",
      "hiringEmail": "jdoe@district.edu",
      "contact": { "id": 42, "name": "Jane Doe" },
      "startDate": "2026-08-15",
      "datePosted": "2026-02-28T...",
      "daysOpen": 17,
      "fullmindRelevant": true,
      "relevanceReason": "SPED staffing",
      "sourceUrl": "https://..."
    }
  ]
}
```

## Background Processing

The vacancy scanner runs as a TypeScript background worker within the Next.js application. Since the app deploys on Railway (not serverless Vercel), we can run long-lived processes.

### Execution model

The API route creates `VacancyScan` rows and kicks off processing using `p-queue` in the same process. The queue persists in memory for the lifetime of the server. If the server restarts mid-batch, a startup recovery check finds `running` scans older than 10 minutes and marks them `failed` (they can be retried manually).

### Single scan flow

1. API route creates `VacancyScan` row (status: `pending`)
2. Worker picks up the job, sets status to `running`
3. Detects platform, runs appropriate parser or Claude fallback
4. Post-processes results (filter, categorize, match, upsert)
5. Updates `VacancyScan` with counts, sets status to `completed` (or `failed` with error)

### Bulk scan flow

1. API route creates `VacancyScan` rows for all districts with `jobBoardUrl` in the territory plan
2. All share the same `batchId`
3. Worker processes with concurrency limit (5 concurrent scans) using `p-queue`
4. Frontend polls `GET /api/vacancies/batch/[batchId]` for progress
5. Each district completes independently

### Timeouts

- Per-district scan timeout: 60 seconds (covers page load + Claude API call)
- Stale scan recovery: on server startup, mark any `running` scans older than 10 minutes as `failed`

### Concurrency and rate limiting

- Max 5 concurrent scans to avoid overwhelming external sites
- Per-domain rate limit (max 2 concurrent requests to same job board platform)
- Claude API calls rate-limited per Anthropic tier limits
- Failed scans retry once, then mark as failed

## Entity Linking

### School Matching

1. Normalize both strings: lowercase, strip common suffixes ("school", "elementary", "middle", "high", "es", "ms", "hs", "academy")
2. Exact match on normalized name
3. Fuzzy match: Dice coefficient with threshold 0.8
4. Set `schoolNcessch` on Vacancy if matched
5. Store raw `schoolName` regardless (useful even without match)

### Contact Matching

1. Email-only matching: if `hiringEmail` is present, exact match against contacts for that `leaid`
2. Set `contactId` if matched
3. No auto-creation of contacts from scraped data
4. No name-based matching (too many false positives)

## Deduplication

### Fingerprint strategy

Fingerprint = hash of `leaid + normalize(title) + normalize(schoolName || "")`

Normalization: lowercase, trim, collapse whitespace.

### Upsert behavior

- **New fingerprint:** Insert vacancy, set `firstSeenAt` and `lastSeenAt` to now
- **Existing fingerprint (open):** Update `lastSeenAt`, update `scanId` to latest scan, update any changed fields (startDate, hiringManager, etc.)
- **Existing fingerprint (closed):** Reopen — set status back to `"open"`, update `lastSeenAt`
- **Not seen in scan:** Mark as `"closed"` — vacancy no longer appears on job board (subject to partial-scrape safety check described in post-processor step 8)

## UI Surfaces

### 1. District Panel — Vacancies Section

Located in the district side panel (near StaffingCard). Shows:

- **Summary line:** "12 open positions (5 Fullmind-relevant) — Last scanned Mar 15"
- **Vacancy list** grouped by category, Fullmind-relevant highlighted with accent color
- Each vacancy: title, school (linked to school detail if matched), hiring contact (linked if matched), start date, "Posted 12 days ago"
- **"Scan Now" button** for single-district refresh
- **Loading state** while scan is running

### 2. District Explore Modal — Vacancies Tab/Section

Same data as district panel, adapted to modal layout. Summary + list.

### 3. Territory Plan — Bulk Scan

- **"Scan Vacancies" button** on the territory plan view
- **Progress bar/indicator** during bulk scan: "Scanning... 12/47 districts complete"
- **Completion summary:** "Found 234 vacancies across 47 districts, 67 Fullmind-relevant"
- Optionally: sort/filter territory plan districts by vacancy count or Fullmind-relevant count after scan

### 4. Admin Panel

- **Service line keywords:** CRUD for relevance rules (label, service line, keywords)
- **Exclusion keywords:** CRUD for role exclusion rules (label, keywords)
- **Scan history:** Table of recent scans with status, counts, errors

## Configuration

### Environment Variables

```
ANTHROPIC_API_KEY=...        # For Claude fallback scraping (@anthropic-ai/sdk)
```

### Dependencies (new)

```
@anthropic-ai/sdk            # Claude API for fallback scraping
playwright                   # Headless browser for JS-rendered job boards
p-queue                      # Concurrency-limited async queue
dice-coefficient             # String similarity for school name matching (or implement inline)
```

### Vacancy categories (closed set)

Used for `Vacancy.category` and UI grouping:

`SPED` | `ELL` | `General Ed` | `Admin` | `Specialist` | `Counseling` | `Related Services` | `Other`

### Admin-Configurable

- Fullmind service line → keyword mappings (VacancyKeywordConfig type=relevance)
- Role exclusion keywords (VacancyKeywordConfig type=exclusion)

## Future Considerations (not in scope)

- Scheduled automatic re-scans (weekly)
- Explore table vacancy columns
- Vacancy-based alerts ("new SPED posting in your territory")
- Vacancy trends dashboard
- Integration with CRM pipeline stage recommendations
