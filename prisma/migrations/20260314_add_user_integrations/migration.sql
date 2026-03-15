-- Migration: add_user_integrations
-- Adds UserIntegration model for per-user OAuth connections (Gmail, Google Calendar, Slack, Mixmax)
-- Adds Gmail/Slack dedup fields and Mixmax enrichment fields to activities table
-- Widens activities.source from VarChar(20) to VarChar(30)

-- ===== UserIntegration table =====
CREATE TABLE IF NOT EXISTS "user_integrations" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          UUID NOT NULL,
  "service"          VARCHAR(30) NOT NULL,
  "account_email"    VARCHAR(255),
  "account_name"     VARCHAR(255),
  "access_token"     TEXT NOT NULL,
  "refresh_token"    TEXT,
  "token_expires_at" TIMESTAMP(3),
  "scopes"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata"         JSONB,
  "sync_enabled"     BOOLEAN NOT NULL DEFAULT true,
  "status"           VARCHAR(20) NOT NULL DEFAULT 'connected',
  "last_sync_at"     TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_integrations_pkey" PRIMARY KEY ("id")
);

-- Foreign key to user_profiles
ALTER TABLE "user_integrations"
  ADD CONSTRAINT "user_integrations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE;

-- Unique: one row per user per service
ALTER TABLE "user_integrations"
  ADD CONSTRAINT "user_integrations_user_id_service_key" UNIQUE ("user_id", "service");

-- Index on user_id
CREATE INDEX IF NOT EXISTS "user_integrations_user_id_idx" ON "user_integrations"("user_id");

-- ===== Activities: widen source column =====
ALTER TABLE "activities" ALTER COLUMN "source" TYPE VARCHAR(30);

-- ===== Activities: Gmail dedup =====
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "gmail_message_id" TEXT;
ALTER TABLE "activities" ADD CONSTRAINT "activities_gmail_message_id_key" UNIQUE ("gmail_message_id");

-- ===== Activities: Slack dedup =====
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "slack_channel_id" VARCHAR(50);
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "slack_message_ts" TEXT;
ALTER TABLE "activities" ADD CONSTRAINT "activities_slack_channel_id_slack_message_ts_key"
  UNIQUE ("slack_channel_id", "slack_message_ts");

-- ===== Activities: integration metadata =====
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "integration_meta" JSONB;

-- ===== Activities: Mixmax enrichment =====
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "mixmax_sequence_name"  VARCHAR(255);
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "mixmax_sequence_step"  INTEGER;
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "mixmax_sequence_total" INTEGER;
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "mixmax_status"         VARCHAR(30);
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "mixmax_open_count"     INTEGER;
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "mixmax_click_count"    INTEGER;
