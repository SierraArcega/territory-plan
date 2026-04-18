-- Query tool audit + saved reports.
-- Added for the Claude query tool (MAP-5), agentic actions (MAP-3),
-- and MCP server (MAP-4). query_log includes the MAP-3 action columns
-- (action, action_params, action_success) up front so MAP-3 doesn't
-- require a second migration.
--
-- See spec: Docs/superpowers/specs/2026-04-11-db-readiness-query-tool.md
-- See plan: Docs/superpowers/plans/2026-04-12-db-readiness-query-tool.md

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

ALTER TABLE "query_log" ADD CONSTRAINT "query_log_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
