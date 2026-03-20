# Context Library System

**Date:** 2026-03-20
**Status:** Draft

---

## Overview

A three-file context library that orients Claude agents, the primary developer, and non-technical contributors to the Territory Plan Builder codebase. Eliminates blind exploration by giving agents a structured map of the project before they start searching.

### Problem

The codebase is ~111K lines across 585 files. Agents waste tokens exploring blindly because there's no CLAUDE.md or architecture reference. The `/new-feature` pipeline's discovery skills (`backend-discovery`, `frontend-design`) re-discover project conventions every time. Non-technical contributors don't know how to prompt effectively.

### Solution

Three layered documents plus updates to existing skills:

1. **`CLAUDE.md`** (~100 lines) — always loaded into agent context. Project identity, conventions, guardrails, pointers to deeper docs.
2. **`docs/architecture.md`** (~250 lines) — on-demand deep reference. Feature map, entry points, key patterns, metrics, cross-feature dependencies.
3. **`docs/prompting-guide.md`** (~200 lines) — human-friendly guide for non-technical contributors with task-based prompt templates and real examples.

Plus: updates to all 5 existing skills to reference these docs, a context maintenance step in the `/new-feature` pipeline, and cleanup of stale references in TECHSTACK.md.

---

## Deliverable 1: `CLAUDE.md`

**Location:** Project root
**Audience:** Agents (always in context)
**Size:** ~100 lines

### Content

```markdown
# Territory Plan Builder

EdTech territory planning tool for Fullmind sales teams. Next.js 16 App Router,
React 19, TypeScript, Tailwind 4, Prisma/PostgreSQL+PostGIS, MapLibre, Zustand,
TanStack Query. Vitest for testing.

## Before You Start

- Read `docs/architecture.md` before any exploration or multi-file changes
- Read `Documentation/UI Framework/tokens.md` before any frontend work
- Run `npm run dev` on port 3005, `npm test` for Vitest

## Project Conventions

### File Organization
- Features live in `src/features/{name}/` with `components/`, `lib/`, and optional `hooks/`
- Queries/hooks: `src/features/{name}/lib/queries.ts` (TanStack Query hooks)
- API routes: `src/app/api/{resource}/route.ts` (Next.js App Router)
- Shared components: `src/features/shared/components/`
- Shared utilities: `src/features/shared/lib/`
- Global state: `src/features/map/lib/store.ts` (Zustand) — 1400 lines, read selectively

### Database
- Prisma ORM: `prisma/schema.prisma`, client at `src/lib/prisma.ts`
- Raw SQL (geospatial): `src/lib/db.ts` (pg Pool)
- Districts keyed by `leaid` (string), plans by `id` (int)

### Styling
- Fullmind brand — use tokens from `Documentation/UI Framework/tokens.md`
- Never use Tailwind grays — use plum-derived neutrals (#F7F5FA, #EFEDF5)
- Icons: Lucide only, `currentColor`, semantic sizing

### Testing
- Vitest + Testing Library + jsdom
- Tests co-located in `__tests__/` directories next to source

## Large Files — Read Selectively
- `src/features/map/lib/store.ts` (1400 lines) — Zustand store, grep for specific slices
- `src/features/map/lib/layers.ts` (688 lines) — MapLibre layer configs
- `prisma/schema.prisma` — full DB schema, grep for specific models

## Skills Available
- `/new-feature` — full feature pipeline (discovery -> design -> implement -> ship)
- `/backend-discovery` — explore backend architecture before implementation
- `/design-explore` — create Paper prototypes for design exploration
- `/design-review` — post-implementation design QA audit
- `/frontend-design` — build UI with Fullmind brand compliance

## Documentation
- `Documentation/UI Framework/` — 80+ component/pattern specs (the design system)
- `Documentation/.md Files/TECHSTACK.md` — full tech stack reference
- `Documentation/.md Files/data-model.md` — database schema details
- `docs/architecture.md` — feature map and codebase navigation guide
- `docs/prompting-guide.md` — guide for non-technical contributors
```

---

## Deliverable 2: `docs/architecture.md`

**Location:** `docs/architecture.md`
**Audience:** Agents (read on demand before multi-file work)
**Size:** ~250 lines

### Content

```markdown
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
| `admin` | Admin tools (unmatched accounts, ICP scoring) | `components/` |
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
        +-- store.ts        <- Zustand store (1400 lines - grep, don't read whole)
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
```

