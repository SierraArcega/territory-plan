-- Migration: query_log_tokens
--
-- Adds 4 nullable INT columns to query_log for per-turn Claude token usage:
--   input_tokens                   — total uncached input tokens across all model calls in the turn
--   output_tokens                  — total output tokens across all model calls in the turn
--   cache_creation_input_tokens    — tokens written into the prompt cache
--   cache_read_input_tokens        — tokens served from the prompt cache
--
-- Sums are aggregated across every iteration of the agent loop (each turn fires
-- multiple model calls — initial reasoning, tool-use rounds, retries). NULL on
-- legacy rows from before this migration.

ALTER TABLE "query_log"
  ADD COLUMN IF NOT EXISTS "input_tokens" INTEGER,
  ADD COLUMN IF NOT EXISTS "output_tokens" INTEGER,
  ADD COLUMN IF NOT EXISTS "cache_creation_input_tokens" INTEGER,
  ADD COLUMN IF NOT EXISTS "cache_read_input_tokens" INTEGER;
