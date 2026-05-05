# Territory Plan Builder - Tech Stack

A comprehensive reference for the technologies, frameworks, and architecture patterns used in this application.

## Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.1.6 | React framework with App Router, API routes, SSR |
| **React** | 19.2.3 | UI component library |
| **TypeScript** | 5.x | Type-safe JavaScript |

> For project structure and codebase navigation, see `docs/architecture.md`.

## Styling

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tailwind CSS** | 4.x | Utility-first CSS framework |
| **PostCSS** | — | CSS processing |
| **Plus Jakarta Sans** | — | Brand font (Google Fonts) |

### Brand Colors (Fullmind)

```css
--color-coral: #F37167      /* Primary accent, buttons */
--color-plum: #403770       /* Primary text, headers */
--color-steel-blue: #6EA3BE /* Accents, dashed lines */
--color-robins-egg: #C4E7E6 /* Backgrounds, cards */
--color-mint: #EDFFE3       /* Light backgrounds */
--color-off-white: #FFFCFA  /* Page backgrounds */
```

## State Management

| Technology | Version | Purpose |
|------------|---------|---------|
| **Zustand** | 5.0.10 | Lightweight global state (map state, filters, UI) |
| **TanStack Query** | 5.90.20 | Server state, caching, data fetching |

## Database

| Technology | Version | Purpose |
|------------|---------|---------|
| **PostgreSQL** | — | Primary database |
| **PostGIS** | — | Geospatial extension for boundaries |
| **Prisma** | 5.22.0 | ORM and schema management |
| **pg** | 8.17.2 | Direct PostgreSQL client (for raw queries) |

### Database Schema Overview

```
districts                    — Core district data (~13,000 records)
├── fullmind_data           — Sales/pipeline metrics by fiscal year
├── district_edits          — User notes and ownership
├── district_tags           — Many-to-many tag assignments
├── district_education_data — Finance, graduation, staffing
├── district_enrollment_demographics — Enrollment by race/ethnicity
└── contacts                — District contact information

territory_plans             — Saved territory plans
└── territory_plan_districts — Districts in each plan

activities                  — Sales activities (meetings, outreach, events)
├── activity_plans          — Activity-to-plan links
├── activity_districts      — Activity-to-district links
├── activity_contacts       — Activity-to-contact links
└── activity_states         — Activity-to-state links

tasks                       — Follow-up tasks (kanban board)
├── task_plans              — Task-to-plan links
├── task_districts          — Task-to-district links
├── task_activities         — Task-to-activity links
└── task_contacts           — Task-to-contact links

calendar_connections        — Google Calendar OAuth tokens per user
calendar_events             — Staged calendar events (inbox before confirmation)

tags                        — Tag definitions (name, color)
unmatched_accounts          — Accounts without district match
data_refresh_logs           — ETL audit trail

rfps                        — K-12 RFPs ingested from HigherGov SLED API
└── (linked to districts via leaid)
rfp_ingest_runs             — Audit log for each HigherGov ingest run
```

### Connection Patterns

- **Prisma Client** (`src/lib/prisma.ts`) — For ORM queries
- **pg Pool** (`src/lib/db.ts`) — For raw SQL, especially geospatial queries

## Mapping

| Technology | Version | Purpose |
|------------|---------|---------|
| **MapLibre GL JS** | 5.17.0 | Open-source vector map rendering |

### Map Data Sources

- **District Boundaries** — NCES EDGE Composite shapefiles (converted to vector tiles)
- **State Boundaries** — Census TIGER/Line
- **Base Map** — MapTiler or similar vector tile provider

### Map Features

- Choropleth coloring by sales metrics (revenue, pipeline, bookings)
- Click-to-select district interaction
- Hover tooltips with district summary
- Multi-select mode for batch operations
- "Find Similar Districts" highlighting
- Touch device support (tap-to-preview, tap-to-select)

## Data Visualization

| Technology | Version | Purpose |
|------------|---------|---------|
| **Recharts** | 3.7.0 | React charting library |

Used for:
- Demographics pie/bar charts
- Metrics over time
- Pipeline summary visualizations

## External Integrations

| Technology | Version | Purpose |
|------------|---------|---------|
| **googleapis** | latest | Google Calendar API client for two-way calendar sync |
| **HigherGov SLED API** | — | K-12 RFP/opportunity feed (`https://www.highergov.com/api-external/opportunity/`) |

Used for:
- Pulling calendar events for the Calendar Inbox
- Pushing activities back to Google Calendar
- OAuth token management for calendar read/write access

## API Layer

### Route Structure (`src/app/api/`)

