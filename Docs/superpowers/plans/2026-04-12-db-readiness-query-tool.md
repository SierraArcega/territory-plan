# DB Readiness for Query Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ INTERACTIVE TASKS WARNING:** Tasks 11–25 involve authoring column metadata, table descriptions, concept mappings, and warnings that encode the user's tacit business logic. Per project memory (`feedback_collaborative_metadata.md`), **these tasks MUST be executed interactively with the user, not dispatched to an isolated subagent.** Autonomous generation from the schema produces technically-correct-but-business-wrong descriptions. Each interactive task starts with a "Prompt the user" block listing exactly what to ask. If executing via subagent-driven-development, pause at each interactive task and run it inline in the main session.

**Goal:** Land the schema, infrastructure, and metadata prep required for the Claude query tool (MAP-5), agentic actions (MAP-3), and MCP server (MAP-4) so that no further DB-layer work is needed to build the query engine and UI.

**Architecture:** A single PR that (1) adds `query_log` and `saved_reports` tables with the MAP-3 action columns baked in, (2) provisions a read-only Postgres role via a manual SQL script, (3) ships a `readonlyPool` wrapper for the query engine to use, (4) extends `src/lib/district-column-metadata.ts` from 2 tables to 18 primary tables + junction tables via new `TABLE_REGISTRY` and `SEMANTIC_CONTEXT` exports, and (5) patches the existing query tool design spec to match.

**Tech Stack:** Prisma 6 + PostgreSQL 15, Next.js 16 App Router, TypeScript 5, Vitest, `pg` driver

**Spec:** `Docs/superpowers/specs/2026-04-11-db-readiness-query-tool.md`

**Working directory:** The current repo, branch `feat/db-readiness-query-tool` (already created from main).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `prisma/migrations/20260412_query_tool_tables/migration.sql` | Create | DDL for `query_log` + `saved_reports` with MAP-3 action columns |
| `prisma/schema.prisma` | Modify | Add `QueryLog` + `SavedReport` models and `UserProfile` inverse relations |
| `prisma/migrations/manual/create-readonly-role.sql` | Create | One-time Supabase SQL editor script for `query_tool_readonly` role |
| `src/lib/db-readonly.ts` | Create | `pg.Pool` wrapper for the read-only role |
| `.env.example` | Modify | Document `DATABASE_READONLY_URL` |
| `src/lib/district-column-metadata.ts` | Modify | Fix PR #109 gap, extend types, add 15 new column arrays, add `TABLE_REGISTRY` and `SEMANTIC_CONTEXT` |
| `src/lib/__tests__/district-column-metadata.test.ts` | Create | Schema coverage, column existence, relationship, and warning trigger tests |
| `Docs/superpowers/specs/2026-04-03-claude-query-tool-design.md` | Modify | Replace YAML references with TS, document warning injection |

---

## Task 1: Add `QueryLog` and `SavedReport` Prisma models

**Files:**
- Modify: `prisma/schema.prisma` (append models at end of file, add relations on `UserProfile`)

- [ ] **Step 1: Add the `QueryLog` and `SavedReport` models**

Append to the end of `prisma/schema.prisma` (after `MetricRegistry`, around line 1445):

```prisma
// ===== Query Tool Audit & Saved Reports =====
// Added for the Claude query tool (MAP-5), agentic actions (MAP-3), and MCP (MAP-4).
// query_log records every natural-language query, generated SQL, and action execution.
// saved_reports stores user-saved and team-pinned reports with stored SQL for re-run.

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
  @@index([action])
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

- [ ] **Step 2: Add inverse relations to `UserProfile`**

In `prisma/schema.prisma`, inside the `UserProfile` model (around line 735), add these lines in the relations block (after `ownedSchools         School[]   @relation("SchoolOwner")`):

```prisma
  queryLogs     QueryLog[]    @relation("UserQueryLogs")
  savedReports  SavedReport[] @relation("UserSavedReports")
```

- [ ] **Step 3: Validate the schema parses**

Run:
```bash
npx prisma validate
```
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add QueryLog and SavedReport Prisma models"
```

---

## Task 2: Generate the migration and verify the SQL

**Files:**
- Create: `prisma/migrations/20260412_query_tool_tables/migration.sql`

- [ ] **Step 1: Generate the migration**

Run:
```bash
npx prisma migrate dev --name query_tool_tables --create-only
```

The `--create-only` flag generates the SQL without applying it so you can review it.

- [ ] **Step 2: Verify the generated SQL**

Read the generated `prisma/migrations/20260412_query_tool_tables/migration.sql`. It should contain roughly:

```sql
CREATE TABLE "query_log" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question" TEXT NOT NULL,
    "sql" TEXT,
    "row_count" INTEGER,
    "execution_time_ms" INTEGER,
    "error" TEXT,
    "action" TEXT,
    "action_params" JSONB,
    "action_success" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "query_log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saved_reports" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "is_team_pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinned_by" UUID,
    "last_run_at" TIMESTAMP(3),
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "query_log_user_id_idx" ON "query_log"("user_id");
CREATE INDEX "query_log_conversation_id_idx" ON "query_log"("conversation_id");
CREATE INDEX "query_log_created_at_idx" ON "query_log"("created_at" DESC);
CREATE INDEX "query_log_action_idx" ON "query_log"("action");
CREATE INDEX "saved_reports_user_id_idx" ON "saved_reports"("user_id");
CREATE INDEX "saved_reports_is_team_pinned_idx" ON "saved_reports"("is_team_pinned");

ALTER TABLE "query_log" ADD CONSTRAINT "query_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply the migration to the local dev DB**

Run:
```bash
npx prisma migrate dev
```
Expected: migration applies successfully, no errors, Prisma client regenerated.

- [ ] **Step 4: Verify the tables exist locally**

Run:
```bash
npx prisma db execute --stdin <<< "SELECT table_name FROM information_schema.tables WHERE table_name IN ('query_log', 'saved_reports');"
```
Expected: both table names listed.

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations/20260412_query_tool_tables/
git commit -m "feat(db): migration for query_log and saved_reports tables"
```

---

## Task 3: Create the read-only role SQL script

**Files:**
- Create: `prisma/migrations/manual/create-readonly-role.sql`

This is a **manual** SQL script the user runs once in the Supabase SQL editor. Prisma cannot manage the role's grants itself.

- [ ] **Step 1: Create the SQL file**

Create `prisma/migrations/manual/create-readonly-role.sql` with this content (verbatim — header comments are load-bearing for the ops runbook):

```sql
-- =============================================================================
-- Create the query_tool_readonly Postgres role for MAP-5 (Claude Query Tool).
-- =============================================================================
--
-- This script is run ONCE by a database admin in the Supabase SQL editor.
-- It is NOT managed by Prisma (Prisma cannot grant permissions to a role it
-- isn't connected as).
--
-- OPS CHECKLIST:
--   1. Replace 'CHANGE_ME' below with a strong password before running.
--   2. Run this script in the Supabase SQL editor as the postgres superuser.
--   3. Construct the connection string using the Supabase pooler URL, but
--      substitute the new role name + password for the postgres credentials.
--   4. Set DATABASE_READONLY_URL in .env.local (dev) and Vercel env (prod).
--   5. Verify connectivity:
--      psql $DATABASE_READONLY_URL -c "SELECT count(*) FROM districts;"
--      → should succeed
--   6. Verify exclusion:
--      psql $DATABASE_READONLY_URL -c "SELECT count(*) FROM user_profiles;"
--      → should fail with "permission denied for table user_profiles"
--   7. Verify timeout:
--      psql $DATABASE_READONLY_URL -c "SELECT pg_sleep(10);"
--      → should fail with "canceling statement due to statement timeout" after 5s
--
-- =============================================================================

CREATE ROLE query_tool_readonly LOGIN PASSWORD 'CHANGE_ME';

-- Connection-level guardrails (defense in depth with app-level timeout)
ALTER ROLE query_tool_readonly SET statement_timeout = '5s';
ALTER ROLE query_tool_readonly SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE query_tool_readonly SET default_transaction_read_only = on;

GRANT CONNECT ON DATABASE postgres TO query_tool_readonly;
GRANT USAGE ON SCHEMA public TO query_tool_readonly;

-- =============================================================================
-- Whitelist: explicit GRANT SELECT on every queryable table
-- Keep this list in sync with TABLE_REGISTRY in src/lib/district-column-metadata.ts
-- =============================================================================
GRANT SELECT ON
  -- Districts & education data
  districts, district_financials, district_data_history, district_grade_enrollment,
  states, state_assessments, schools, school_enrollment_history,
  -- People
  contacts, school_contacts,
  -- Territory plans
  territory_plans, territory_plan_districts, territory_plan_states,
    territory_plan_collaborators, territory_plan_district_services,
  -- Activities
  activities, activity_districts, activity_plans, activity_states,
    activity_contacts, activity_opportunities, activity_expenses,
    activity_attendees, activity_relations,
  -- Tasks
  tasks, task_districts, task_plans, task_activities, task_contacts,
  -- Revenue sources
  opportunities, sessions, subscriptions,
  unmatched_accounts, unmatched_opportunities,
  -- Vacancies
  vacancies, vacancy_scans,
  -- Tags & services
  tags, district_tags, school_tags,
  services,
  -- Query tool internal
  query_log, saved_reports
TO query_tool_readonly;

-- =============================================================================
-- Defense in depth: explicit REVOKE on excluded tables.
-- No grant exists, so this is symbolic — but makes intent obvious if a future
-- migration blanket-grants the schema.
-- =============================================================================
REVOKE ALL ON
  user_profiles, user_integrations, user_goals, calendar_events,
  map_views, data_refresh_logs,
  initiatives, initiative_metrics, initiative_scores, initiative_tier_thresholds,
  metric_registry, vacancy_keyword_config,
  district_opportunity_actuals
FROM query_tool_readonly;
```

- [ ] **Step 2: Commit**

```bash
git add prisma/migrations/manual/create-readonly-role.sql
git commit -m "feat(db): add manual SQL script for query_tool_readonly role"
```

**Note:** This task creates the script but does NOT run it. The script runs against production via Supabase SQL editor as part of the deploy runbook, not as part of CI.