---

## Deliverable 3: `docs/prompting-guide.md`

**Location:** `docs/prompting-guide.md`
**Audience:** Non-technical contributors
**Size:** ~200 lines

### Content

```markdown
# How to Work with Claude on This Codebase

A guide for getting good results when asking Claude to make changes
to the Territory Plan Builder. You don't need to know how to code —
just how to describe what you want clearly.

## Quick Start

1. Open Claude Code in the `territory-plan` directory
2. Describe what you want in plain language
3. Claude will figure out where to make changes

The more specific you are about WHAT you want (not WHERE in the code),
the better results you'll get.

## Examples

### Building a New Feature

> I want to add a "win/loss reason" tracker to plans. When a sales rep
> closes a deal (won or lost), they should be able to select a reason
> from a dropdown — things like "price", "competitor", "timing",
> "relationship". I want to see these aggregated on the progress
> dashboard (where the Leading and Lagging Indicators are) so we can
> spot trends across the team.

Why this works: it describes the user-facing behavior (dropdown on
close), the data it captures (reason categories), and where the
output should appear (the progress dashboard — Claude knows this
means `src/features/progress/`). Claude will ask follow-up questions
about the specific reason categories, whether reasons differ for
wins vs losses, etc.

Start this kind of request with `/new-feature` so Claude walks you
through design before building.

### Improving an Existing Feature

> In the district detail panel (the sidebar that opens when you click
> a district on the map), enrollment is shown as just a number. I'd
> like it to also show year-over-year change — something like
> "12,450 (+3.2%)" — so I can quickly see if a district is growing or
> shrinking. The enrollment data from prior years is already in the
> districts table.

Why this works: it identifies the exact UI location (district detail
panel — Claude knows this is in
`src/features/map/components/panels/district/`), what exists now
("just a number"), what should change ("year-over-year"), gives a
visual example of the format, and confirms the data source (the
`districts` table). Claude can go straight to the right component
without guessing.

### Fixing a Bug

> When I open the explore grid (the spreadsheet overlay on the map)
> and sort by Pipeline descending, districts with no pipeline show up
> at the top instead of the bottom. They should be sorted to the
> bottom — nulls last. This happens for the Bookings and Invoicing
> columns too.

Why this works: it describes the exact steps to reproduce (open
explore grid, sort by Pipeline descending), what goes wrong (nulls
at top), what should happen instead (nulls at bottom), and uses
the actual metric names (Pipeline, Bookings, Invoicing) that appear
in the summary bar and explore grid. Claude can find the sorting
logic and fix all three at once.

### Exploring a New Idea

> I've been thinking about adding an "ICP score" (ideal customer
> profile) to each district — a number from 0-100 that combines
> enrollment size, expenditure per pupil, FY26 open pipeline, and
> geographic proximity to existing customers (is_customer districts).
> I don't want to build it yet — I want to brainstorm what factors
> should go into the score and how we'd weight them. Can you look
> at what data we already have on the districts table that could
> feed into this?

Why this works: it clearly separates exploration from implementation
("I don't want to build it yet"), uses actual field names the user
has seen in the app (enrollment, expenditure per pupil, FY26 open
pipeline, is_customer), and asks Claude to ground the brainstorm in
the real schema. Claude will read `prisma/schema.prisma`, identify
available fields, and help think through the scoring model.

### Querying the Database for Information

> Can you write me a SQL query that shows the top 20 districts by
> fy26_open_pipeline value, but only districts in Texas
> (state_abbrev = 'TX') that aren't already customers
> (is_customer = false)? I want to see name, enrollment,
> fy26_open_pipeline, and sales_executive.

Why this works: it specifies exact column names from the districts
table, filters, sort order, and fiscal year. Claude knows the Prisma
schema and can write a query that runs directly against PostgreSQL.
You can also ask broader questions like "how many districts assigned
to Sarah have no activities logged this quarter?" and Claude will
figure out the right tables and joins (districts -> district_edits
for ownership, activities for activity logging).

**Note:** Claude can write and explain queries but won't run them
against your database unless you explicitly ask. It's safe to ask
for query drafts to run yourself.

## Prompt Templates by Task

### "I want to change how something looks"
> "Change the district detail panel so the enrollment number is bigger
>  and more prominent"
>
> "Make the pipeline column in the explore grid show red when the value
>  is zero"
>
> "Add a border between the sections in the plan detail view"

**Tips:** Describe what you see now, what's wrong, and what you want
instead. Use the words you'd use to describe it to a coworker —
"the sidebar", "the map", "the data table", "the plan card".

### "I want to add something new"
> "Add a notes field to the plan detail view where I can type free-form
>  notes about the plan"
>
> "I want to see a chart showing pipeline by state in the progress
>  dashboard"

**Tips:** For anything bigger than a small change, say `/new-feature`
first — Claude will walk you through a structured process to design
it before building it.

### "Something is broken"
> "When I click on a district in California, the panel shows the wrong
>  enrollment number"
>
> "The summary bar at the top of the map shows $0 for pipeline even
>  though I can see districts with pipeline on the map"

**Tips:** Describe what you expected, what happened instead, and any
specific data that looks wrong. Include the district name or state
if relevant.

### "I want to understand something"
> "How does the choropleth coloring work? What determines which
>  districts are dark vs light?"
>
> "Where does the pipeline number come from for each district?"
>
> "What happens when a user connects their Google Calendar?"

### "I want to change data or metrics"
> "Add FY27 bookings columns to the explore grid"
>
> "The sessions revenue for FY26 should include the new product line —
>  where would I add that?"

## What Makes a Good Prompt

**Be specific about the outcome:**
- Bad: "Fix the plans page"
- Good: "On the plans page, the plan cards are overlapping on mobile"

**Name what you see, not code terms:**
- Bad: "Update the PlanViewPanel component"
- Good: "In the plan detail view (the panel that opens when you click
   a plan), change the header to show the plan name in bold"

**Give context when something is ambiguous:**
- Bad: "Change the table"
- Good: "In the explore data grid (the spreadsheet view that opens
   over the map), add a column for total revenue"

## Key Terms

| What you might call it | What it is in the app |
|----------------------|----------------------|
| The map | The main view with colored districts |
| The sidebar / panel | The panel that slides in from the left |
| The data grid / spreadsheet | The explore overlay with sortable columns |
| The summary bar | The metrics bar at the top of the map |
| District detail | The panel showing info about one district |
| Plan view | The detail view for a territory plan |
| The filter bar | The search/filter controls above the map |
| Progress dashboard | The charts showing activity and outcome metrics |

## Available Commands

| Command | When to use it |
|---------|---------------|
| `/new-feature` | Building something new (walks you through design first) |
| `/design-review` | Check if a built feature matches the design system |
| `/backend-discovery` | Understand the database before making data changes |

## Things to Know

- Claude reads your project files to understand the code. It may take
  a moment on the first request.
- For big changes, Claude will ask you clarifying questions before
  starting. This is normal and leads to better results.
- If Claude's change isn't quite right, just tell it what's wrong in
  plain language — "that's too big", "wrong color", "I meant the
  other table".
- You can ask Claude to undo its last change if something went wrong.
```

