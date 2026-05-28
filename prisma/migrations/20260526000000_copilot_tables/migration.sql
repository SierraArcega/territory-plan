-- Migration: copilot_tables
-- AI Copilot persistence. copilot_turn mirrors the query_log pattern but is
-- dedicated to the write-capable copilot (a turn answers with sql OR proposes
-- actions). copilot_action_log is the write audit, one row per executed action
-- with before/after snapshots, written in the same transaction as the mutation.

-- CreateTable
CREATE TABLE "copilot_turn" (
    "id" SERIAL NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "assistant_text" TEXT,
    "sql" TEXT,
    "summary" JSONB,
    "proposed_actions" JSONB,
    "tool_trace" JSONB,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cache_creation_input_tokens" INTEGER,
    "cache_read_input_tokens" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "copilot_turn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_action_log" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "conversation_id" UUID,
    "object_type" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "target_id" TEXT,
    "before_json" JSONB,
    "after_json" JSONB,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "copilot_action_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "copilot_turn_conversation_id_idx" ON "copilot_turn" ("conversation_id");

-- CreateIndex
CREATE INDEX "copilot_turn_user_id_idx" ON "copilot_turn" ("user_id");

-- CreateIndex
CREATE INDEX "copilot_turn_created_at_idx" ON "copilot_turn" ("created_at" DESC);

-- CreateIndex
CREATE INDEX "copilot_action_log_user_id_created_at_idx" ON "copilot_action_log" ("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "copilot_action_log_conversation_id_idx" ON "copilot_action_log" ("conversation_id");

-- AddForeignKey
ALTER TABLE "copilot_turn" ADD CONSTRAINT "copilot_turn_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_action_log" ADD CONSTRAINT "copilot_action_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
