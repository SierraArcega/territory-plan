# Architecture Guide

Read this before exploring the codebase or making multi-file changes.

## Feature Directory Map

Each feature follows the pattern `src/features/{name}/`:
- `components/` — React components
- `lib/` — queries (TanStack Query hooks), utilities, types
- `hooks/` — custom React hooks (optional)

| Feature | Purpose | Entry Point(s) |
|---------|---------|----------------|
| `map` | Main map view — choropleth, panels, search, explore | `components/MapV2Shell.tsx` -> `MapV2Container.tsx` |
| `plans` | Territory plan CRUD and views | `components/` + `lib/queries.ts` |
| `districts` | District data, detail panels | `lib/queries.ts` |
| `activities` | Sales activity logging | `components/` + `lib/queries.ts` |
| `tasks` | Follow-up task board | `components/` + `lib/queries.ts` |
| `calendar` | Google Calendar sync | `components/` + `lib/queries.ts` |
| `progress` | Leading/lagging indicator dashboards | `components/` + `lib/queries.ts` |
| `goals` | Revenue/pipeline goal tracking | `components/` + `lib/queries.ts` |
| `explore` | Data grid overlay for map | `lib/queries.ts` |
| `integrations` | External system connections | `components/` + `lib/queries.ts` |
| `home` | Home dashboard — feed, plan cards, profile sidebar | `components/HomeView.tsx` |
| `vacancies` | Vacancy scanning and tracking | `components/` + `lib/` |
| `mixmax` | Mixmax campaign integration | `components/CampaignStatsPanel.tsx` |
| `admin` | Admin tools (unmatched accounts, ICP scoring) | `components/` |
| `news` | K-12 news ingest + entity matching (RSS + Google News + LLM disambiguator) — backend only; UI pending | `lib/ingest.ts`, `lib/matcher.ts` |
| `rfps` | K-12 RFP ingest from HigherGov SLED API + name-based district resolution — backend only; UI pending | `lib/sync.ts`, `lib/highergov-client.ts`, `lib/district-resolver.ts` |
| `reports` | AI-driven query builder — chat-as-timeline, saved-report library, SSE streaming live trace | `components/ReportsTab.tsx` -> `ReportsLibrary.tsx` \| `builder/ReportsBuilder.tsx` |
| `shared` | Cross-feature components, hooks, utilities | `components/`, `lib/`, `hooks/` |

### The `map` Feature (Largest)