---

## Task 4: Create `db-readonly.ts` and update `.env.example`

**Files:**
- Create: `src/lib/db-readonly.ts`
- Modify: `.env.example`

- [ ] **Step 1: Create the read-only pool wrapper**

Create `src/lib/db-readonly.ts`:

```typescript
import { Pool } from "pg";

/**
 * Read-only Postgres pool for the Claude query tool (MAP-5) and MCP server (MAP-4).
 *
 * Connects as the `query_tool_readonly` role, which has:
 *   - SELECT-only grants on the whitelisted queryable tables
 *   - No access to user_profiles, user_integrations, calendar_events, etc.
 *   - 5-second statement timeout enforced at the role level
 *   - default_transaction_read_only = on
 *
 * See prisma/migrations/manual/create-readonly-role.sql for role setup.
 */

if (!process.env.DATABASE_READONLY_URL) {
  throw new Error(
    "DATABASE_READONLY_URL is not set. See prisma/migrations/manual/create-readonly-role.sql for setup instructions.",
  );
}

export const readonlyPool = new Pool({
  connectionString: process.env.DATABASE_READONLY_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
});
```

- [ ] **Step 2: Update `.env.example`**

Append to `.env.example`:

```
# Read-only DB role for the Claude query tool (MAP-5) and MCP server (MAP-4).
# Role is created via prisma/migrations/manual/create-readonly-role.sql.
# Use the Supabase pooler URL with the query_tool_readonly role credentials.
DATABASE_READONLY_URL="postgresql://query_tool_readonly:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db-readonly.ts .env.example
git commit -m "feat(db): add read-only pg pool for query tool"
```

---

## Task 5: Fix the PR #109 metadata gap — add `subscriptionCount` to `DISTRICT_FINANCIALS_COLUMNS`

**Files:**
- Modify: `src/lib/district-column-metadata.ts:1243` (in the `DISTRICT_FINANCIALS_COLUMNS` array, next to `sessionCount`)

This fills a gap from PR #109: the Prisma model got `subscriptionCount` but the metadata file didn't.

- [ ] **Step 1: Add the column entry**

In `src/lib/district-column-metadata.ts`, find the `sessionCount` entry inside `DISTRICT_FINANCIALS_COLUMNS` (around line 1234) and add a `subscriptionCount` entry right after it:

```typescript
  {
    field: "subscriptionCount",
    column: "subscription_count",
    label: "Subscription Count",
    description: "Number of Elevate K12 subscription line items rolled into this district/FY. Populated by refresh_fullmind_financials() from the subscriptions table. Parallel to sessionCount.",
    domain: "crm",
    format: "integer",
    source: "fullmind_crm",
    queryable: true,
  },
```

- [ ] **Step 2: Verify existing exports still compile**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add subscriptionCount to DISTRICT_FINANCIALS_COLUMNS (PR #109 gap)"
```

---

## Task 6: Extend `ColumnDomain` and `DataSource` type unions

**Files:**
- Modify: `src/lib/district-column-metadata.ts:6-45` (type union definitions near the top of the file)

- [ ] **Step 1: Extend `ColumnDomain`**

In `src/lib/district-column-metadata.ts`, replace the existing `ColumnDomain` type (around line 6) with:

```typescript
export type ColumnDomain =
  // District-specific domains (existing)
  | "core"
  | "crm"
  | "finance"
  | "poverty"
  | "graduation"
  | "staffing"
  | "demographics"
  | "absenteeism"
  | "assessment"
  | "sped"
  | "esser"
  | "tech_capital"
  | "outsourcing"
  | "trends"
  | "benchmarks"
  | "icp"
  | "links"
  | "user_edits"
  // Cross-table domains (new for TABLE_REGISTRY)
  | "opportunity"
  | "session"
  | "subscription"
  | "activity"
  | "plan"
  | "contact"
  | "task"
  | "vacancy"
  | "school"
  | "state"
  | "history"
  | "unmatched"
  | "audit";
```

- [ ] **Step 2: Extend `DataSource`**

Replace the existing `DataSource` type (around line 38) with:

```typescript
export type DataSource =
  | "nces"
  | "urban_institute"
  | "fullmind_crm"
  | "computed"
  | "user"
  | "govspend"
  | "etl_link"
  // New sources
  | "opensearch"       // opportunities, sessions (Railway scheduler sync)
  | "elevate_k12"      // subscriptions (Elevate import pipeline)
  | "scraper"          // vacancies, vacancy_scans
  | "query_tool";      // query_log, saved_reports
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors. (Existing code only references domain/source values that already exist.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): extend ColumnDomain and DataSource type unions"
```

---

## Task 7: Define `TABLE_REGISTRY` / `SEMANTIC_CONTEXT` interfaces and empty scaffold

**Files:**
- Modify: `src/lib/district-column-metadata.ts` (append new interfaces and empty exports at the end of the file, before the `formatFiscalYear` helper)

This task creates the type contracts and an empty scaffold that the next tasks populate.

- [ ] **Step 1: Add the new interfaces**

Append to `src/lib/district-column-metadata.ts` (after the `KnownVendor` type definition, around line 1278):

```typescript
// ============================================================================
// Table Registry & Semantic Context
// ============================================================================
// Consumed by the Claude query engine (MAP-5) and MCP server (MAP-4) to
// generate system-prompt context for natural-language-to-SQL translation.
// See Docs/superpowers/specs/2026-04-11-db-readiness-query-tool.md.

export interface TableRelationship {
  /** Target table (physical table name) */
  toTable: string;
  /** Cardinality */
  type: "one-to-many" | "many-to-one" | "many-to-many";
  /** Literal SQL fragment Claude can drop into a JOIN clause */
  joinSql: string;
  /** One-line human description */
  description: string;
}

export interface TableMetadata {
  /** Physical table name (matches @@map in Prisma schema) */
  table: string;
  /** One-line table purpose */
  description: string;
  /** Primary key field(s). Single string for scalar PK, array for composite */
  primaryKey: string | string[];
  /** Reference to the per-table columns array (empty [] for pure-FK junction tables) */
  columns: ColumnMetadata[];
  /** Columns excluded from the Claude-facing schema (e.g., geometry, PII) */
  excludedColumns?: string[];
  /** Joins out of this table */
  relationships: TableRelationship[];
  /** Table-specific warnings (in addition to cross-table warnings in SEMANTIC_CONTEXT) */
  warnings?: string[];
}

export interface ConceptMapping {
  /** The canonical aggregated expression (preferred) */
  aggregated?: string;
  /** The deal-level / raw-table expression (fallback when aggregation isn't granular enough) */
  dealLevel?: string;
  /** Free-form notes */
  note?: string;
}

export interface FormatMismatch {
  /** The concept that has inconsistent formats across tables (e.g., "fiscal year") */
  concept: string;
  /** Per-table format descriptions */
  tables?: Record<string, string>;
  /** SQL expression for converting between formats, if straightforward */
  conversionSql?: string;
  /** Additional notes */
  note?: string;
}

export interface Warning {
  /** Tables whose presence in a query triggers this warning */
  triggerTables: string[];
  /** "mandatory" warnings MUST be injected into Claude's system prompt verbatim */
  severity: "mandatory" | "informational";
  /** The warning text Claude sees */
  message: string;
}

export interface SemanticContext {
  /** Named business concepts → SQL expressions */
  conceptMappings: Record<string, ConceptMapping>;
  /** Cross-table format inconsistencies */
  formatMismatches: FormatMismatch[];
  /** Trigger-based warnings */
  warnings: Warning[];
  /** Tables NOT exposed to the query tool */
  excludedTables: string[];
}
```

- [ ] **Step 2: Add empty `TABLE_REGISTRY` and `SEMANTIC_CONTEXT` exports**

Append after the interfaces:

```typescript
/**
 * Registry of every queryable table. Populated table-by-table in tasks 11–26.
 * Every Prisma model must be either in this registry or in
 * SEMANTIC_CONTEXT.excludedTables (enforced by the schema coverage test).
 */
export const TABLE_REGISTRY: Record<string, TableMetadata> = {};

/**
 * Cross-table semantic knowledge — concept mappings, format mismatches, and
 * warnings that are too broad for per-column description fields.
 */
export const SEMANTIC_CONTEXT: SemanticContext = {
  conceptMappings: {},
  formatMismatches: [],
  warnings: [],
  excludedTables: [],
};
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add TABLE_REGISTRY and SEMANTIC_CONTEXT scaffold"
```

---

## Task 8: Write failing test — schema coverage

**Files:**
- Create: `src/lib/__tests__/district-column-metadata.test.ts`

This task writes the coverage test FIRST. It will fail until the registry is populated.

- [ ] **Step 1: Create the test file with the schema coverage test**

Create `src/lib/__tests__/district-column-metadata.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  TABLE_REGISTRY,
  SEMANTIC_CONTEXT,
  DISTRICT_COLUMNS,
  DISTRICT_FINANCIALS_COLUMNS,
  COLUMN_BY_FIELD,
  FINANCIALS_COLUMN_BY_FIELD,
  KNOWN_VENDORS,
  formatFiscalYear,
} from "../district-column-metadata";

// Parse prisma/schema.prisma to extract model → table name mappings.
// Returns a map of { prismaModelName: physicalTableName }.
function parsePrismaModels(): Map<string, string> {
  const schemaPath = join(__dirname, "../../../prisma/schema.prisma");
  const schema = readFileSync(schemaPath, "utf-8");
  const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
  const models = new Map<string, string>();

  let match: RegExpExecArray | null;
  while ((match = modelRegex.exec(schema)) !== null) {
    const modelName = match[1];
    const body = match[2];
    const mapMatch = body.match(/@@map\("(\w+)"\)/);
    const tableName = mapMatch ? mapMatch[1] : modelName;
    models.set(modelName, tableName);
  }

  return models;
}

