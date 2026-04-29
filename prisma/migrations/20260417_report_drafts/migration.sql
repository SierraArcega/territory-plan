-- Active report draft per user — backs the Reports tab's Draft state.
-- One row per user (PK on user_id). Cascade-deletes when user is removed.
-- No retention policy for MVP: drafts persist until explicit discard.

CREATE TABLE "report_drafts" (
  "user_id"          UUID PRIMARY KEY REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "params"           JSONB NOT NULL,
  "conversation_id"  UUID,
  "chat_history"     JSONB,
  "last_touched_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
