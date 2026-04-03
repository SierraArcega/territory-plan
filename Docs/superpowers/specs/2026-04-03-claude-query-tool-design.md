# Claude Query Tool — Design Spec

**Date:** 2026-04-03
**Status:** Design approved
**Linear:** MAP-5
**Branch:** TBD

## Summary

Natural language query tool that lets the Fullmind sales team ask questions about their data in plain English. Claude generates SQL, validates it, executes against a read-only connection, and returns results in a sortable data table. Conversations persist so users can drill down and iterate. Reports can be saved and shared with the team.

Replaces the existing "Progress" nav item.

## Motivation

- Sales reps need ad-hoc data answers: "Which districts have the most pipeline?", "How many activities did we do in Batavia?", "Who are our contacts at districts with SPED vacancies?"
- These questions span multiple data domains (districts, financials, activities, contacts, vacancies) and require cross-table joins
- The previous report builder approach (materialized views, pre-built queries) wasn't flexible enough — every new question required code changes
- Phase 1 schema normalization makes the database joinable across all domains via `districts.leaid` as the hub

## Architecture

### System Flow

```
User asks question in chat panel
  → POST /api/ai/query { question, conversationId, history[] }
  → Load semantic schema reference (YAML)
  → Call Claude API (schema + conversation history + question → SQL)
  → Validate SQL (SELECT-only, allowed tables only, LIMIT ≤ 500)
  → Execute via read-only pg connection (5s timeout)
  → Log to query_log table
  → Return { sql, columns, rows, rowCount, insight }
  → Chat panel shows compact preview + insight
  → Main area populates with full sortable data table
```

### Components

1. **Semantic Schema Reference** (`src/features/reports/lib/schema-reference.yaml`)
   - YAML file describing every queryable table: columns, types, descriptions, relationships, join paths
   - Concept mappings: "bookings" → `vendor_financials.closed_won_bookings`, "pipeline" → `vendor_financials.open_pipeline`, etc.
   - Excluded tables: `user_profiles`, `calendar_connections`, `calendar_events`, `user_integrations`, `sync_state`
   - Excluded columns: `geometry`, `centroid`, `point_location` (binary geospatial data)
   - Documents the `school_yr` format difference: opportunities uses `"2025-26"`, vendor_financials uses `"FY26"`

2. **Query Engine** (`src/features/reports/lib/query-engine.ts`)
   - Shared module used by the API route (and later by MCP tool)
   - `generateSQL(question, history, schema)` → calls Claude API, returns SQL string
   - `validateSQL(sql)` → parse, confirm SELECT-only, check table whitelist, enforce LIMIT 500
   - `executeQuery(sql)` → run against read-only pool with 5s timeout, return typed results
   - Error recovery: if Claude generates invalid SQL, return the error to Claude with the conversation and let it retry once

3. **API Route** (`POST /api/ai/query`)
   - Authenticated (requires logged-in user via `getUser()`)
   - Request: `{ question: string, conversationId?: string, history?: { role: "user"|"assistant", content: string }[] }`
   - Conversation state is client-side: the frontend sends the full `history` array with each request. `conversationId` is only for grouping in `query_log`, not server-side state.
   - For new queries: calls `generateSQL` → `validateSQL` → `executeQuery`
   - For re-running saved reports: `POST /api/ai/query/run { sql: string }` — skips Claude, just validates and executes
   - Response: `{ sql, columns, rows, rowCount, truncated, executionTimeMs, insight? }`
   - Logs every query to `query_log`

4. **Read-Only Database Connection**
   - Separate Supabase Postgres role with SELECT-only permissions on queryable tables
   - No access to excluded tables
   - Separate pg Pool in `src/lib/db-readonly.ts` using this role's connection string
   - Environment variable: `DATABASE_READONLY_URL`

5. **Claude API Integration**
   - Uses Anthropic Messages API directly via fetch (same pattern as `claude-fallback.ts` in vacancies)
   - Model: `claude-sonnet-4-6` (fast, cost-effective for SQL generation)
   - System prompt: semantic schema reference + safety instructions + output format
   - Conversation history passed for follow-up context
   - `insight` field: Claude provides a 1-2 sentence observation about the results

## Data Model

### New Tables

**`query_log`** — records every query for analytics and monitoring
```sql
CREATE TABLE query_log (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  conversation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  sql TEXT,
  row_count INT,
  execution_time_ms INT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_query_log_user ON query_log(user_id);
CREATE INDEX idx_query_log_conversation ON query_log(conversation_id);
CREATE INDEX idx_query_log_created ON query_log(created_at DESC);
```

**`saved_reports`** — user-saved and team-pinned reports
```sql
CREATE TABLE saved_reports (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  sql TEXT NOT NULL,
  is_team_pinned BOOLEAN NOT NULL DEFAULT false,
  pinned_by UUID REFERENCES user_profiles(id),
  last_run_at TIMESTAMPTZ,
  run_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_saved_reports_user ON saved_reports(user_id);
CREATE INDEX idx_saved_reports_pinned ON saved_reports(is_team_pinned) WHERE is_team_pinned = true;
```

### Queryable Tables (all domains)

| Domain | Tables |
|---|---|
| Districts & Demographics | `districts`, `states`, `schools`, `district_data_history`, `district_grade_enrollment` |
| Financials | `vendor_financials`, `opportunities`, `sessions`, `competitor_spend` |
| Territory Plans | `territory_plans`, `territory_plan_districts`, `territory_plan_states` |
| Activities & Costs | `activities`, `activity_districts`, `activity_expenses`, `activity_contacts`, `activity_plans`, `activity_states`, `activity_attendees` |
| Contacts | `contacts`, `school_contacts` |
| Tasks | `tasks`, `task_districts`, `task_plans`, `task_contacts` |
| Vacancies | `vacancies`, `vacancy_scans` |
| Tags | `tags`, `district_tags`, `school_tags` |
| Services | `services`, `territory_plan_district_services` |