describe("district-column-metadata", () => {
  describe("schema coverage", () => {
    it("every Prisma model is either in TABLE_REGISTRY or SEMANTIC_CONTEXT.excludedTables", () => {
      const models = parsePrismaModels();
      const tableNames = Array.from(models.values());

      const registered = new Set(Object.keys(TABLE_REGISTRY));
      const excluded = new Set(SEMANTIC_CONTEXT.excludedTables);

      const missing = tableNames.filter(
        (t) => !registered.has(t) && !excluded.has(t),
      );

      expect(missing, `Tables missing from both TABLE_REGISTRY and excludedTables: ${missing.join(", ")}`).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:
```bash
npm test -- district-column-metadata
```

Expected: **FAIL** with a list of ~44 tables missing from both sets. This is correct — we haven't populated `TABLE_REGISTRY` or `excludedTables` yet.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/lib/__tests__/district-column-metadata.test.ts
git commit -m "test(metadata): add failing schema coverage test"
```

---

## Task 9: Write failing test — column existence

**Files:**
- Modify: `src/lib/__tests__/district-column-metadata.test.ts`

- [ ] **Step 1: Add the column existence test**

In `src/lib/__tests__/district-column-metadata.test.ts`, append inside the outermost `describe` block:

```typescript
  describe("column existence", () => {
    it("every ColumnMetadata.column in per-table arrays maps to a real Prisma field", () => {
      const schemaPath = join(__dirname, "../../../prisma/schema.prisma");
      const schema = readFileSync(schemaPath, "utf-8");

      // Parse {tableName: Set<columnName>} from Prisma schema
      const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
      const tableColumns = new Map<string, Set<string>>();

      let match: RegExpExecArray | null;
      while ((match = modelRegex.exec(schema)) !== null) {
        const body = match[1] + match[2];
        const mapMatch = body.match(/@@map\("(\w+)"\)/);
        if (!mapMatch) continue;
        const tableName = mapMatch[1];

        const columns = new Set<string>();
        // Match column declarations: either explicit @map("snake_name") or the
        // Prisma field name (camelCase, which Prisma auto-snakes to snake_case)
        // For our file we only need to match @map(...) values since snake_case
        // columns use @map. Field-name-only columns match their own name.
        const fieldRegex = /^\s*(\w+)\s+\w+.*?(?:@map\("(\w+)"\))?/gm;
        let fm: RegExpExecArray | null;
        while ((fm = fieldRegex.exec(match[2])) !== null) {
          const fieldName = fm[1];
          const mappedName = fm[2];
          // Skip Prisma keywords
          if (["model", "map", "index", "unique", "id", "relation", "default"].includes(fieldName)) continue;
          columns.add(mappedName ?? fieldName);
        }
        tableColumns.set(tableName, columns);
      }

      // Check every populated table in the registry
      const errors: string[] = [];
      for (const [tableName, meta] of Object.entries(TABLE_REGISTRY)) {
        if (meta.columns.length === 0) continue; // junction tables with empty columns
        const realColumns = tableColumns.get(tableName);
        if (!realColumns) {
          errors.push(`TABLE_REGISTRY entry '${tableName}' has no matching Prisma model`);
          continue;
        }
        for (const col of meta.columns) {
          if (!realColumns.has(col.column)) {
            errors.push(`${tableName}.${col.column} (${col.field}) does not exist in Prisma model`);
          }
        }
      }

      expect(errors, `Column existence errors:\n${errors.join("\n")}`).toEqual([]);
    });
  });
```

- [ ] **Step 2: Run the test**

Run:
```bash
npm test -- district-column-metadata
```

Expected: still FAILS on the schema coverage test (the column test itself will pass because the registry is still empty — no populated entries to check). That's fine. The test is in place for when we populate.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/district-column-metadata.test.ts
git commit -m "test(metadata): add column existence test"
```

---

## Task 10: Write failing test — relationship integrity + warning trigger check + existing-lookups sanity

**Files:**
- Modify: `src/lib/__tests__/district-column-metadata.test.ts`

- [ ] **Step 1: Append the remaining tests**

Append inside the outermost `describe` block:

```typescript
  describe("relationship integrity", () => {
    it("every TableRelationship.toTable is in TABLE_REGISTRY", () => {
      const errors: string[] = [];
      for (const [from, meta] of Object.entries(TABLE_REGISTRY)) {
        for (const rel of meta.relationships) {
          if (!TABLE_REGISTRY[rel.toTable]) {
            errors.push(`${from} → ${rel.toTable}: target table not in TABLE_REGISTRY`);
          }
        }
      }
      expect(errors, errors.join("\n")).toEqual([]);
    });
  });

  describe("warning triggers", () => {
    it("every Warning.triggerTables entry exists in TABLE_REGISTRY", () => {
      const errors: string[] = [];
      for (const warning of SEMANTIC_CONTEXT.warnings) {
        for (const t of warning.triggerTables) {
          if (!TABLE_REGISTRY[t]) {
            errors.push(`Warning trigger '${t}' not in TABLE_REGISTRY`);
          }
        }
      }
      expect(errors, errors.join("\n")).toEqual([]);
    });
  });

  describe("excluded tables don't overlap with registry", () => {
    it("no table appears in both TABLE_REGISTRY and excludedTables", () => {
      const registered = new Set(Object.keys(TABLE_REGISTRY));
      const overlap = SEMANTIC_CONTEXT.excludedTables.filter((t) => registered.has(t));
      expect(overlap, `Tables in both registry and excluded: ${overlap.join(", ")}`).toEqual([]);
    });
  });

  describe("existing exports still work", () => {
    it("DISTRICT_COLUMNS contains the 'leaid' column", () => {
      expect(DISTRICT_COLUMNS.find((c) => c.field === "leaid")).toBeDefined();
    });

    it("DISTRICT_FINANCIALS_COLUMNS contains both sessionCount and subscriptionCount", () => {
      expect(DISTRICT_FINANCIALS_COLUMNS.find((c) => c.field === "sessionCount")).toBeDefined();
      expect(DISTRICT_FINANCIALS_COLUMNS.find((c) => c.field === "subscriptionCount")).toBeDefined();
    });

    it("COLUMN_BY_FIELD and FINANCIALS_COLUMN_BY_FIELD are populated", () => {
      expect(COLUMN_BY_FIELD.get("leaid")).toBeDefined();
      expect(FINANCIALS_COLUMN_BY_FIELD.get("totalRevenue")).toBeDefined();
    });

    it("KNOWN_VENDORS includes fullmind", () => {
      expect(KNOWN_VENDORS).toContain("fullmind");
    });

    it("formatFiscalYear pads single-digit years", () => {
      expect(formatFiscalYear(26)).toBe("FY26");
      expect(formatFiscalYear("5")).toBe("FY05");
      expect(formatFiscalYear("FY26")).toBe("FY26");
    });
  });
```

- [ ] **Step 2: Run the tests**

Run:
```bash
npm test -- district-column-metadata
```

Expected: schema coverage test FAILS (44 missing tables), everything else PASSES (empty registry → nothing to check for the integrity tests; existing lookups work).

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/district-column-metadata.test.ts
git commit -m "test(metadata): add relationship, warning, and existing-export tests"
```

---

## ⚠️ Interactive Section Begins

**Tasks 11–26 must run interactively with the user, NOT via subagent.** See the warning at the top of this plan. The pattern for each interactive task is:

1. **Prompt the user with the listed questions.** Wait for answers. Do not skip.
2. **Draft the column array + registry entry based on the answers.**
3. **Show the draft to the user inline.** Let them correct.
4. **Write to the file. Run the tests. Commit.**

If running in subagent-driven mode, pause, execute the task in the main session, then resume.

---

## Task 11: Populate `districts` in `TABLE_REGISTRY`

**Files:**
- Modify: `src/lib/district-column-metadata.ts` (inside `TABLE_REGISTRY` object)

**Prompt the user:**
> For the `districts` table (our main 13K-row hub), I need to confirm the relationships and description. I'll use `DISTRICT_COLUMNS` as-is since it's already authored. Questions:
> 1. Top-line description for Claude — does "~13K US school districts with demographics, education metrics, staffing, ICP scores, and Fullmind CRM state" capture it, or do you want it framed differently?
> 2. Which PostGIS columns should be excluded from Claude's view? I have `geometry`, `centroid`, `point_location`. Any others?
> 3. Any table-level warnings Claude should see every time it queries districts? (e.g., "always filter by stateAbbrev for perf when possible")

- [ ] **Step 1: Run the prompt**

Wait for user answers.

- [ ] **Step 2: Add the registry entry**

In `src/lib/district-column-metadata.ts`, inside the empty `TABLE_REGISTRY` object, add:

```typescript
  districts: {
    table: "districts",
    description: "<user-confirmed description>",
    primaryKey: "leaid",
    columns: DISTRICT_COLUMNS,
    excludedColumns: ["geometry", "centroid", "point_location" /* + user additions */],
    relationships: [
      {
        toTable: "district_financials",
        type: "one-to-many",
        joinSql: "district_financials.leaid = districts.leaid",
        description: "Financial data by vendor and fiscal year",
      },
      {
        toTable: "opportunities",
        type: "one-to-many",
        joinSql: "opportunities.district_lea_id = districts.leaid",
        description: "Individual Fullmind deal records (FK added in PR #108)",
      },
      {
        toTable: "contacts",
        type: "one-to-many",
        joinSql: "contacts.leaid = districts.leaid",
        description: "People at the district",
      },
      {
        toTable: "activity_districts",
        type: "one-to-many",
        joinSql: "activity_districts.district_leaid = districts.leaid",
        description: "Junction to activities (join activities via activity_id)",
      },
      {
        toTable: "territory_plan_districts",
        type: "one-to-many",
        joinSql: "territory_plan_districts.district_leaid = districts.leaid",
        description: "Junction to territory plans (join territory_plans via plan_id)",
      },
      {
        toTable: "schools",
        type: "one-to-many",
        joinSql: "schools.leaid = districts.leaid",
        description: "Schools in this district",
      },
      {
        toTable: "district_data_history",
        type: "one-to-many",
        joinSql: "district_data_history.leaid = districts.leaid",
        description: "Year-over-year historical snapshots",
      },
      {
        toTable: "district_grade_enrollment",
        type: "one-to-many",
        joinSql: "district_grade_enrollment.leaid = districts.leaid",
        description: "Grade-level enrollment per year",
      },
      {
        toTable: "vacancies",
        type: "one-to-many",
        joinSql: "vacancies.leaid = districts.leaid",
        description: "Scraped job postings",
      },
      {
        toTable: "states",
        type: "many-to-one",
        joinSql: "states.fips = districts.state_fips",
        description: "State name, abbreviation, and aggregates",
      },
    ],
    warnings: [/* user-supplied, or omit if empty */],
  },
```

- [ ] **Step 3: Run the tests**

```bash
npm test -- district-column-metadata
```

Expected: `relationship integrity` test FAILS because `district_financials`, `opportunities`, etc. are referenced but not yet in registry. Keep going; this will resolve as we add more tables.

- [ ] **Step 4: Commit**

```bash
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add districts to TABLE_REGISTRY"
```

---

## Task 12: Populate `district_financials` + bootstrap `SEMANTIC_CONTEXT`

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

This is the first task that also populates `SEMANTIC_CONTEXT`, since `district_financials` is where most concept mappings terminate.

**Prompt the user:**
> Now `district_financials`. This is where Claude should go for most revenue questions. Questions:
> 1. Description — "Aggregated financial metrics per district per vendor per fiscal year" — good, or refine?
> 2. For the `vendor` column, the known values are `fullmind`, `elevate`, `proximity`, `tbt`. Any others Claude should know about?
> 3. Concept mapping check — when a rep asks about "bookings", should Claude always use `closed_won_bookings WHERE vendor='fullmind'`, or are there cases where deal-level from opportunities is better?
> 4. Same for "pipeline", "revenue", "take rate" — what's the canonical aggregated path, and when should Claude fall through to opportunities/subscriptions?
> 5. Should I add a table-level warning about the "joining district_financials to opportunities will double-count if you sum both" trap?

- [ ] **Step 1: Run the prompt**

Wait for user answers.

- [ ] **Step 2: Add the registry entry**

Add to `TABLE_REGISTRY` (after `districts`):

```typescript
  district_financials: {
    table: "district_financials",
    description: "<user-confirmed>",
    primaryKey: "id",
    columns: DISTRICT_FINANCIALS_COLUMNS,
    relationships: [
      {
        toTable: "districts",
        type: "many-to-one",
        joinSql: "district_financials.leaid = districts.leaid",
        description: "Parent district",
      },
      {
        toTable: "unmatched_accounts",
        type: "many-to-one",
        joinSql: "district_financials.unmatched_account_id = unmatched_accounts.id",
        description: "ETL-unmatched account (alternative to leaid)",
      },
    ],
    warnings: [/* user-supplied */],
  },
```

- [ ] **Step 3: Bootstrap `SEMANTIC_CONTEXT.conceptMappings`**

Replace the empty `SEMANTIC_CONTEXT` export with the populated concept mappings based on user answers. Use the spec's starter content as a reference but treat user answers as canonical:

```typescript
export const SEMANTIC_CONTEXT: SemanticContext = {
  conceptMappings: {
    bookings: {
      aggregated: "district_financials.closed_won_bookings WHERE vendor='fullmind'",
      dealLevel: "SUM(opportunities.net_booking_amount) filtered by closed-won stage convention (see stage format-mismatch below)",
      note: "<user note>",
    },
    pipeline: {
      aggregated: "district_financials.open_pipeline",
      dealLevel: "SUM(opportunities.net_booking_amount) WHERE numeric stage prefix BETWEEN 0 AND 5",
      note: "<user note>",
    },
    revenue: {
      aggregated: "district_financials.total_revenue (aggregates session-derived + subscription sources)",
      dealLevel: "opportunities.completed_revenue + scheduled_revenue for legacy Fullmind; SUM(subscriptions.net_total) for Elevate K12",
      note: "<user note — verify the three-source framing>",
    },
    our_data: {
      note: "<user note>",
    },
    customers: {
      note: "<user note>",
    },
    subscription_revenue: {
      aggregated: "SUM(subscriptions.net_total) joined via subscriptions.opportunity_id → opportunities.id → o.district_lea_id",
      note: "<user note — signed values, credits negative>",
    },
  },
  formatMismatches: [],
  warnings: [],
  excludedTables: [],
};
```

- [ ] **Step 4: Run tests**

```bash
npm test -- district-column-metadata
```

Expected: schema coverage test still FAILS (more tables to go), everything else PASSES.

- [ ] **Step 5: Commit**

```bash
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add district_financials registry entry and concept mappings"
```

---

## Task 13: Populate `opportunities` — column array + registry + stage warning + EK12 warning

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

This is one of the most business-critical tables. Takes the most Q&A time. Also the first task that adds a mandatory warning.

**Prompt the user:**
> Now the `opportunities` table — deal-level CRM records. I need to understand several columns that aren't obvious from the schema:
>
> 1. **stage** — I know the two conventions (numeric prefix + text labels). Canonical closed-won CASE expression from `refresh_fullmind_financials()`:
>    ```sql
>    CASE WHEN stage ~ '^\d' THEN (regexp_match(stage, '^(\d+)'))[1]::int >= 6
>         WHEN LOWER(stage) IN ('closed won','active','position purchased','requisition received','return position pending') THEN TRUE
>         ELSE FALSE END
>    ```
>    Should Claude see this exact CASE in the stage column description, or put it only in the mandatory warning?
> 2. **contractType** — what are the known values? I see `lower(o.contract_type) LIKE '%renewal%'` / `'%winback%'` / `'%expansion%'` / else `new_business` in the matview. Any edge cases to note?
> 3. **schoolYr** — format is 'YYYY-YY' (e.g., '2025-26'). That's different from district_financials.fiscal_year ('FYNN'). Should I point this out in the column description or only in the format-mismatch list?
> 4. **totalRevenue / completedRevenue / scheduledRevenue / take columns** — are these ALWAYS session-derived, or are there cases where they're populated differently? The EK12 warning says EK12 deals have $0 here — is that 100%, or occasional?
> 5. **leadSource, paymentType, paymentTerms, fundingThrough** — are any of these interesting for natural-language queries? Or is it fine to mark `queryable: false`?
> 6. **salesRepName vs salesRepEmail vs salesRepId** — which does the team actually filter on? (salesRepId UUID FK exists but has no Prisma relation yet.)
> 7. **brandAmbassador** — what is this column used for?
> 8. **stage_history** Json blob — any value exposing this to Claude, or skip?
> 9. Beyond the stage convention + EK12 quirk already in the spec, any other landmines?

- [ ] **Step 1: Run the prompt**

Wait for user answers.

- [ ] **Step 2: Add `OPPORTUNITY_COLUMNS`**

Based on answers, add a new export above `TABLE_REGISTRY`:

```typescript
export const OPPORTUNITY_COLUMNS: ColumnMetadata[] = [
  // ... user-informed entries
];
```

- [ ] **Step 3: Add `opportunities` to `TABLE_REGISTRY`**

```typescript
  opportunities: {
    table: "opportunities",
    description: "<user-confirmed>",
    primaryKey: "id",
    columns: OPPORTUNITY_COLUMNS,
    relationships: [
      {
        toTable: "districts",
        type: "many-to-one",
        joinSql: "opportunities.district_lea_id = districts.leaid",
        description: "Parent district (FK added PR #108)",
      },
      {
        toTable: "sessions",
        type: "one-to-many",
        joinSql: "sessions.opportunity_id = opportunities.id",
        description: "Individual session records (soft FK — see historical gap warning)",
      },
      {
        toTable: "subscriptions",
        type: "one-to-many",
        joinSql: "subscriptions.opportunity_id = opportunities.id",
        description: "Elevate K12 subscription line items",
      },
      {
        toTable: "activity_opportunities",
        type: "one-to-many",
        joinSql: "activity_opportunities.opportunity_id = opportunities.id",
        description: "Junction to activities",
      },
    ],
  },
```

- [ ] **Step 4: Add the stage format-mismatch entry to SEMANTIC_CONTEXT**

```typescript
  formatMismatches: [
    {
      concept: "fiscal year",
      tables: {
        opportunities: "school_yr text 'YYYY-YY' e.g., '2025-26'",
        district_financials: "fiscal_year text 'FYNN' e.g., 'FY26'",
        territory_plans: "fiscal_year integer e.g., 2026",
      },
      conversionSql: "SUBSTRING(opportunities.school_yr, 6, 2) = SUBSTRING(district_financials.fiscal_year, 3, 2)",
    },
    {
      concept: "opportunity stage",
      note: "opportunities.stage has TWO conventions. Legacy numeric prefix: '0 - Lead' through '6 - Closed Won'. Text labels (Elevate K12 + newer Salesforce): 'Closed Won', 'Active', 'Position Purchased', 'Requisition Received', 'Return Position Pending' are all closed-won; 'Closed Lost' is closed-lost. Canonical closed-won expression: CASE WHEN stage ~ '^\\d' THEN (regexp_match(stage, '^(\\d+)'))[1]::int >= 6 WHEN LOWER(stage) IN ('closed won','active','position purchased','requisition received','return position pending') THEN TRUE ELSE FALSE END.",
    },
  ],
```

- [ ] **Step 5: Add the mandatory stage warning**

```typescript
  warnings: [
    {
      triggerTables: ["opportunities"],
      severity: "mandatory",
      message: "STAGE CONVENTION: opportunities.stage has two conventions and a query that filters only on numeric prefixes misses ~$68.8M of closed-won bookings. Use the canonical closed-won CASE expression from the formatMismatches list (see 'opportunity stage'). When in doubt, prefer district_financials.closed_won_bookings WHERE vendor='fullmind' which handles both conventions upstream via refresh_fullmind_financials().",
    },
  ],
```

- [ ] **Step 6: Run tests**

```bash
npm test -- district-column-metadata
```

Expected: schema coverage test still FAILS (more tables needed), relationship test may FAIL (sessions, subscriptions, activity_opportunities not in registry yet). Keep going.

- [ ] **Step 7: Commit**

```bash
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add opportunities registry entry, stage format mismatch and warning"
```

---

## Task 14: Populate `sessions` — column array + registry + historical gap warning

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

**Prompt the user:**
> `sessions` is the service-delivery unit. Questions:
>
> 1. Description — "Per-session records from OpenSearch; one row per tutoring session delivered". Good, or refine?
> 2. Which columns matter for NL queries? I see `opportunityId`, `serviceType`, `sessionPrice`, `educatorPrice`, `educatorApprovedPrice`, `startTime`, `type`, `status`, `serviceName`. Any to drop as `queryable: false`?
> 3. `type` vs `serviceType` — what's the difference?
> 4. `status` — known values?
> 5. `sessionPrice` vs `educatorPrice` — which is "revenue" and which is "cost"? Margin = sessionPrice - educatorPrice?
> 6. The 33% historical orphan gap — I'll add the mandatory warning. Any wording changes to the message in the spec, or ship as-is?

- [ ] **Step 1: Run the prompt**

Wait for answers.

- [ ] **Step 2: Add `SESSION_COLUMNS`**

```typescript
export const SESSION_COLUMNS: ColumnMetadata[] = [
  // user-informed entries
];
```

- [ ] **Step 3: Add `sessions` to `TABLE_REGISTRY`**

```typescript
  sessions: {
    table: "sessions",
    description: "<user-confirmed>",
    primaryKey: "id",
    columns: SESSION_COLUMNS,
    relationships: [
      {
        toTable: "opportunities",
        type: "many-to-one",
        joinSql: "sessions.opportunity_id = opportunities.id",
        description: "Parent opportunity (SOFT FK — 33% of historical sessions have orphaned opportunity_ids)",
      },
    ],
  },
```

- [ ] **Step 4: Add the historical gap warning**

Append to `SEMANTIC_CONTEXT.warnings`:

```typescript
    {
      triggerTables: ["sessions"],
      severity: "mandatory",
      message: "HISTORICAL DATA GAP: 95,345 sessions (33% of all sessions) have opportunity_id values that don't match any row in the opportunities table, concentrated in FY19–FY23 (~94K of 95K orphans). Cause: the OpenSearch opportunity sync is recency-filtered while the session sync is not. Any query joining sessions to opportunities will UNDER-COUNT historical revenue. When the user asks about session data older than FY24, you MUST surface a caveat in your insight noting this gap. Tracked in Docs/superpowers/followups/2026-04-11-opportunity-sync-historical-gap.md.",
    },
```

- [ ] **Step 5: Run tests**

```bash
npm test -- district-column-metadata
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add sessions registry entry and historical gap warning"
```

---

## Task 15: Populate `subscriptions` — column array + registry + EK12 warning

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

**Prompt the user:**
> `subscriptions` is the Elevate K12 line-item table added in PR #109. Questions:
>
> 1. Description — "Elevate K12 subscription line items, acquired post-merger. Parallel to sessions — both feed refresh_fullmind_financials() into vendor='fullmind' rows in district_financials." Good?
> 2. **netTotal can be negative** (credits). Does Claude need to know that? Any gotchas around summing them (e.g., should we always `SUM(net_total)` not `SUM(ABS(net_total))`)?
> 3. **quantity** — same question, can be negative?
> 4. Which other columns matter for NL queries? `product`, `productType`, `subProduct`, `courseName`, `curriculumProvider`, `grade`, `startDate`, `deliveryEndDate`, `contractOwnerName` — any of these high-signal?
> 5. `schoolName` is a string, not an FK — should Claude know there's no direct school join?
> 6. Is the EK12 warning message in the spec accurate and well-worded? I'm planning to trigger it on both `opportunities` and `subscriptions`.

- [ ] **Step 1: Run the prompt**

Wait for answers.

- [ ] **Step 2: Add `SUBSCRIPTION_COLUMNS`**

```typescript
export const SUBSCRIPTION_COLUMNS: ColumnMetadata[] = [
  // user-informed entries
];
```

- [ ] **Step 3: Add `subscriptions` to `TABLE_REGISTRY`**

```typescript
  subscriptions: {
    table: "subscriptions",
    description: "<user-confirmed>",
    primaryKey: "id",
    columns: SUBSCRIPTION_COLUMNS,
    relationships: [
      {
        toTable: "opportunities",
        type: "many-to-one",
        joinSql: "subscriptions.opportunity_id = opportunities.id",
        description: "Parent opportunity (FK cascade delete)",
      },
    ],
  },
```

- [ ] **Step 4: Add the EK12 mandatory warning**

Append to `SEMANTIC_CONTEXT.warnings`:

```typescript
    {
      triggerTables: ["opportunities", "subscriptions"],
      severity: "mandatory",
      message: "EK12 REVENUE QUIRK: Elevate K12 opportunities have $0 in their session-derived revenue columns (completed_revenue, scheduled_revenue, total_revenue, completed_take, scheduled_take, total_take). Their real revenue lives in the subscriptions table via SUM(subscriptions.net_total). A query that asks 'what's this rep's FY26 revenue' and reads only opportunities.total_revenue will return $0 for every EK12 rep despite millions in contracted subscription revenue. ALWAYS prefer district_financials (vendor='fullmind') for revenue totals because the ETL rolls in both session AND subscription sources. If you must query opportunities directly, join subscriptions on opportunity_id and sum net_total. 'Take' has no subscription analog — any take-rate query reflects session-derived deals only.",
    },
```

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- district-column-metadata
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add subscriptions registry entry and EK12 revenue warning"
```

---

## Task 16: Populate `activities` + junction tables

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

**Prompt the user:**
> `activities` is the sales-workflow table. Questions:
>
> 1. The `type` column has ~20 values (conference, road_trip, dinner, happy_hour, school_site_visit, fun_and_games, mixmax_campaign, discovery_call, program_check_in, proposal_review, renewal_conversation, gift_drop, booth_exhibit, conference_sponsor, meal_reception, charity_event, webinar, speaking_engagement, professional_development, course, sponsorships). All of these still active? Any legacy ones Claude should NOT surface?
> 2. `status` values — planned, requested, planning, in_progress, wrapping_up, completed, cancelled. Is there a standard "active" vs "done" split Claude should know about?
> 3. `outcome` + `outcomeType` + `rating` — reps fill these in when activities complete. What are the `outcomeType` known values? (positive_progress, neutral, negative, follow_up_needed per the spec — accurate?)
> 4. `source` column — manual, calendar_sync, gmail?, slack?. What else?
> 5. The Mixmax fields (`mixmaxSequenceName`, `mixmaxStatus`, `mixmaxOpenCount`, `mixmaxClickCount`) — Mixmax was removed per a recent cleanup. Should Claude even see these?
> 6. `integrationMeta` and `metadata` JSON blobs — expose to Claude or hide?
> 7. Cost data lives in `activity_expenses` — how should Claude think about "what did we spend on activities in Q3"? Always join via activity_id?

- [ ] **Step 1: Run the prompt**

- [ ] **Step 2: Add `ACTIVITY_COLUMNS`**

```typescript
export const ACTIVITY_COLUMNS: ColumnMetadata[] = [
  // user-informed
];
```

- [ ] **Step 3: Add `activities` to `TABLE_REGISTRY` with all junction relationships**

```typescript
  activities: {
    table: "activities",
    description: "<user-confirmed>",
    primaryKey: "id",
    columns: ACTIVITY_COLUMNS,
    relationships: [
      { toTable: "activity_districts", type: "one-to-many", joinSql: "activity_districts.activity_id = activities.id", description: "Junction to districts" },
      { toTable: "activity_plans", type: "one-to-many", joinSql: "activity_plans.activity_id = activities.id", description: "Junction to territory plans" },
      { toTable: "activity_contacts", type: "one-to-many", joinSql: "activity_contacts.activity_id = activities.id", description: "Junction to contacts" },
      { toTable: "activity_states", type: "one-to-many", joinSql: "activity_states.activity_id = activities.id", description: "Junction to states" },
      { toTable: "activity_opportunities", type: "one-to-many", joinSql: "activity_opportunities.activity_id = activities.id", description: "Junction to opportunities" },
      { toTable: "activity_expenses", type: "one-to-many", joinSql: "activity_expenses.activity_id = activities.id", description: "Expense line items" },
      { toTable: "activity_attendees", type: "one-to-many", joinSql: "activity_attendees.activity_id = activities.id", description: "Internal users attending" },
    ],
  },
```

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- district-column-metadata
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add activities registry entry"
```

---

## Task 17: Populate `territory_plans` + `territory_plan_districts`

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

**Prompt the user:**
> `territory_plans` and `territory_plan_districts`. Questions:
>
> 1. `territory_plans.fiscalYear` is Int (e.g., 2026), not 'FY26'. I'll note the format mismatch. Any other gotchas?
> 2. `status` values — planning, active, archived? Or something else?
> 3. The four target columns on `territory_plan_districts` (`renewalTarget`, `winbackTarget`, `expansionTarget`, `newBusinessTarget`) — what's the business meaning of each? Is there a canonical total ("total target = sum of all four")?
> 4. `ownerId` vs `userId` on `territory_plans` — what's the difference? Both FK to user_profiles.
> 5. The rollup columns (`districtCount`, `stateCount`, `renewalRollup`, etc.) — denormalized cache of junction sums. Should Claude use these or join through junctions?
> 6. Enrichment tracking fields — should Claude see them?

- [ ] **Step 1: Run the prompt**

- [ ] **Step 2: Add `TERRITORY_PLAN_COLUMNS` and `TERRITORY_PLAN_DISTRICT_COLUMNS`**

```typescript
export const TERRITORY_PLAN_COLUMNS: ColumnMetadata[] = [ /* ... */ ];
export const TERRITORY_PLAN_DISTRICT_COLUMNS: ColumnMetadata[] = [ /* ... */ ];
```

- [ ] **Step 3: Add both to `TABLE_REGISTRY`**

```typescript
  territory_plans: {
    table: "territory_plans",
    description: "<user-confirmed>",
    primaryKey: "id",
    columns: TERRITORY_PLAN_COLUMNS,
    relationships: [
      { toTable: "territory_plan_districts", type: "one-to-many", joinSql: "territory_plan_districts.plan_id = territory_plans.id", description: "Districts in this plan with per-district targets" },
      { toTable: "territory_plan_states", type: "one-to-many", joinSql: "territory_plan_states.plan_id = territory_plans.id", description: "States in this plan" },
      { toTable: "activity_plans", type: "one-to-many", joinSql: "activity_plans.plan_id = territory_plans.id", description: "Junction to activities" },
      { toTable: "task_plans", type: "one-to-many", joinSql: "task_plans.plan_id = territory_plans.id", description: "Junction to tasks" },
    ],
  },
  territory_plan_districts: {
    table: "territory_plan_districts",
    description: "<user-confirmed>",
    primaryKey: ["planId", "districtLeaid"],
    columns: TERRITORY_PLAN_DISTRICT_COLUMNS,
    relationships: [
      { toTable: "territory_plans", type: "many-to-one", joinSql: "territory_plan_districts.plan_id = territory_plans.id", description: "Parent plan" },
      { toTable: "districts", type: "many-to-one", joinSql: "territory_plan_districts.district_leaid = districts.leaid", description: "District in this plan" },
    ],
  },
```

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- district-column-metadata
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add territory_plans and territory_plan_districts registry entries"
```

---

## Task 18: Populate `contacts`

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

**Prompt the user:**
> `contacts` is the people-at-a-district table. Questions:
>
> 1. `persona` and `seniorityLevel` — known values? Does Claude need to see enums here?
> 2. `isPrimary` — one per district, or can there be multiple?
> 3. `lastEnrichedAt` — should Claude surface "stale contacts" questions?
> 4. School-level contacts live in `school_contacts` (junction to schools) — should I treat those as first-class or skip?

- [ ] **Step 1: Run the prompt**

- [ ] **Step 2: Add `CONTACT_COLUMNS` and registry entry**

```typescript
export const CONTACT_COLUMNS: ColumnMetadata[] = [ /* ... */ ];
```

```typescript
  contacts: {
    table: "contacts",
    description: "<user-confirmed>",
    primaryKey: "id",
    columns: CONTACT_COLUMNS,
    relationships: [
      { toTable: "districts", type: "many-to-one", joinSql: "contacts.leaid = districts.leaid", description: "Parent district" },
      { toTable: "activity_contacts", type: "one-to-many", joinSql: "activity_contacts.contact_id = contacts.id", description: "Junction to activities" },
      { toTable: "task_contacts", type: "one-to-many", joinSql: "task_contacts.contact_id = contacts.id", description: "Junction to tasks" },
      { toTable: "school_contacts", type: "one-to-many", joinSql: "school_contacts.contact_id = contacts.id", description: "Junction to schools" },
    ],
  },
```

- [ ] **Step 3: Commit**

```bash
npm test -- district-column-metadata
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add contacts registry entry"
```

---

## Task 19: Populate `tasks`

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

**Prompt the user:**
> `tasks` — the kanban-board task table. Questions:
>
> 1. `status` enum values — todo, in_progress, blocked, done?
> 2. `priority` enum values — low, medium, high, urgent?
> 3. `createdByUserId` vs `assignedToUserId` — reps often want "my tasks" which one is the filter?
> 4. `position` column is for kanban drag-drop ordering — should Claude even see it?

- [ ] **Step 1: Run the prompt**

- [ ] **Step 2: Add `TASK_COLUMNS` and registry entry**

```typescript
export const TASK_COLUMNS: ColumnMetadata[] = [ /* ... */ ];
```

```typescript
  tasks: {
    table: "tasks",
    description: "<user-confirmed>",
    primaryKey: "id",
    columns: TASK_COLUMNS,
    relationships: [
      { toTable: "task_districts", type: "one-to-many", joinSql: "task_districts.task_id = tasks.id", description: "Junction to districts" },
      { toTable: "task_plans", type: "one-to-many", joinSql: "task_plans.task_id = tasks.id", description: "Junction to plans" },
      { toTable: "task_activities", type: "one-to-many", joinSql: "task_activities.task_id = tasks.id", description: "Junction to activities" },
      { toTable: "task_contacts", type: "one-to-many", joinSql: "task_contacts.task_id = tasks.id", description: "Junction to contacts" },
    ],
  },
```

- [ ] **Step 3: Commit**

```bash
npm test -- district-column-metadata
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add tasks registry entry"
```

---

## Task 20: Populate `vacancies` + `vacancy_scans`

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

**Prompt the user:**
> Job vacancies scraped from district job boards. Questions:
>
> 1. `vacancies.category` known values — SPED, ELL, General Ed, Admin, Specialist, Counseling, Related Services, Other. Accurate?
> 2. `fullmindRelevant` flag — what's the business rule? Is there a `relevanceReason` column Claude should use to explain matches?
> 3. `status` — open, closed, expired. When Claude asks about "current vacancies" should it filter on `status='open'`?
> 4. `vacancy_scans` — audit table for scan runs. Does Claude ever need this, or skip entirely?
> 5. `VacancyKeywordConfig` is an admin config table — excluded, right?

- [ ] **Step 1: Run the prompt**

- [ ] **Step 2: Add `VACANCY_COLUMNS` and registry entries for both tables**

```typescript
export const VACANCY_COLUMNS: ColumnMetadata[] = [ /* ... */ ];
```

```typescript
  vacancies: {
    table: "vacancies",
    description: "<user-confirmed>",
    primaryKey: "id",
    columns: VACANCY_COLUMNS,
    relationships: [
      { toTable: "districts", type: "many-to-one", joinSql: "vacancies.leaid = districts.leaid", description: "Parent district" },
      { toTable: "schools", type: "many-to-one", joinSql: "vacancies.school_ncessch = schools.ncessch", description: "School if posting specifies one" },
      { toTable: "contacts", type: "many-to-one", joinSql: "vacancies.contact_id = contacts.id", description: "Hiring manager contact if matched" },
      { toTable: "vacancy_scans", type: "many-to-one", joinSql: "vacancies.scan_id = vacancy_scans.id", description: "The scan run that discovered this posting" },
    ],
  },
  vacancy_scans: {
    table: "vacancy_scans",
    description: "<user-confirmed, or empty if excluding>",
    primaryKey: "id",
    columns: [], // or populated array
    relationships: [
      { toTable: "districts", type: "many-to-one", joinSql: "vacancy_scans.leaid = districts.leaid", description: "Parent district" },
      { toTable: "vacancies", type: "one-to-many", joinSql: "vacancies.scan_id = vacancy_scans.id", description: "Vacancies found" },
    ],
  },
```

- [ ] **Step 3: Commit**

```bash
npm test -- district-column-metadata
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add vacancies and vacancy_scans registry entries"
```

---

## Task 21: Populate `schools` + `school_enrollment_history`

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

**Prompt the user:**
> `schools` — generic school table (supports charter + traditional public). Questions:
>
> 1. `charter` is 0/1 Int, not boolean. Point this out in the description?
> 2. `schoolLevel` Int — what are the values? (1=Primary, 2=Middle, 3=High, 4=Other per the spec — accurate?)
> 3. `schoolStatus` Int — 1=Open, 2=Closed. Any others?
> 4. `titleIStatus`, `titleIEligible`, `titleISchoolwide` Int columns — how should Claude interpret these for filtering?
> 5. `school_enrollment_history` — parallel to district_data_history. Claude use case?

- [ ] **Step 1: Run the prompt**

- [ ] **Step 2: Add `SCHOOL_COLUMNS` and registry entries**

- [ ] **Step 3: Commit**

```bash
npm test -- district-column-metadata
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add schools and school_enrollment_history registry entries"
```

---

## Task 22: Populate `states` + `state_assessments`

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

**Prompt the user:**
> `states` has denormalized aggregate columns. Questions:
>
> 1. The `totalDistricts`, `totalEnrollment`, `totalCustomers`, `totalPipelineValue` fields — are these refreshed real-time via ETL, or cached with lag? Should Claude always recompute from districts for accuracy?
> 2. `state_assessments` — reference table for state testing programs. Any interesting query angles? (e.g., "which states use SBAC" or "when is the FY26 testing window")
> 3. `territoryOwnerId` — rep who owns this state. Common filter target?

- [ ] **Step 1: Run the prompt**

- [ ] **Step 2: Add `STATE_COLUMNS` + `STATE_ASSESSMENT_COLUMNS` + registry entries**

- [ ] **Step 3: Commit**

```bash
npm test -- district-column-metadata
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add states and state_assessments registry entries"
```

---

## Task 23: Populate `district_data_history` + `district_grade_enrollment`

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

**Prompt the user:**
> Historical year-over-year data. Questions:
>
> 1. `district_data_history` has a `source` column with values like `ccd_directory`, `ccd_finance`, `saipe`, `edfacts_grad`, `edfacts_assess`. Should Claude know each source has different column coverage? (E.g., `ccd_finance` has revenue fields; `saipe` has poverty fields.)
> 2. How far back does history go? FY15? Earlier?
> 3. `district_grade_enrollment` — grade values are 'K', '01'..'12', 'PK', 'UG'. Anything else Claude should know?
> 4. Are these tables ever used for "trend" questions, or are the pre-computed trend columns on `districts` (e.g., `enrollmentTrend3yr`) the usual answer?

- [ ] **Step 1: Run the prompt**

- [ ] **Step 2: Add `DISTRICT_DATA_HISTORY_COLUMNS` + `DISTRICT_GRADE_ENROLLMENT_COLUMNS` + registry entries**

- [ ] **Step 3: Commit**

```bash
npm test -- district-column-metadata
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add district_data_history and grade enrollment registry entries"
```

---

## Task 24: Populate `unmatched_accounts` + `unmatched_opportunities`

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

**Prompt the user:**
> Unmatched data tables. Questions:
>
> 1. When does an account/opp end up unmatched? Just ETL lmsid/leaid lookup failure, or other reasons?
> 2. `unmatched_accounts.matchFailureReason` — what are the known values?
> 3. `unmatched_opportunities.reason` — same question.
> 4. `unmatched_opportunities.resolved` + `resolvedDistrictLeaid` — admin manually resolves. Claude should exclude unresolved ones from totals?
> 5. The spec says these tables "hold real revenue and pipeline" — is that true for both, or just `unmatched_accounts` (which joins to district_financials via `unmatched_account_id`)?
> 6. How should Claude word the caveat when including them in totals?

- [ ] **Step 1: Run the prompt**

- [ ] **Step 2: Add `UNMATCHED_ACCOUNT_COLUMNS` + `UNMATCHED_OPPORTUNITY_COLUMNS` + registry entries**

- [ ] **Step 3: Add the unmatched informational warning**

Append to `SEMANTIC_CONTEXT.warnings`:

```typescript
    {
      triggerTables: ["unmatched_accounts", "unmatched_opportunities"],
      severity: "informational",
      message: "<user-confirmed wording — these tables hold accounts/opportunities that did not match a district leaid during ETL. They contain real revenue and pipeline. Include them in totals when the user asks about company-wide numbers; join unmatched_accounts to district_financials via unmatched_account_id for FY-level revenue.>",
    },
```

- [ ] **Step 4: Commit**

```bash
npm test -- district-column-metadata
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add unmatched accounts/opportunities registry and warning"
```

---

## Task 25: Populate `query_log` + `saved_reports` registry entries (autonomous)

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

These are internal tables; no user Q&A needed.

- [ ] **Step 1: Add `QUERY_LOG_COLUMNS` and `SAVED_REPORT_COLUMNS`**

```typescript
export const QUERY_LOG_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "ID", description: "Auto-increment primary key", domain: "audit", format: "integer", source: "query_tool", queryable: true },
  { field: "userId", column: "user_id", label: "User ID", description: "UUID of the user who ran the query", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "conversationId", column: "conversation_id", label: "Conversation ID", description: "Groups queries into a single chat conversation", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "question", column: "question", label: "Question", description: "Natural-language question the user asked", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "sql", column: "sql", label: "Generated SQL", description: "SQL Claude generated (null for non-query actions)", domain: "audit", format: "text", source: "query_tool", queryable: false },
  { field: "rowCount", column: "row_count", label: "Row Count", description: "Number of rows returned", domain: "audit", format: "integer", source: "query_tool", queryable: true },
  { field: "executionTimeMs", column: "execution_time_ms", label: "Execution Time (ms)", description: "How long the SQL took to run", domain: "audit", format: "integer", source: "query_tool", queryable: true },
  { field: "error", column: "error", label: "Error", description: "Error message if the query failed", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "action", column: "action", label: "Action", description: "Action tool name for MAP-3 mutations (null for reads)", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "actionParams", column: "action_params", label: "Action Params", description: "JSON of the action parameters", domain: "audit", format: "text", source: "query_tool", queryable: false },
  { field: "actionSuccess", column: "action_success", label: "Action Success", description: "Whether the action executed successfully", domain: "audit", format: "boolean", source: "query_tool", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "When the query was logged", domain: "audit", format: "date", source: "query_tool", queryable: true },
];

export const SAVED_REPORT_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "ID", description: "Auto-increment primary key", domain: "audit", format: "integer", source: "query_tool", queryable: true },
  { field: "userId", column: "user_id", label: "User ID", description: "Owner of the saved report", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "title", column: "title", label: "Title", description: "Human-readable report title", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "question", column: "question", label: "Original Question", description: "The natural-language question that produced this SQL", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "sql", column: "sql", label: "Stored SQL", description: "SQL that gets re-executed when the report is run", domain: "audit", format: "text", source: "query_tool", queryable: false },
  { field: "isTeamPinned", column: "is_team_pinned", label: "Team Pinned", description: "Whether this report is pinned to the Team Reports tab", domain: "audit", format: "boolean", source: "query_tool", queryable: true },
  { field: "pinnedBy", column: "pinned_by", label: "Pinned By", description: "Admin who pinned the report (null if not pinned)", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "lastRunAt", column: "last_run_at", label: "Last Run At", description: "When the report was most recently executed", domain: "audit", format: "date", source: "query_tool", queryable: true },
  { field: "runCount", column: "run_count", label: "Run Count", description: "How many times the report has been executed", domain: "audit", format: "integer", source: "query_tool", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "When the report was saved", domain: "audit", format: "date", source: "query_tool", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "When the report was last modified", domain: "audit", format: "date", source: "query_tool", queryable: true },
];
```

- [ ] **Step 2: Add registry entries**

```typescript
  query_log: {
    table: "query_log",
    description: "Audit log of every natural-language query run through the Claude query tool, plus every agentic action executed.",
    primaryKey: "id",
    columns: QUERY_LOG_COLUMNS,
    relationships: [],
  },
  saved_reports: {
    table: "saved_reports",
    description: "User-saved query reports with stored SQL. Team-pinned reports are surfaced to all users. Re-running a report skips Claude entirely and re-executes the stored SQL.",
    primaryKey: "id",
    columns: SAVED_REPORT_COLUMNS,
    relationships: [],
  },
```

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- district-column-metadata
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add query_log and saved_reports registry entries"
```

---

## Task 26: Populate junction tables with empty column arrays (autonomous)

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

Junction tables get `columns: []` entries so they pass the schema coverage test without requiring interactive column descriptions.

- [ ] **Step 1: Add junction registry entries**

```typescript
  // === Junction tables (no column arrays — Claude navigates through relationships) ===

  district_tags: {
    table: "district_tags",
    description: "Junction between districts and tags.",
    primaryKey: ["districtLeaid", "tagId"],
    columns: [],
    relationships: [
      { toTable: "districts", type: "many-to-one", joinSql: "district_tags.district_leaid = districts.leaid", description: "District" },
      { toTable: "tags", type: "many-to-one", joinSql: "district_tags.tag_id = tags.id", description: "Tag" },
    ],
  },
  school_tags: {
    table: "school_tags",
    description: "Junction between schools and tags.",
    primaryKey: ["schoolId", "tagId"],
    columns: [],
    relationships: [
      { toTable: "schools", type: "many-to-one", joinSql: "school_tags.school_id = schools.ncessch", description: "School" },
      { toTable: "tags", type: "many-to-one", joinSql: "school_tags.tag_id = tags.id", description: "Tag" },
    ],
  },
  school_contacts: {
    table: "school_contacts",
    description: "Junction between schools and contacts.",
    primaryKey: ["schoolId", "contactId"],
    columns: [],
    relationships: [
      { toTable: "schools", type: "many-to-one", joinSql: "school_contacts.school_id = schools.ncessch", description: "School" },
      { toTable: "contacts", type: "many-to-one", joinSql: "school_contacts.contact_id = contacts.id", description: "Contact" },
    ],
  },
  territory_plan_states: {
    table: "territory_plan_states",
    description: "Junction between territory plans and states.",
    primaryKey: ["planId", "stateFips"],
    columns: [],
    relationships: [
      { toTable: "territory_plans", type: "many-to-one", joinSql: "territory_plan_states.plan_id = territory_plans.id", description: "Plan" },
      { toTable: "states", type: "many-to-one", joinSql: "territory_plan_states.state_fips = states.fips", description: "State" },
    ],
  },
  territory_plan_collaborators: {
    table: "territory_plan_collaborators",
    description: "Junction between territory plans and additional user collaborators (beyond the owner).",
    primaryKey: ["planId", "userId"],
    columns: [],
    relationships: [
      { toTable: "territory_plans", type: "many-to-one", joinSql: "territory_plan_collaborators.plan_id = territory_plans.id", description: "Plan" },
    ],
  },
  territory_plan_district_services: {
    table: "territory_plan_district_services",
    description: "Junction linking plan-district rows to target services (return vs new).",
    primaryKey: ["planId", "districtLeaid", "serviceId", "category"],
    columns: [],
    relationships: [
      { toTable: "territory_plan_districts", type: "many-to-one", joinSql: "territory_plan_district_services.plan_id = territory_plan_districts.plan_id AND territory_plan_district_services.district_leaid = territory_plan_districts.district_leaid", description: "Plan-district row" },
      { toTable: "services", type: "many-to-one", joinSql: "territory_plan_district_services.service_id = services.id", description: "Service" },
    ],
  },
  activity_districts: {
    table: "activity_districts",
    description: "Junction between activities and districts, with visit_date, position, and notes for road-trip style activities.",
    primaryKey: ["activityId", "districtLeaid"],
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_districts.activity_id = activities.id", description: "Activity" },
      { toTable: "districts", type: "many-to-one", joinSql: "activity_districts.district_leaid = districts.leaid", description: "District" },
    ],
  },
  activity_plans: {
    table: "activity_plans",
    description: "Junction between activities and territory plans.",
    primaryKey: ["activityId", "planId"],
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_plans.activity_id = activities.id", description: "Activity" },
      { toTable: "territory_plans", type: "many-to-one", joinSql: "activity_plans.plan_id = territory_plans.id", description: "Plan" },
    ],
  },
  activity_contacts: {
    table: "activity_contacts",
    description: "Junction between activities and contacts.",
    primaryKey: ["activityId", "contactId"],
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_contacts.activity_id = activities.id", description: "Activity" },
      { toTable: "contacts", type: "many-to-one", joinSql: "activity_contacts.contact_id = contacts.id", description: "Contact" },
    ],
  },
  activity_states: {
    table: "activity_states",
    description: "Junction between activities and states.",
    primaryKey: ["activityId", "stateFips"],
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_states.activity_id = activities.id", description: "Activity" },
      { toTable: "states", type: "many-to-one", joinSql: "activity_states.state_fips = states.fips", description: "State" },
    ],
  },
  activity_opportunities: {
    table: "activity_opportunities",
    description: "Junction between activities and opportunities.",
    primaryKey: ["activityId", "opportunityId"],
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_opportunities.activity_id = activities.id", description: "Activity" },
      { toTable: "opportunities", type: "many-to-one", joinSql: "activity_opportunities.opportunity_id = opportunities.id", description: "Opportunity" },
    ],
  },
  activity_attendees: {
    table: "activity_attendees",
    description: "Internal users who attended an activity.",
    primaryKey: ["activityId", "userId"],
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_attendees.activity_id = activities.id", description: "Activity" },
    ],
  },
  activity_expenses: {
    table: "activity_expenses",
    description: "Expense line items for an activity (food, travel, etc.).",
    primaryKey: "id",
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_expenses.activity_id = activities.id", description: "Parent activity" },
    ],
  },
  activity_relations: {
    table: "activity_relations",
    description: "Links between related activities (e.g., follow-up, part-of).",
    primaryKey: "id",
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_relations.activity_id = activities.id", description: "Source activity" },
    ],
  },
  task_districts: {
    table: "task_districts",
    description: "Junction between tasks and districts.",
    primaryKey: ["taskId", "districtLeaid"],
    columns: [],
    relationships: [
      { toTable: "tasks", type: "many-to-one", joinSql: "task_districts.task_id = tasks.id", description: "Task" },
      { toTable: "districts", type: "many-to-one", joinSql: "task_districts.district_leaid = districts.leaid", description: "District" },
    ],
  },
  task_plans: {
    table: "task_plans",
    description: "Junction between tasks and territory plans.",
    primaryKey: ["taskId", "planId"],
    columns: [],
    relationships: [
      { toTable: "tasks", type: "many-to-one", joinSql: "task_plans.task_id = tasks.id", description: "Task" },
      { toTable: "territory_plans", type: "many-to-one", joinSql: "task_plans.plan_id = territory_plans.id", description: "Plan" },
    ],
  },
  task_activities: {
    table: "task_activities",
    description: "Junction between tasks and activities.",
    primaryKey: ["taskId", "activityId"],
    columns: [],
    relationships: [
      { toTable: "tasks", type: "many-to-one", joinSql: "task_activities.task_id = tasks.id", description: "Task" },
      { toTable: "activities", type: "many-to-one", joinSql: "task_activities.activity_id = activities.id", description: "Activity" },
    ],
  },
  task_contacts: {
    table: "task_contacts",
    description: "Junction between tasks and contacts.",
    primaryKey: ["taskId", "contactId"],
    columns: [],
    relationships: [
      { toTable: "tasks", type: "many-to-one", joinSql: "task_contacts.task_id = tasks.id", description: "Task" },
      { toTable: "contacts", type: "many-to-one", joinSql: "task_contacts.contact_id = contacts.id", description: "Contact" },
    ],
  },
  tags: {
    table: "tags",
    description: "User-managed tags that can be applied to districts or schools.",
    primaryKey: "id",
    columns: [],
    relationships: [
      { toTable: "district_tags", type: "one-to-many", joinSql: "district_tags.tag_id = tags.id", description: "Junction to districts" },
      { toTable: "school_tags", type: "one-to-many", joinSql: "school_tags.tag_id = tags.id", description: "Junction to schools" },
    ],
  },
  services: {
    table: "services",
    description: "Catalog of Fullmind service offerings that can be targeted for districts in a plan.",
    primaryKey: "id",
    columns: [],
    relationships: [
      { toTable: "territory_plan_district_services", type: "one-to-many", joinSql: "territory_plan_district_services.service_id = services.id", description: "Junction to plan districts" },
    ],
  },