---

## Deliverable 4: `Documentation/.md Files/TECHSTACK.md` Updates

### Remove
- Lines 39-48: "Store Structure" subsection (documented better in `docs/architecture.md` with selective-read guidance)
- Lines 209-258: "Project Structure" tree (replaced by `docs/architecture.md` which is more detailed and maintained)

### Add
After the "Core Framework" table (line 12), add:

```markdown
> For project structure and codebase navigation, see `docs/architecture.md`.
```

---

## Deliverable 5: Skill Updates

### 5a. `backend-discovery` SKILL.md

**Add** after the "Inputs" section (line 19), before "Process":

```markdown
## Context Bootstrapping

Before exploring, read these for a warm start:
- `docs/architecture.md` — feature map, entry points, cross-feature dependencies
- `docs/architecture.md` § "Key Metrics" — Fullmind's sales funnel metrics and how they map to DB columns
- `Documentation/.md Files/TECHSTACK.md` § "Database" and "API Layer" — schema overview, connection patterns, route structure

This gives you the project's conventions before you grep. Your job is to discover **feature-specific** context that these general docs don't cover.
```

**Replace** step 1 (lines 23-32) with:

```markdown
### 1. Explore Data Models

Schema is at `prisma/schema.prisma`. Prisma client at `src/lib/prisma.ts`,
raw SQL pool at `src/lib/db.ts`. Grep the schema for models relevant to
the feature — don't read the whole file.

For each relevant model, document: name, key fields, relationships, and any custom types or enums.
```