### Excluded Tables (not queryable)

`user_profiles`, `user_integrations`, `user_goals`, `calendar_connections`, `calendar_events`, `map_views`, `sync_state`, `data_refresh_logs`, `initiative_scores`, `initiative_metrics`, `initiative_tier_thresholds`, `initiatives`, `unmatched_opportunities`, `unmatched_accounts`

## UI Design

### Page Layout — Split View

Replaces "Progress" in the nav sidebar. Split-view layout:

- **Main area (~65-70%)**: Full sortable data table with report header (title, row count, execution time) and action buttons (Show SQL, Export CSV, Save Report)
- **Chat panel (~30-35%, collapsible)**: Persistent conversation thread docked to the right. Collapsible for full-width table mode.

### Tab Bar

`Chat` | `Saved Reports` | `Team Reports` | `+ New Chat` button

### Chat Panel

- User messages: dark plum bubbles, right-aligned
- Assistant responses: left-aligned text with compact result previews
- Each result preview has a "View results" button that pushes the full result to the main table area
- Scrollable — can go back to any prior result and click to view it
- Input pinned to bottom with send button
- Assistant adds 1-2 sentence insight/observation after each result
- Typing indicator while Claude generates SQL and query executes

### Main Table Area

- Report header: title (derived from question), row count, execution time, generated timestamp
- Action buttons: Show SQL (modal/expandable), Export CSV, Save Report
- Full sortable data table with sticky column headers
- Sortable by clicking column headers (client-side sort)
- Row hover highlighting
- When no result is active: show suggested query chips and recent/saved reports

### Save Report Flow

1. User clicks "Save Report" on any result
2. Modal: title field (pre-filled from question), save button
3. Report appears in "Saved Reports" tab
4. Admin can pin reports to "Team Reports" (`is_team_pinned = true`)
5. Re-running a saved report: executes stored SQL directly, no Claude API call

### Suggested Queries (empty state)

Shown when no result is active:
- "FY26 revenue by state"
- "Districts with open pipeline > $50K"
- "Activity costs by territory plan"
- "SPED vacancies in my districts"
- Recent queries from `query_log` for this user

## Safety Guardrails

1. **Read-only database role** — separate Postgres role with SELECT-only permissions. Cannot INSERT, UPDATE, DELETE, DROP, CREATE, ALTER.
2. **SQL validation** — parse generated SQL, reject anything that isn't a SELECT statement. Check for excluded tables. Reject CTEs with side effects.
3. **Row limit** — append `LIMIT 500` if no LIMIT present. Cap at 500 if higher.
4. **Query timeout** — 5-second maximum execution time on the read-only connection.
5. **Table whitelist** — semantic schema reference only documents allowed tables. SQL validation confirms no access to excluded tables.
6. **No user scoping** — all authenticated users see all data (team-wide access). No row-level security for now.
7. **Error recovery** — if SQL fails, pass the error back to Claude for one retry. If retry fails, show the error to the user with the generated SQL.

## Token Cost Strategy

- First query: Claude API call (~$0.01-0.03 per query depending on schema size and response)
- Follow-up queries in same conversation: same cost (history grows but schema is cached)
- Saved reports: zero token cost (re-run stored SQL)
- Design encourages saving: "Save Report" button is prominent on every result
- Team Reports tab surfaces commonly-needed queries so reps check there first
- Query log enables admins to proactively identify popular queries and pin them as team reports

## File Structure

```
src/features/reports/
  components/
    ReportsPage.tsx          — Main page (split view, tab bar)
    ChatPanel.tsx            — Collapsible chat panel
    ChatMessage.tsx          — User/assistant message bubble
    ResultPreview.tsx        — Compact result preview in chat
    DataTable.tsx            — Full sortable data table
    ReportHeader.tsx         — Title, metadata, action buttons
    SaveReportModal.tsx      — Save report dialog
    SavedReportsList.tsx     — Saved/team reports tab content
    SuggestedQueries.tsx     — Empty state with query chips
    SQLModal.tsx             — Show SQL expandable/modal
  lib/
    schema-reference.yaml    — Semantic schema for Claude
    query-engine.ts          — Claude API + validation + execution
    queries.ts               — TanStack Query hooks
    types.ts                 — TypeScript types
src/lib/
  db-readonly.ts             — Read-only pg Pool
src/app/api/ai/
  query/route.ts             — POST /api/ai/query (generate + execute)
  query/run/route.ts         — POST /api/ai/query/run (re-run saved SQL)
```

## Database Setup

1. Create read-only Postgres role on Supabase with SELECT permissions on queryable tables only
2. Create `query_log` table
3. Create `saved_reports` table
4. Add Prisma models for both tables
5. Add `DATABASE_READONLY_URL` environment variable

## Dependencies

- Anthropic API key (`ANTHROPIC_API_KEY` — already configured)
- Supabase read-only database role (new)
- No new npm packages — uses fetch for Claude API (existing pattern)

## Out of Scope

- Agentic actions (MAP-3) — Claude can only read, not write
- MCP server (MAP-4) — same query engine, different protocol, built later
- Dashboard composition — saved reports are standalone, not composable into dashboards yet
- Charts/visualizations — results are tables only for MVP
- Row-level security — all authenticated users see all data
- Query cost tracking per user — just log queries, don't bill