```

- [ ] **Step 2: Run tests**

```bash
npm test -- district-column-metadata
```

Expected: schema coverage test should be MUCH closer to passing. If it still reports missing tables, populate those from the list.

- [ ] **Step 3: Commit**

```bash
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): add junction tables to TABLE_REGISTRY"
```

---

## Task 27: Populate `SEMANTIC_CONTEXT.excludedTables` + final warnings

**Files:**
- Modify: `src/lib/district-column-metadata.ts`

- [ ] **Step 1: Populate the excluded tables list**

Replace `excludedTables: []` with:

```typescript
  excludedTables: [
    // PII / OAuth
    "user_profiles",
    "user_integrations",
    "user_goals",
    // Calendar internal
    "calendar_events",
    // UI state
    "map_views",
    // Ops noise
    "data_refresh_logs",
    // Gamification (not query-tool relevant)
    "initiatives",
    "initiative_metrics",
    "initiative_scores",
    "initiative_tier_thresholds",
    // Config tables
    "metric_registry",
    "vacancy_keyword_config",
    // Materialized views (duplicate of district_financials, see spec)
    "district_opportunity_actuals",
  ],
```

- [ ] **Step 2: Add the `district_financials` informational warning (the "vendor='fullmind' vs competitors" one)**

Append to `SEMANTIC_CONTEXT.warnings`:

```typescript
    {
      triggerTables: ["district_financials"],
      severity: "informational",
      message: "Use vendor='fullmind' for our internal data. Other vendors (elevate, proximity, tbt) are competitors sourced from GovSpend PO data and represent estimated competitor spend, not Fullmind revenue. 'fullmind' vendor rows aggregate BOTH session-derived revenue (from opportunities + sessions) AND Elevate K12 subscription revenue (from subscriptions) via refresh_fullmind_financials().",
    },
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test -- district-column-metadata
```

Expected: **ALL TESTS PASS.** If the schema coverage test reports missing tables, add them to either TABLE_REGISTRY or excludedTables and re-run.

- [ ] **Step 4: Commit**

```bash
git add src/lib/district-column-metadata.ts
git commit -m "feat(metadata): populate excludedTables and final semantic warnings"
```

---

## Task 28: Full regression run

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all 1380+ existing tests pass, plus the new metadata tests. If any regressions, debug and fix inline.

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run Prisma validate**

```bash
npx prisma validate
```

Expected: schema is valid.

- [ ] **Step 4: If all clean, no commit needed — move to Task 29.**

---

## Task 29: Patch the MAP-5 design spec

**Files:**
- Modify: `Docs/superpowers/specs/2026-04-03-claude-query-tool-design.md`

The existing MAP-5 design spec references `schema-reference.yaml`, which we're not using. Update it to point at the TS file and document the warning injection approach.

- [ ] **Step 1: Replace YAML references with TS**

In `Docs/superpowers/specs/2026-04-03-claude-query-tool-design.md`, find and replace:

1. `src/features/reports/lib/schema-reference.yaml` → `src/lib/district-column-metadata.ts` (use Grep tool to find all occurrences first)
2. Any sentence referring to "YAML loader" → describe importing `TABLE_REGISTRY` and `SEMANTIC_CONTEXT` directly
3. In the Architecture section, update the component list to reflect the TS exports

- [ ] **Step 2: Add a warning injection subsection**

Under "Claude API Integration" (around the section describing the system prompt), append:

```markdown
### Warning Injection