### 5b. `design-explore` SKILL.md

**Add** after "Inputs" section (line 22), before "Process":

```markdown
## Context Bootstrapping

Before prototyping, read:
- `docs/architecture.md` — understand where this feature fits in the app, what panels/pages exist, cross-feature dependencies
- `docs/architecture.md` § "Key Metrics" — if the feature involves financial data, understand the sales funnel and metric names

This prevents proposing layouts that conflict with the existing app structure.
```

### 5c. `design-review` SKILL.md

**Add** after "Inputs" section (line 23), before "Process":

```markdown
## Context Bootstrapping

Before auditing, read:
- `docs/architecture.md` § "Key Patterns" — understand where shared components live so you can check for reuse violations
- `docs/architecture.md` § "Shared Components" — exact paths to DataGrid, filters, format utilities
```

### 5d. `frontend-design` SKILL.md

**Replace** Step 2 (lines 43-50) with:

```markdown
### Step 2 — Check existing components

Before creating anything new, search for what already exists. Read
`docs/architecture.md` § "Shared Components" for the full inventory, then:

- `src/features/shared/components/` — shared feature components (DataGrid, InlineEditCell, filters, layout, navigation)
- `src/features/shared/lib/` — shared utilities (format.ts, cn.ts, date-utils.ts)
- `src/features/*/components/` — feature-specific components

Use Glob and Grep to find existing implementations. Reuse and extend before creating.
```

### 5e. `new-feature` SKILL.md

**Add** to Stage 1, before "1a. Requirements gathering" (line 51):

```markdown
**Context bootstrapping:**

Read `docs/architecture.md` before starting discovery. This gives you:
- The feature map (so you know what exists and where things live)
- Key patterns (data fetching, state management, shared components)
- Key metrics (so you understand the business domain)
- Cross-feature dependencies (so you know what your feature touches)

This replaces blind exploration — start from the map, then drill into
specifics for the feature being built.
```

**Add** new step between Stage 8b and 8c — context maintenance:

```markdown
**8b-1/2. Context documentation:**

After implementation is verified (tests pass, build clean), check whether
the changes require updates to context documentation:

**Check `docs/architecture.md`:**
- New feature directory created? -> Add to the Feature Directory Map table
- New shared component created? -> Add to the Shared Components section
- New cross-feature dependency introduced? -> Update Cross-Feature Dependencies
- New metrics or financial fields added? -> Update Key Metrics section

**Check `Documentation/.md Files/TECHSTACK.md`:**
- New API routes added? -> Add to the API Route Structure section
- New database tables/models? -> Update the Database Schema Overview tree
- New external integration? -> Add to the relevant technology table
- New environment variables required? -> Add to the Environment Variables section

**Check `CLAUDE.md`:**
- Usually no changes needed — it references architecture.md and TECHSTACK.md
  for details. Only update if a new skill was created or a core convention changed.

**Check `docs/prompting-guide.md`:**
- New major feature that users would want to prompt about? -> Add an entry
  to the Key Terms table mapping user language to the new feature

**How to check:** Diff the worktree branch against main to see what was
created. Grep the diff for:
- New directories under `src/features/`
- New files under `src/app/api/`
- New models in `prisma/schema.prisma`
- New exports from `src/features/shared/`

Only update docs that are affected. Don't touch docs for unrelated sections.
Commit context doc updates as a separate commit from the feature code.
```

---

## Implementation Order

1. Create `CLAUDE.md` (project root)
2. Create `docs/architecture.md`
3. Create `docs/prompting-guide.md`
4. Update `Documentation/.md Files/TECHSTACK.md` (remove stale sections, add pointer)
5. Update `backend-discovery` SKILL.md
6. Update `design-explore` SKILL.md
7. Update `design-review` SKILL.md
8. Update `frontend-design` SKILL.md
9. Update `new-feature` SKILL.md

Steps 1-3 are independent. Steps 5-9 are independent of each other but depend on 1-3 existing (since they reference the new files).

---

## Out of Scope

- No code changes (no .ts/.tsx modifications)
- No new skills
- No changes to existing Documentation/UI Framework/ docs
- No changes to Paper artboards or Figma
- No database changes
