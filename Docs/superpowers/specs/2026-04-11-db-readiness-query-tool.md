# DB Readiness for Query Tool / Report Builder / MCP — Design Spec

> ⚠️ **Partially superseded by `specs/2026-04-21-query-tool-agentic-redesign.md`.**
> Infrastructure portions (readonly role, migrations, metadata types, `TABLE_REGISTRY` + `SEMANTIC_CONTEXT` scaffolding) are shipped and still valid. The query-engine references throughout this doc are obsolete — the query tool is no longer a structured-params DSL; see the April 21 spec.

**Date:** 2026-04-12
**Status:** Design approved, ready for implementation plan
**Branch:** TBD (suggested: `feat/db-readiness-query-tool`)
**Depends on:** PR #108 (`feat/db-normalization-query-tool`) — merged. PR #109 (`feat/elevate-subscription-revenue`) — merged; added `subscriptions` table and `district_financials.subscription_count`.
**Unblocks:** MAP-5 (Claude Query Tool), MAP-3 (Agentic Actions), MAP-4 (MCP Server)

## Summary

PR #108 normalized the schema and added MCP-prep additions (column metadata for `districts` + `district_financials`, FK relations, indexes). PR #109 added the Elevate K12 subscriptions table, rolled subscription revenue into `vendor='fullmind'` rows in `district_financials`, and exposed several closed-won text stage labels that the legacy numeric-prefix convention doesn't cover. This spec covers the remaining DB-layer work needed before the query engine can be implemented in a separate branch with no further DB prep.

After this PR ships, the only thing standing between `main` and a working query tool is the query engine + chat UI itself. All schema, infrastructure, semantic context, and audit-table prep is complete.

## Motivation

A review of the post-PR-#108/#109 database state identified six concrete blockers between the current schema and a working Claude query tool:

1. `query_log` and `saved_reports` tables do not exist
2. Read-only DB role is spec'd but not provisioned
3. Column metadata only covers 2 of ~16 primary queryable tables (plus 15+ junction tables undocumented). `subscriptions` is entirely missing and `district_financials.subscription_count` was added in PR #109 but not yet reflected in `DISTRICT_FINANCIALS_COLUMNS`.
4. `Session ↔ Opportunity` historical data gap (95K orphaned sessions) is undocumented in the metadata layer
5. `district_opportunity_actuals` materialized view is a source-of-truth duplicate that will confuse Claude if both it and `district_financials` are visible
6. **The `opportunities.stage` convention is wrong in the current metadata** — closed-won is predominantly text-labeled (`Closed Won`, `Active`, `Position Purchased`, `Requisition Received`, `Return Position Pending`), not numeric-prefixed. The legacy "stages 0-5 open / 6+ won" framing hid ~$68.8M of closed-won bookings in the leaderboard matview before 2026-04-11. Any query Claude writes without this knowledge will silently under-report bookings.

This spec resolves all six in a single PR. Minor schema gaps (`opportunities.closeDate` index, `opportunities.salesRepId` Prisma relation, etc.) are intentionally deferred as followups to keep this plan focused.

## Decisions Locked In During Brainstorming

| Question | Decision | Rationale |
|---|---|---|
| Scope | Blockers only (5 items), minor gaps as followups | Tighter PR, focused review surface |
| Session gap fix | Document & warn in semantic schema; no sync changes | Ship today; gap is FY19-FY23 data, sales team asks about current FY |
| Metadata format | TS, extend `src/lib/district-column-metadata.ts` | Type safety, grep-ability, no parser needed; spec gets updated to match |
| Queryable surface | Include `unmatched_accounts` + `unmatched_opportunities`; exclude `district_opportunity_actuals` mat view | Unmatched tables hold real revenue; mat view is a perf cache for internal code, not a Claude-facing surface |
| Sequencing | Single PR | Total LOC moderate, single audience (MAP-5), single failure mode |

## Architecture

The DB layer for the query tool consists of three parts:

```
┌─────────────────────────────────────────────────────────────┐
│                     Query Engine (MAP-5)                    │
│                       — NOT IN THIS PR —                    │
└────────────────┬────────────────────────────────────────────┘
                 │ reads
                 ▼
┌─────────────────────────────────────────────────────────────┐
│        src/lib/district-column-metadata.ts                  │
│                                                             │
│  • DISTRICT_COLUMNS, DISTRICT_FINANCIALS_COLUMNS  [exists]  │
│  • OPPORTUNITY_COLUMNS, SESSION_COLUMNS, etc.       [NEW]   │
│  • TABLE_REGISTRY      (relationships, exclusions)  [NEW]   │
│  • SEMANTIC_CONTEXT    (concept maps, warnings)     [NEW]   │
└────────────────┬────────────────────────────────────────────┘
                 │ describes
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                  Postgres (via two pools)                   │
│                                                             │
│  src/lib/prisma.ts        — full access (existing)          │
│  src/lib/db.ts            — pg Pool, full access (existing) │
│  src/lib/db-readonly.ts   — pg Pool, query_tool_readonly    │
│                             role, 5s timeout         [NEW]  │
│                                                             │
│  Schema additions: query_log, saved_reports          [NEW]  │
└─────────────────────────────────────────────────────────────┘
```

The query engine (MAP-5, separate PR) imports `TABLE_REGISTRY` and `SEMANTIC_CONTEXT`, serializes the relevant subset into Claude's system prompt, sends questions to Claude, validates returned SQL against the schema/whitelist, executes via `readonlyPool`, and logs to `query_log`.

## Deliverables

### 1. Migration: `prisma/migrations/20260411_query_tool_tables/migration.sql`

Adds `query_log` and `saved_reports` tables. Includes the MAP-3 action columns up front so MAP-3 doesn't require a second migration.

```sql
CREATE TABLE query_log (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES user_profiles(id),
  conversation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  question        TEXT NOT NULL,
  sql             TEXT,
  row_count       INT,
  execution_time_ms INT,
  error           TEXT,
  action          TEXT,
  action_params   JSONB,
  action_success  BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX query_log_user_idx ON query_log(user_id);
CREATE INDEX query_log_conversation_idx ON query_log(conversation_id);
CREATE INDEX query_log_created_idx ON query_log(created_at DESC);
CREATE INDEX query_log_action_idx ON query_log(action) WHERE action IS NOT NULL;

CREATE TABLE saved_reports (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES user_profiles(id),
  title           TEXT NOT NULL,
  question        TEXT NOT NULL,
  sql             TEXT NOT NULL,
  is_team_pinned  BOOLEAN NOT NULL DEFAULT false,
  pinned_by       UUID REFERENCES user_profiles(id),
  last_run_at     TIMESTAMPTZ,
  run_count       INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX saved_reports_user_idx ON saved_reports(user_id);
CREATE INDEX saved_reports_pinned_idx ON saved_reports(is_team_pinned) WHERE is_team_pinned = true;
```

### 2. Prisma models in `prisma/schema.prisma`

```prisma
model QueryLog {
  id              Int       @id @default(autoincrement())
  userId          String    @map("user_id") @db.Uuid
  conversationId  String    @default(dbgenerated("gen_random_uuid()")) @map("conversation_id") @db.Uuid
  question        String
  sql             String?
  rowCount        Int?      @map("row_count")
  executionTimeMs Int?      @map("execution_time_ms")
  error           String?
  action          String?
  actionParams    Json?     @map("action_params")
  actionSuccess   Boolean?  @map("action_success")
  createdAt       DateTime  @default(now()) @map("created_at")

  user UserProfile @relation("UserQueryLogs", fields: [userId], references: [id])

  @@index([userId])
  @@index([conversationId])
  @@index([createdAt(sort: Desc)])
  @@map("query_log")
}

model SavedReport {
  id           Int       @id @default(autoincrement())
  userId       String    @map("user_id") @db.Uuid
  title        String
  question     String
  sql          String
  isTeamPinned Boolean   @default(false) @map("is_team_pinned")
  pinnedBy     String?   @map("pinned_by") @db.Uuid
  lastRunAt    DateTime? @map("last_run_at")
  runCount     Int       @default(0) @map("run_count")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  user UserProfile @relation("UserSavedReports", fields: [userId], references: [id])

  @@index([userId])
  @@index([isTeamPinned])
  @@map("saved_reports")
}
```

