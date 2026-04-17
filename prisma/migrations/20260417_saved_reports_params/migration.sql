-- Switch the query tool's persistence from raw SQL to structured params.
--
-- The builder-primary design stores the canonical query as JSONB filter/column
-- specs, compiles to SQL server-side, and never exposes SQL to the client.
-- See Docs/superpowers/specs/2026-04-03-claude-query-tool-design.md (being
-- superseded) and the Reports v2 figjams.
--
-- Both columns stay nullable during the transition:
--   - `sql` remains populated for audit/debugging; new writes may leave it
--     filled (route compiles and logs) but client never reads it.
--   - `params` is the new canonical form for saved reports and chat runs.

ALTER TABLE "saved_reports" ALTER COLUMN "sql" DROP NOT NULL;
ALTER TABLE "saved_reports" ADD COLUMN "params" JSONB;

ALTER TABLE "query_log" ADD COLUMN "params" JSONB;