For every query, after Claude generates SQL, the query engine:

1. Parses the SQL to extract referenced tables
2. For each `Warning` in `SEMANTIC_CONTEXT.warnings` whose `triggerTables` overlap the extracted set:
   - If `severity === "mandatory"`: prepend the warning's `message` to Claude's follow-up prompt and instruct Claude to surface the caveat in its `insight` response
   - If `severity === "informational"`: include the message but don't force it into the insight
3. The engine re-queries Claude for the insight with warnings in context

This ensures the stage-convention, EK12-revenue, and historical-session-gap warnings cannot be bypassed even if Claude writes otherwise-correct SQL.
```

- [ ] **Step 3: Commit**

```bash
git add Docs/superpowers/specs/2026-04-03-claude-query-tool-design.md
git commit -m "docs(spec): update MAP-5 query tool spec — TS metadata, warning injection"
```

---

## Task 30: Final test run, push, and PR prep

**Files:**
- None (verification + push)

- [ ] **Step 1: Final full test run**

```bash
npm test
```

Expected: all green.

- [ ] **Step 2: Verify git log is clean**

```bash
git log --oneline main..HEAD
```

Expected: ~29 commits on the branch, all with clear conventional-commit messages. If any look redundant, consider rebasing with `git rebase -i` to squash (user's call).

- [ ] **Step 3: Push the branch**

```bash
git push -u origin feat/db-readiness-query-tool
```

- [ ] **Step 4: Open the PR**

Use the PR template from `CLAUDE.md`:

```bash
gh pr create --title "feat(db): query tool readiness — schema, read-only role, metadata registry" --body "$(cat <<'EOF'
## Summary