`UserProfile` gets two new inverse relations: `queryLogs QueryLog[] @relation("UserQueryLogs")` and `savedReports SavedReport[] @relation("UserSavedReports")`.

### 3. Read-only role SQL: `prisma/migrations/manual/create-readonly-role.sql`

Run-once script the user executes in Supabase SQL editor. Lives in `prisma/manual/` because Prisma cannot manage its own connection role's grants — the same pattern as the existing `prisma/migrations/MANUAL_RUN_IN_SUPABASE.sql`.

```sql
-- Create the role with a strong password (replace CHANGE_ME before running)
CREATE ROLE query_tool_readonly LOGIN PASSWORD 'CHANGE_ME';

-- Connection-level guardrails
ALTER ROLE query_tool_readonly SET statement_timeout = '5s';
ALTER ROLE query_tool_readonly SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE query_tool_readonly SET default_transaction_read_only = on;

GRANT CONNECT ON DATABASE postgres TO query_tool_readonly;
GRANT USAGE ON SCHEMA public TO query_tool_readonly;

-- Whitelist: explicit GRANT SELECT on every queryable table
GRANT SELECT ON
  districts, district_financials, district_data_history, district_grade_enrollment,
  states, state_assessments, schools, school_enrollment_history,
  contacts, school_contacts,
  territory_plans, territory_plan_districts, territory_plan_states,
  activities, activity_districts, activity_plans, activity_states,
    activity_contacts, activity_opportunities, activity_expenses,
  tasks, task_districts, task_plans, task_activities, task_contacts,
  opportunities, sessions, subscriptions,
  unmatched_accounts, unmatched_opportunities,
  vacancies, vacancy_scans,
  tags, district_tags, school_tags,
  services, territory_plan_district_services,
  query_log, saved_reports
TO query_tool_readonly;

-- Defense in depth: explicit REVOKE on excluded tables. No grant exists, but
-- this makes intent obvious if a future migration blanket-grants the schema.
REVOKE ALL ON
  user_profiles, user_integrations, user_goals, calendar_events,
  map_views, data_refresh_logs,
  initiatives, initiative_metrics, initiative_scores, initiative_tier_thresholds,
  metric_registry, vacancy_keyword_config
FROM query_tool_readonly;

-- The mat view is excluded from the query tool surface (see SEMANTIC_CONTEXT.excludedTables)
REVOKE ALL ON district_opportunity_actuals FROM query_tool_readonly;
```

