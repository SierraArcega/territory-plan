-- Migration: news_article_matched_at
--
-- Adds a tracking column for Pass 1 of the news matcher (keyword matching +
-- LLM-queue prep). Pass 1 used to run inline at ingest, but with ~100k
-- articles a week the inline path was pushing the rolling cron over Vercel's
-- 300s maxDuration. We now defer Pass 1 to /api/cron/match-articles, which
-- finds articles with matched_at IS NULL and processes them in batches.
--
-- A partial index on matched_at IS NULL keeps the queue scan cheap as the
-- table grows — once an article has been matched (or skipped), it falls out
-- of the index entirely.

ALTER TABLE "news_articles"
  ADD COLUMN IF NOT EXISTS "matched_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "news_articles_unmatched_idx"
  ON "news_articles" ("fetched_at")
  WHERE "matched_at" IS NULL;

-- Backfill existing articles to NOT NULL so the matcher cron starts with a
-- clean queue rather than trying to re-process the entire 112k backlog. We
-- lose nothing — those articles already went through the inline matcher and
-- have whatever links they were ever going to get from Pass 1.
UPDATE "news_articles"
SET "matched_at" = "fetched_at"
WHERE "matched_at" IS NULL;