The map feature is the app's core and has the deepest nesting:

    src/features/map/
    +-- components/
    |   +-- MapV2Shell.tsx          <- Page-level shell
    |   +-- MapV2Container.tsx      <- Map + panel orchestration
    |   +-- PanelContent.tsx        <- Left panel router
    |   +-- RightPanel.tsx          <- Right panel (forms)
    |   +-- panels/
    |   |   +-- HomePanel.tsx       <- Default panel (plan list)
    |   |   +-- PlansListPanel.tsx  <- Plan browser
    |   |   +-- PlanViewPanel.tsx   <- Single plan detail
    |   |   +-- PlanWorkspace.tsx   <- Plan editing workspace
    |   |   +-- SelectionListPanel.tsx <- Multi-select results
    |   |   +-- district/           <- District detail panel
    |   |       +-- DistrictDetailPanel.tsx  <- Container/entry point
    |   |       +-- DistrictHeader.tsx
    |   |       +-- DistrictInfoTab.tsx
    |   |       +-- DataDemographicsTab.tsx
    |   |       +-- tabs/PlanningTab.tsx
    |   |       +-- tabs/SignalsTab.tsx
    |   |       +-- tabs/SchoolsTab.tsx
    |   +-- SearchBar/              <- Filter dropdowns
    |   +-- SearchResults/          <- Results list + detail modals
    |   +-- explore/                <- Data grid overlay
    |   +-- right-panels/           <- Activity/task/plan edit forms
    +-- hooks/
    +-- lib/
        +-- store.ts        <- Zustand store (~1400 lines - grep, don't read whole)
        +-- layers.ts       <- MapLibre layer configs (688 lines - grep, don't read whole)
        +-- queries.ts      <- Map-specific TanStack Query hooks
        +-- palettes.ts     <- Color palettes for vendors/categories
        +-- useMapSummary.ts <- Summary bar metric computation

## Key Patterns

### Data Fetching
- **TanStack Query hooks** in `features/{name}/lib/queries.ts`
- Hooks follow pattern: `use{Entity}Query`, `use{Action}Mutation`
- API calls go to Next.js route handlers in `src/app/api/`

### State Management
- **Zustand** for client-side UI state (`src/features/map/lib/store.ts`)
- **TanStack Query** for server state (caching, refetching)
- Access store via `useMapV2Store(selector)` — always use selectors

### Shared Components
- `src/features/shared/components/layout/` — page shells, nav
- `src/features/shared/components/navigation/` — breadcrumbs, tabs
- `src/features/shared/components/filters/` — filter controls
- `src/features/shared/components/views/` — reusable view patterns
- `src/features/shared/components/DataGrid/` — configurable data grid
- `src/features/shared/lib/format.ts` — currency, number, date formatting
- `src/features/shared/lib/cn.ts` — Tailwind class merging (clsx + tailwind-merge)

### Cross-Feature Dependencies
- Map panels import from `plans`, `districts`, `activities`, `tasks` queries
- `shared` is imported by everything — never import from `shared` into `shared`
- `explore` queries feed into `map/components/explore/` overlay
- `progress` reads from `activities` and `plans` data
- `reports` runs against the readonly Postgres pool (`@/lib/db-readonly`) for
  user-facing queries; agent metadata (`@/lib/district-column-metadata`) seeds
  the system prompt with table descriptions

### The `reports` Feature

URL state lives under the `reports` tab in `src/app/page.tsx`:
- `?tab=reports` → library home (Mine / Starred / Team)
- `?tab=reports&view=builder` → builder shell
- `?tab=reports&view=builder&report=<id>` → loaded from saved report
- `?tab=reports&view=builder&report=<id>&v=<n>` → with version selected

```
src/features/reports/
+-- components/
|   +-- ReportsTab.tsx                 <- Tab entry; routes between library/builder
|   +-- ReportsLibrary.tsx             <- Welcome strip + tabs + list
|   +-- ResultsTable.tsx               <- Shared table renderer
|   +-- SqlPreviewModal.tsx            <- View-SQL modal
|   +-- library/                       <- /reports library page
|   |   +-- WelcomeStrip.tsx
|   |   +-- LibraryTabs.tsx
|   |   +-- LibraryList.tsx + LibraryRow.tsx
|   |   +-- EmptyLibrary.tsx + LibrarySkeleton.tsx
|   +-- builder/                       <- /reports/new builder
|       +-- ReportsBuilder.tsx         <- Top-level orchestrator (turns, conv id)
|       +-- BuilderChat.tsx            <- Chat-as-timeline column
|       +-- TurnBlock.tsx              <- Gutter pill + user msg + assistant card
|       +-- VersionPill.tsx + JumpNav.tsx
|       +-- LiveTrace.tsx + TraceLine.tsx  <- Style B Terminal trace renderer
|       +-- Composer.tsx               <- Input + send + helper text
|       +-- ResultsPane.tsx            <- Header + ChipStrip + table + Save
|       +-- ChipStrip.tsx              <- Display-only filter/column/sort chips
|       +-- SaveButton.tsx + SavePopover.tsx
|       +-- CollapsedChatRail.tsx      <- 44px slim rail when chat collapsed
+-- hooks/
|   +-- useChatTurn.ts                 <- Non-streaming mutation (legacy)
|   +-- useChatTurnStream.ts           <- SSE-streaming submit + isPending
+-- lib/
|   +-- queries.ts                     <- TanStack Query hooks for the new API
|   +-- agent/
|   |   +-- agent-loop.ts              <- The Claude agent loop
|   |   +-- types.ts                   <- TurnEvent, QuerySummary
|   |   +-- system-prompt.ts
|   |   +-- tool-definitions.ts        <- run_sql + the explorers
|   |   +-- conversation.ts            <- queryLog persistence
|   +-- tools/                         <- One handler per Claude tool
|   +-- csv.ts + format-cell.ts
|   +-- use-chat-collapsed.ts          <- localStorage hook
+-- API routes (under src/app/api/reports/ and src/app/api/ai/query/)
```

## Key Metrics (Fullmind Business Model)

Fullmind tracks financial metrics per district, per fiscal year. These appear in
the map summary bar, choropleth coloring, explore grid, and goal tracking.

### Sales Funnel Metrics (per district, per FY)
| Metric | DB Column(s) | Description |
|--------|-------------|-------------|
| Pipeline | `fy{XX}_open_pipeline`, `_weighted`, `_opp_count` | Open opportunities not yet closed |
| Bookings | `fy{XX}_closed_won_net_booking`, `_opp_count` | Closed-won deal value |
| Invoicing | `fy{XX}_net_invoicing` | Invoiced amounts |
| Sessions Revenue | `fy{XX}_sessions_revenue` | Revenue from delivered sessions |
| Sessions Take | `fy{XX}_sessions_take` | Fullmind's margin on sessions |

### Vendor Financial Metrics (normalized across vendors)
Stored in `VendorFinancials` table — same metrics for Fullmind + competitors:
`open_pipeline`, `closed_won_bookings`, `invoicing`, `scheduled_revenue`,
`delivered_revenue`, `deferred_revenue`, `total_revenue`, `delivered_take`,
`scheduled_take`

### Summary Bar Metrics (MetricId type)
The map summary bar shows aggregated metrics for visible districts:
`districts` | `enrollment` | `pipeline` | `bookings` | `invoicing` |
`scheduledRevenue` | `deliveredRevenue` | `deferredRevenue` | `totalRevenue` |
`deliveredTake` | `scheduledTake` | `allTake`

Defined in `src/features/map/lib/store.ts` -> `ALL_METRIC_IDS`
Rendered by `src/features/map/components/MapSummaryBar.tsx`

### District Education Data
From Urban Institute API, stored on `districts` table:
- Finance: `total_revenue`, `federal/state/local_revenue`, `expenditure_per_pupil`
- Demographics: enrollment by race/ethnicity, FRPL rate, ELL/SPED counts
- Academics: graduation rates, assessment proficiency
- Staffing: teacher/staff counts, pupil-teacher ratio

## API Route Patterns

Routes live in `src/app/api/{resource}/route.ts`:
- Export named functions: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- Auth via Supabase (`@supabase/ssr`)
- Response format: `NextResponse.json(data)` or `NextResponse.json({ error }, { status })`
- See `Documentation/.md Files/TECHSTACK.md` section "API Layer" for full route list
