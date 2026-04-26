-- News Events feature: ingested articles matched to districts, schools, contacts.
-- See docs/superpowers/specs/2026-04-22-news-events-integration-spec.md

CREATE TABLE "news_articles" (
    "id" TEXT NOT NULL,
    "url" VARCHAR(2000) NOT NULL,
    "url_hash" VARCHAR(64) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "image_url" VARCHAR(1000),
    "author" VARCHAR(255),
    "source" VARCHAR(255) NOT NULL,
    "feed_source" VARCHAR(40) NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state_abbrevs" VARCHAR(2)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(2)[],

    CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "news_articles_url_key" ON "news_articles"("url");
CREATE UNIQUE INDEX "news_articles_url_hash_key" ON "news_articles"("url_hash");
CREATE INDEX "news_articles_published_at_idx" ON "news_articles"("published_at");
CREATE INDEX "news_articles_feed_source_idx" ON "news_articles"("feed_source");

CREATE TABLE "news_article_districts" (
    "article_id" TEXT NOT NULL,
    "leaid" VARCHAR(7) NOT NULL,
    "confidence" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_article_districts_pkey" PRIMARY KEY ("article_id","leaid")
);

CREATE INDEX "news_article_districts_leaid_confidence_idx" ON "news_article_districts"("leaid", "confidence");

ALTER TABLE "news_article_districts" ADD CONSTRAINT "news_article_districts_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_districts" ADD CONSTRAINT "news_article_districts_leaid_fkey"
    FOREIGN KEY ("leaid") REFERENCES "districts"("leaid") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "news_article_schools" (
    "article_id" TEXT NOT NULL,
    "ncessch" VARCHAR(12) NOT NULL,
    "confidence" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_article_schools_pkey" PRIMARY KEY ("article_id","ncessch")
);

CREATE INDEX "news_article_schools_ncessch_confidence_idx" ON "news_article_schools"("ncessch", "confidence");

ALTER TABLE "news_article_schools" ADD CONSTRAINT "news_article_schools_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_schools" ADD CONSTRAINT "news_article_schools_ncessch_fkey"
    FOREIGN KEY ("ncessch") REFERENCES "schools"("ncessch") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "news_article_contacts" (
    "article_id" TEXT NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "confidence" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_article_contacts_pkey" PRIMARY KEY ("article_id","contact_id")
);

CREATE INDEX "news_article_contacts_contact_id_confidence_idx" ON "news_article_contacts"("contact_id", "confidence");

ALTER TABLE "news_article_contacts" ADD CONSTRAINT "news_article_contacts_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_contacts" ADD CONSTRAINT "news_article_contacts_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "district_news_fetch" (
    "leaid" VARCHAR(7) NOT NULL,
    "last_fetched_at" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "last_status" VARCHAR(20),
    "last_error" TEXT,

    CONSTRAINT "district_news_fetch_pkey" PRIMARY KEY ("leaid")
);

CREATE INDEX "district_news_fetch_priority_last_fetched_at_idx" ON "district_news_fetch"("priority", "last_fetched_at");

ALTER TABLE "district_news_fetch" ADD CONSTRAINT "district_news_fetch_leaid_fkey"
    FOREIGN KEY ("leaid") REFERENCES "districts"("leaid") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "news_ingest_runs" (
    "id" TEXT NOT NULL,
    "layer" VARCHAR(20) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "articles_new" INTEGER NOT NULL DEFAULT 0,
    "articles_dup" INTEGER NOT NULL DEFAULT 0,
    "districts_processed" INTEGER NOT NULL DEFAULT 0,
    "llm_calls" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL,
    "error" TEXT,

    CONSTRAINT "news_ingest_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "news_ingest_runs_layer_started_at_idx" ON "news_ingest_runs"("layer", "started_at");

CREATE TABLE "news_match_queue" (
    "article_id" TEXT NOT NULL,
    "candidates" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_match_queue_pkey" PRIMARY KEY ("article_id")
);

CREATE INDEX "news_match_queue_processed_at_idx" ON "news_match_queue"("processed_at");

ALTER TABLE "news_match_queue" ADD CONSTRAINT "news_match_queue_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed district_news_fetch for all existing districts with priority computed
-- from customer/pipeline status. Idempotent via ON CONFLICT DO NOTHING.
INSERT INTO "district_news_fetch" ("leaid", "priority")
SELECT
    "leaid",
    (CASE WHEN "is_customer" THEN 100 ELSE 0 END
     + CASE WHEN "has_open_pipeline" THEN 50 ELSE 0 END) AS "priority"
FROM "districts"
ON CONFLICT ("leaid") DO NOTHING;