**Ops checklist (in the migration's README or the file header):**

1. Replace `CHANGE_ME` with a strong password
2. Run the script in Supabase SQL editor as the postgres superuser
3. Construct the connection string from the Supabase project's connection pooler URL with the new role name + password
4. Set `DATABASE_READONLY_URL` in `.env.local` and in production env vars (Vercel)
5. Verify connectivity: `psql $DATABASE_READONLY_URL -c "SELECT count(*) FROM districts;"` succeeds
6. Verify exclusion: `psql $DATABASE_READONLY_URL -c "SELECT count(*) FROM user_profiles;"` fails with permission denied
7. Verify timeout: `psql $DATABASE_READONLY_URL -c "SELECT pg_sleep(10);"` fails after 5s

### 4. Read-only pool: `src/lib/db-readonly.ts`

```typescript
import { Pool } from "pg";

if (!process.env.DATABASE_READONLY_URL) {
  throw new Error("DATABASE_READONLY_URL is not set");
}

export const readonlyPool = new Pool({
  connectionString: process.env.DATABASE_READONLY_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
});
```

### 5. `.env.example` update

Append:

```
# Read-only DB role for the Claude query tool (MAP-5).
# Created via prisma/migrations/manual/create-readonly-role.sql.
DATABASE_READONLY_URL=postgresql://query_tool_readonly:PASSWORD@HOST:PORT/postgres
```

### 6. Extended column metadata: `src/lib/district-column-metadata.ts`

Extend the existing file in three parts.

**Pre-work: fill the PR #109 gap.** PR #109 added `subscription_count` to `district_financials` and a new `Subscription` Prisma model, but did not update `DISTRICT_FINANCIALS_COLUMNS` or add `SUBSCRIPTION_COLUMNS`. This spec fills both gaps as part of the metadata extension.

> **Authoring approach — IMPORTANT:** The column descriptions, concept mappings, format gotchas, and table warnings encode tacit business logic about how the Fullmind sales process works. They must be written **interactively, Q&A style with the user**, table by table — not batch-generated by a subagent or autonomously filled in from the schema. The schema gives types; the user gives meaning. The implementation plan will mark these tasks as "interactive, not subagent-driven" and will group questions by table to keep dialogue tight. Only pure-FK junction tables and obviously mechanical fields (`id`, `created_at`, `updated_at`) can be filled in autonomously.

#### Part A — Type union extensions

```typescript
export type ColumnDomain =
  | "core" | "crm" | "finance" | "poverty" | "graduation" | "staffing"
  | "demographics" | "absenteeism" | "assessment" | "sped" | "esser"
  | "tech_capital" | "outsourcing" | "trends" | "benchmarks" | "icp"
  | "links" | "user_edits"
  // NEW
  | "opportunity" | "session" | "activity" | "plan" | "contact"
  | "task" | "vacancy" | "school" | "state" | "history" | "unmatched";

export type DataSource =
  | "nces" | "urban_institute" | "fullmind_crm" | "computed"
  | "user" | "govspend" | "etl_link"
  // NEW
  | "opensearch" | "scraper";
```

#### Part B — New per-table column arrays

Following the existing `ColumnMetadata` shape, one exported array per **primary** queryable table. Each column gets `field`, `column`, `label`, `description`, `domain`, `format`, `source`, `queryable`. Descriptions include format notes, semantic gotchas, and FK pointers.

**Primary tables (full column arrays):**

| Export name | Source table | Notes |
|---|---|---|
| `OPPORTUNITY_COLUMNS` | `opportunities` | Mark `school_yr` format mismatch with `district_financials.fiscal_year`; document `stage` numeric-prefix convention |
| `SESSION_COLUMNS` | `sessions` | `opportunityId` description includes the historical-gap warning |
| `SUBSCRIPTION_COLUMNS` | `subscriptions` | Elevate K12 line items (added PR #109). Parallel to sessions — both feed `refresh_fullmind_financials()` into `vendor='fullmind'` rows. Quantity/netTotal can be negative (credits). |
| `ACTIVITY_COLUMNS` | `activities` | Document the 20+ enum values for `type` and `status` |
| `TERRITORY_PLAN_COLUMNS` | `territory_plans` | Note the `fiscalYear` is `Int` (`2026`), not `'FY26'` |
| `TERRITORY_PLAN_DISTRICT_COLUMNS` | `territory_plan_districts` | Junction with semantically meaningful target columns |
| `CONTACT_COLUMNS` | `contacts` | |
| `TASK_COLUMNS` | `tasks` | |
| `VACANCY_COLUMNS` | `vacancies` | Note the `category` enum |
| `SCHOOL_COLUMNS` | `schools` | |
| `STATE_COLUMNS` | `states` | Note that aggregates are denormalized cache |
| `DISTRICT_DATA_HISTORY_COLUMNS` | `district_data_history` | Year-over-year history |
| `UNMATCHED_ACCOUNT_COLUMNS` | `unmatched_accounts` | Description explains "ETL match failure" semantics |
| `UNMATCHED_OPPORTUNITY_COLUMNS` | `unmatched_opportunities` | Sparse, but include for completeness |
| `QUERY_LOG_COLUMNS` | `query_log` | New table from this PR; surfaces query history for "what did I ask last week" |
| `SAVED_REPORT_COLUMNS` | `saved_reports` | New table from this PR; surfaces team-pinned reports |

**Junction tables (TABLE_REGISTRY entry, no per-table column array):**

Pure-FK junction tables (`activity_districts`, `task_districts`, `district_tags`, `school_tags`, `school_contacts`, `activity_plans`, `activity_contacts`, `activity_states`, `activity_opportunities`, `task_plans`, `task_activities`, `task_contacts`, `territory_plan_states`, `territory_plan_district_services`, `activity_expenses`) get `TABLE_REGISTRY` entries with `columns: []` and rich `relationships` arrays. Claude navigates through them via JOIN paths, not column filters. The two junctions that have semantically meaningful columns (`territory_plan_districts` with target amounts, `activity_districts` with `visit_date`/`position`) get full column arrays as listed above.

#### Part C — `TABLE_REGISTRY` and `SEMANTIC_CONTEXT`

New top-level exports.

```typescript
export interface TableRelationship {
  toTable: string;
  type: "one-to-many" | "many-to-one" | "many-to-many";
  joinSql: string;
  description: string;
}

export interface TableMetadata {
  table: string;
  description: string;
  primaryKey: string | string[];
  columns: ColumnMetadata[];
  excludedColumns?: string[];
  relationships: TableRelationship[];
  warnings?: string[];
}

export const TABLE_REGISTRY: Record<string, TableMetadata> = {
  districts: { /* … all 14 tables … */ },
  district_financials: { /* … */ },
  opportunities: { /* … */ },
  sessions: { /* … */ },
  activities: { /* … */ },
  territory_plans: { /* … */ },
  territory_plan_districts: { /* … */ },
  contacts: { /* … */ },
  tasks: { /* … */ },
  vacancies: { /* … */ },
  schools: { /* … */ },
  states: { /* … */ },
  district_data_history: { /* … */ },
  unmatched_accounts: { /* … */ },
  unmatched_opportunities: { /* … */ },
};
```

```typescript
export interface ConceptMapping {
  aggregated?: string;
  dealLevel?: string;
  note?: string;
}

export interface FormatMismatch {
  concept: string;
  tables?: Record<string, string>;
  conversionSql?: string;
  note?: string;
}

export interface Warning {
  triggerTables: string[];
  severity: "mandatory" | "informational";
  message: string;
}

export interface SemanticContext {
  conceptMappings: Record<string, ConceptMapping>;
  formatMismatches: FormatMismatch[];
  warnings: Warning[];
  excludedTables: string[];
}

export const SEMANTIC_CONTEXT: SemanticContext = {
  conceptMappings: {
    bookings: {
      aggregated: "district_financials.closed_won_bookings WHERE vendor='fullmind'",
      dealLevel: "SUM(opportunities.net_booking_amount) WHERE stage is closed-won (see stage convention below)",
    },
    pipeline: {
      aggregated: "district_financials.open_pipeline",
      dealLevel: "SUM(opportunities.net_booking_amount) WHERE numeric stage prefix BETWEEN 0 AND 5",
    },
    revenue: {
      aggregated: "district_financials.total_revenue (sum across session-derived + subscription sources after refresh_fullmind_financials runs)",
      dealLevel: "See note",
      note: "Three sources: (1) session-derived revenue — opportunities.completed_revenue + scheduled_revenue, populated for legacy Fullmind deals from sessions aggregation; (2) subscription revenue — SUM(subscriptions.net_total) joined to opportunities, populated for Elevate K12 deals; (3) competitor spend — district_financials.total_revenue WHERE vendor!='fullmind' from GovSpend. For Fullmind internal revenue questions, always use district_financials WHERE vendor='fullmind' which aggregates (1)+(2). Querying opportunities.total_revenue directly will MISS EK12 subscription revenue.",
    },
    our_data: {
      note: "When the user says 'our' or 'Fullmind', filter district_financials WHERE vendor='fullmind' or query opportunities directly (only Fullmind deals are in opportunities). EK12 and native Fullmind deals are both in opportunities but EK12 revenue lives in subscriptions, not session-derived columns.",
    },
    customers: {
      note: "districts.is_customer is the canonical flag. Computed from district_financials presence.",
    },
    subscription_revenue: {
      aggregated: "SUM(subscriptions.net_total) joined via subscriptions.opportunity_id = opportunities.id, then o.district_lea_id",
      note: "Net totals are signed — credits appear as negative values. This is Elevate K12 acquisition revenue and represents a majority of EK12 reps' totals.",
    },
  },
  formatMismatches: [
    {
      concept: "fiscal year",
      tables: {
        opportunities: "school_yr text 'YYYY-YY' e.g., '2025-26'",
        district_financials: "fiscal_year text 'FYNN' e.g., 'FY26'",
        territory_plans: "fiscal_year integer e.g., 2026",
      },
      conversionSql: "SUBSTRING(school_yr, 6, 2) = SUBSTRING(fiscal_year, 3, 2)",
    },
    {
      concept: "opportunity stage",
      note: "opportunities.stage has TWO conventions in the same column. (A) Legacy Fullmind numeric prefix: text like '0 - Lead', '3 - Proposal'. Extract with regexp_match(stage, '^(\\d+)'). Prefix 0-5 = open pipeline, 6+ = closed-won. 'Closed Lost' also exists. (B) Elevate K12 / newer Salesforce text labels: 'Closed Won', 'Active', 'Position Purchased', 'Requisition Received', 'Return Position Pending' are all CLOSED-WON. 'Closed Lost' is closed-lost. Any correct closed-won query must handle BOTH conventions — the canonical reference is the CASE statement in refresh_fullmind_financials() (prisma/migrations/manual/create_refresh_fullmind_financials.sql). Silently relying on numeric prefixes alone previously hid ~$68.8M of closed-won bookings from the leaderboard; do not reintroduce that bug in the query tool.",
    },
  ],
  warnings: [
    {
      triggerTables: ["sessions"],
      severity: "mandatory",
      message: "HISTORICAL DATA GAP: 95,345 sessions (33% of all sessions) have opportunity_id values that don't match any row in the opportunities table. The gap is concentrated in FY19-FY23 (~94K of the orphans). Reason: the OpenSearch opportunity sync is recency-filtered while the session sync is not. Any query joining sessions to opportunities will UNDER-COUNT historical revenue. When the user asks about sessions data older than FY24, you MUST include a caveat in your insight noting this gap. Tracked in Docs/superpowers/followups/2026-04-11-opportunity-sync-historical-gap.md.",
    },
    {
      triggerTables: ["unmatched_accounts", "unmatched_opportunities"],
      severity: "informational",
      message: "These tables hold accounts/opportunities that did not match a district leaid during ETL. They contain real revenue and pipeline. Include them in totals when the user asks about company-wide numbers; mention them when the user asks specifically about 'all our pipeline' or 'total revenue'. Join unmatched_accounts to district_financials via unmatched_account_id for FY-level revenue.",
    },
    {
      triggerTables: ["district_financials"],
      severity: "informational",
      message: "Use vendor='fullmind' for our internal data. Other vendors (elevate, proximity, tbt) are competitors sourced from GovSpend PO data and represent estimated competitor spend, not Fullmind revenue.",
    },
    {
      triggerTables: ["opportunities"],
      severity: "informational",
      message: "Only Fullmind deals (native + EK12) are in this table; competitors are tracked aggregate-only in district_financials. The opportunities.salesRepId UUID FK exists but has no Prisma relation yet — use sales_rep_email for rep filtering.",
    },
    {
      triggerTables: ["opportunities", "subscriptions"],
      severity: "mandatory",
      message: "EK12 REVENUE QUIRK: Elevate K12 opportunities have $0 in their session-derived revenue columns (completed_revenue, scheduled_revenue, total_revenue, completed_take, scheduled_take, total_take, average_take_rate). Their real revenue lives in the subscriptions table via SUM(subscriptions.net_total). A query that asks 'what's this rep's FY26 revenue' and reads only from opportunities.total_revenue will return $0 for every EK12 rep despite them having millions in contracted subscription revenue. ALWAYS prefer district_financials (vendor='fullmind') for revenue totals because the ETL rolls in both session AND subscription sources. If Claude must query opportunities directly, it MUST also join subscriptions on opportunity_id and sum net_total. 'Take' has no subscription analog — there is no take rate concept for subscriptions, so any take query should note that it reflects session-derived deals only.",
    },
    {
      triggerTables: ["opportunities"],
      severity: "mandatory",
      message: "STAGE CONVENTION: opportunities.stage has two conventions. Legacy numeric-prefix ('0 - Lead' ... '6 - Closed Won') AND Elevate K12 text labels ('Closed Won', 'Active', 'Position Purchased', 'Requisition Received', 'Return Position Pending' are all closed-won; 'Closed Lost' is closed-lost). A query filtering on numeric prefixes alone will miss ~$68.8M in historical closed-won bookings. The canonical closed-won expression is: `CASE WHEN stage ~ '^\\d' THEN (regexp_match(stage, '^(\\d+)'))[1]::int >= 6 WHEN LOWER(stage) IN ('closed won','active','position purchased','requisition received','return position pending') THEN TRUE ELSE FALSE END`. See prisma/migrations/manual/create_refresh_fullmind_financials.sql.",
    },
  ],
  excludedTables: [
    "user_profiles", "user_integrations", "user_goals",
    "calendar_events",
    "map_views",
    "data_refresh_logs",
    "initiatives", "initiative_metrics", "initiative_scores", "initiative_tier_thresholds",
    "metric_registry", "vacancy_keyword_config",
    "district_opportunity_actuals",
  ],
};
```

The MAP-5 query engine will:

1. Receive a question
2. Serialize the relevant subset of `TABLE_REGISTRY` into Claude's system prompt
3. For each warning whose `triggerTables` overlap with tables Claude is likely to use (or, on a second pass, the tables actually referenced in the generated SQL), append the warning's `message` to the prompt
4. For `severity: "mandatory"` warnings, instruct Claude to surface the caveat in its `insight` response

### 7. Spec update

Patch `Docs/superpowers/specs/2026-04-03-claude-query-tool-design.md`:

- Replace `src/features/reports/lib/schema-reference.yaml` with `src/lib/district-column-metadata.ts` (the `TABLE_REGISTRY` + `SEMANTIC_CONTEXT` exports)
- Drop the YAML loader from the architecture diagram
- Add a paragraph on the warning-injection requirement
- Note that the read-only role is provisioned via `prisma/migrations/manual/create-readonly-role.sql`

## Testing

Create `src/lib/__tests__/district-column-metadata.test.ts` (file does not exist yet):

1. **Schema coverage check** — every model in `prisma/schema.prisma` is either in `TABLE_REGISTRY` or in `SEMANTIC_CONTEXT.excludedTables`. No silent omissions. (Parse the schema file at test time, list all `model X` blocks, assert each maps to one or the other.)
2. **Column existence check** — every `ColumnMetadata.column` value in every per-table array maps to a real column in the corresponding Prisma model. Junction tables with `columns: []` are skipped.
3. **Relationship column check** — every column referenced in a `TableRelationship.joinSql` matches a real column in the source/target Prisma models (regex parse the joinSql, look up the columns).
4. **Warning trigger check** — every table named in a `Warning.triggerTables` exists in `TABLE_REGISTRY`.
5. **Excluded tables don't appear in registry** — sanity check.
6. **Existing exports still work** — `KNOWN_VENDORS`, `formatFiscalYear`, `COLUMN_BY_FIELD`, `FINANCIALS_COLUMN_BY_FIELD` lookups continue unchanged. (These currently have no test file, so this acts as their first regression test as well.)

No integration tests for the read-only role — that's runtime ops verification, manually run via the ops checklist in deliverable 3.

Vitest run confirms existing 1380 tests still pass.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `prisma/migrations/20260411_query_tool_tables/migration.sql` | Create | Adds query_log + saved_reports tables |
| `prisma/schema.prisma` | Modify | Adds QueryLog + SavedReport models, UserProfile inverse relations |
| `prisma/migrations/manual/create-readonly-role.sql` | Create | One-time Supabase role provisioning script |
| `src/lib/db-readonly.ts` | Create | Read-only `pg.Pool` for query tool |
| `.env.example` | Modify | Document `DATABASE_READONLY_URL` |
| `src/lib/district-column-metadata.ts` | Modify | Add `subscriptionCount` to `DISTRICT_FINANCIALS_COLUMNS` (missed in PR #109). Extend type unions. Add 15 new column arrays (opportunity, session, subscription, activity, territory_plan, territory_plan_district, contact, task, vacancy, school, state, district_data_history, unmatched_account, unmatched_opportunity, query_log, saved_report) + TABLE_REGISTRY + SEMANTIC_CONTEXT. |
| `src/lib/__tests__/district-column-metadata.test.ts` | Create | Coverage + integrity tests (file does not exist yet) |
| `Docs/superpowers/specs/2026-04-03-claude-query-tool-design.md` | Modify | Update YAML references → TS, add warning injection requirement |

## Out of Scope (Followups)

These are tracked separately, not blocking MAP-5:

- **Query engine implementation** (`src/features/reports/lib/query-engine.ts`) — MAP-5
- **`/api/ai/query` route** — MAP-5
- **Frontend chat UI** (`src/features/reports/components/`) — MAP-5
- **Action handlers and `/api/ai/query/action`** — MAP-3
- **Railway scheduler session-gap fix** — see `Docs/superpowers/followups/2026-04-11-opportunity-sync-historical-gap.md`
- **`opportunities.salesRepId` Prisma relation** — Phase 2a deferral
- **`opportunities.closeDate` index** — minor perf followup
- **One-time backfill of historical opportunities** — depends on session-gap decision

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Read-only role provisioning is manual; user may skip a step | Medium | Ops checklist in the SQL file header; verification commands documented |
| Mandatory warning injection in MAP-5 may not trigger for tricky multi-table queries | Medium | The trigger logic operates on the SQL Claude generates, not just the user's question. Worth a test fixture in MAP-5. |
| `unmatched_accounts` inclusion may double-count if Claude joins it AND district_financials AND opportunities | Low | The semantic context warning explains the join path; integration test in MAP-5 |
| Mat view exclusion breaks an existing internal query that we forgot reads it | Low | The mat view stays; only the query tool's role lacks SELECT on it. Internal code uses the regular `prisma`/`db.ts` pools and is unaffected. |
| Adding `query_log` indexes on production may briefly lock writes | Very low | Tables are new and empty at migration time |

## Success Criteria

- [ ] All 8 file changes land in a single PR
- [ ] `npm test` passes (all 1380 existing + new tests)
- [ ] Manual ops checklist completed in production:
  - [ ] `query_tool_readonly` role exists in Supabase
  - [ ] `DATABASE_READONLY_URL` set in Vercel env
  - [ ] `psql $DATABASE_READONLY_URL -c "SELECT count(*) FROM districts;"` succeeds
  - [ ] `psql $DATABASE_READONLY_URL -c "SELECT count(*) FROM user_profiles;"` fails (permission denied)
  - [ ] `psql $DATABASE_READONLY_URL -c "SELECT pg_sleep(10);"` fails after 5s
- [ ] MAP-5 implementation can begin without further DB-layer changes