Lands the schema, infrastructure, and metadata prep required for the Claude query tool (MAP-5), agentic actions (MAP-3), and MCP server (MAP-4) so no further DB-layer work is needed to build the query engine and UI.

- Adds `query_log` and `saved_reports` tables (with MAP-3 action columns baked in up front)
- Adds a manual SQL script for the `query_tool_readonly` Postgres role
- Adds `src/lib/db-readonly.ts` wrapper for the read-only pool
- Extends `src/lib/district-column-metadata.ts` from 2 tables to 18 primary tables + ~20 junction tables via new `TABLE_REGISTRY` and `SEMANTIC_CONTEXT` exports
- Fills the PR #109 gap for `district_financials.subscription_count` in the metadata
- Documents the Session historical gap, EK12 revenue quirk, and opportunities.stage dual-convention as mandatory warnings
- Excludes `district_opportunity_actuals` materialized view from Claude's surface

Spec: `Docs/superpowers/specs/2026-04-11-db-readiness-query-tool.md`
Plan: `Docs/superpowers/plans/2026-04-12-db-readiness-query-tool.md`

## Test plan

- [ ] `npm test` — all 1380+ existing + new metadata tests pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npx prisma validate` — schema valid
- [ ] Run `prisma/migrations/manual/create-readonly-role.sql` in Supabase SQL editor (after replacing `CHANGE_ME`)
- [ ] Set `DATABASE_READONLY_URL` in Vercel env
- [ ] Verify in prod: `psql $DATABASE_READONLY_URL -c "SELECT count(*) FROM districts;"` succeeds
- [ ] Verify in prod: `psql $DATABASE_READONLY_URL -c "SELECT count(*) FROM user_profiles;"` fails (permission denied)
- [ ] Verify in prod: `psql $DATABASE_READONLY_URL -c "SELECT pg_sleep(10);"` fails after 5s

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Report the PR URL back.**

---

## Out of Scope (Followups)

These are intentionally not included in this plan:

- **Query engine implementation** — `src/features/reports/lib/query-engine.ts` (MAP-5)
- **`/api/ai/query` route** (MAP-5)
- **Frontend chat UI** — `src/features/reports/components/` (MAP-5)
- **Action handlers and `/api/ai/query/action`** (MAP-3)
- **Railway scheduler session-gap fix** — see `Docs/superpowers/followups/2026-04-11-opportunity-sync-historical-gap.md`
- **`opportunities.salesRepId` Prisma relation** (Phase 2a deferral)
- **`opportunities.closeDate` index** (minor perf followup)
- **One-time backfill of historical opportunities** (depends on session-gap decision)