```
/api/districts              — List/search districts
/api/districts/[leaid]      — Single district CRUD
/api/districts/[leaid]/edits — Notes and ownership
/api/districts/[leaid]/tags  — Tag management
/api/districts/similar       — Find similar districts

/api/territory-plans        — Plan CRUD
/api/territory-plans/[id]/districts — Manage districts in plans
/api/territory-plans/[id]/contacts  — Contacts on a plan (via district leaid)
/api/territory-plans/[id]/contacts/bulk-enrich — Trigger Clay enrichment
/api/territory-plans/[id]/contacts/enrich-progress — Poll enrichment state
/api/territory-plans/[id]/contact-sources — Other plans sharing districts with existing contacts

/api/tiles/[z]/[x]/[y]      — Vector tile server
/api/metrics/quantiles      — Choropleth breakpoints
/api/states                 — State list
/api/sales-executives       — Sales exec dropdown
/api/tags                   — Global tag list
/api/contacts               — Contact management
/api/unmatched              — Unmatched accounts
/api/customer-dots          — Customer location markers

/api/calendar/connect       — Initiate Google Calendar OAuth
/api/calendar/callback      — Handle OAuth callback
/api/calendar/disconnect    — Remove calendar connection
/api/calendar/status        — Check connection status + settings
/api/calendar/sync          — Trigger calendar sync
/api/calendar/events        — List staged calendar events (inbox)
/api/calendar/events/[id]   — Confirm/dismiss a calendar event
/api/calendar/events/batch-confirm — Bulk-confirm high-confidence events
/api/calendar/backfill/start    — Start first-time backfill with user-chosen window (7/30/60/90 days)
/api/calendar/backfill/complete — Mark backfill logging exercise as finished

/api/progress/activities    — Activity metrics (counts, trends, coverage)
/api/progress/outcomes      — Outcome metrics (funnel, distribution)
/api/progress/plans         — Plan engagement metrics

/api/rfps                   — List RFPs (filter by leaid/stateFips/state/q, cursor pagination)
/api/cron/ingest-rfps       — Daily HigherGov RFP ingest cron (08:15 UTC)
```

## Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| **Vitest** | 2.1.8 | Test runner (Vite-native) |
| **Testing Library** | 16.1.0 | React component testing |
| **jsdom** | 26.0.0 | DOM environment for tests |

### Test Commands

```bash
npm test              # Run tests
npm run test:ui       # Interactive UI
npm run test:coverage # Coverage report
```

## External Data APIs

### Urban Institute Education Data Portal

Base URL: `https://educationdata.urban.org/api/v1/`

Used for:
- District enrollment data
- Finance data (revenue, expenditure)
- Demographics
- Graduation rates
- Staffing data
- SAIPE poverty estimates

See `Docs/education-data-api.md` for full reference.

## Development

### Scripts

```bash
npm run dev      # Start dev server on port 3005
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
npm test         # Run tests
```

### Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Google Calendar integration (required for calendar sync)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3005/api/calendar/callback

# Anthropic API (required for Claude-based parsers and the news matcher)
ANTHROPIC_API_KEY=sk-ant-...
# Optional kill switch for the news LLM matcher (Pass 2 disambiguation).
# Set to "false" to short-circuit Haiku calls; ambiguous candidates stay queued.
NEWS_LLM_ENABLED=true

# Cron auth — Bearer header or ?secret= query param on /api/cron/* routes
CRON_SECRET=your-cron-secret

# NewsAPI.org (optional, not currently wired up — reserved for future enrichment
# of top-20 districts where structured imageUrl + source.id metadata is desired)
NEWS_API_KEY=...

# HigherGov RFP feed (required for /api/cron/ingest-rfps)
HIGHERGOV_API_KEY=your-highergov-api-key
HIGHERGOV_K12_SEARCH_ID=your-k12-search-id
```

### News feature

The `news` feature (added 2026-04-22) ingests K-12 news from four layers:
edu publishers via direct RSS (Chalkbeat, K-12 Dive, The 74, EdSurge), broad
Google News RSS queries, per-state queries, and a rolling per-district queue.
Articles match to districts/schools/contacts via a tiered keyword + Claude
Haiku matcher (`src/features/news/lib/matcher.ts`).

Tables: `news_articles`, `news_article_districts`, `news_article_schools`,
`news_article_contacts`, `district_news_fetch`, `news_ingest_runs`,
`news_match_queue`. See `prisma/migrations/20260422090000_add_news_tables/`.

Cron: `/api/cron/ingest-news-daily` (2am PT), `/api/cron/ingest-news-rolling`
(every 15 min; requires Vercel Pro), `/api/cron/rematch-news` (operational,
re-runs matcher over existing articles).

API: `GET /api/news` with `leaid` / `ncessch` / `contactId` / `territoryPlanId`
/ `scope=my-territory` filters; `POST /api/news/refresh/[leaid]` on-demand.

UI surfaces: not yet wired up — to be built in a follow-up PR. The backend
API is stable and ready for a frontend to consume.

## Performance Considerations

- **Map tiles** served from `/api/tiles/[z]/[x]/[y]` with PostGIS ST_AsMVT
- **Dynamic imports** for MapContainer (avoids SSR issues with MapLibre)
- **TanStack Query caching** reduces redundant API calls
- **Simplified geometries** for faster map rendering
- **Connection pooling** via pg Pool (max 20 connections)

## Deployment Notes

- App runs on port 3005 (configurable in package.json scripts)
- Requires PostgreSQL with PostGIS extension
- Database migrations via `npx prisma migrate deploy`
