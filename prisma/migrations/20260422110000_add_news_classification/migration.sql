-- Add classification columns to news_articles: sentiment, categories,
-- fullmind_relevance, classified_at. Populated by a Haiku classifier pass.

ALTER TABLE "news_articles"
  ADD COLUMN "sentiment" VARCHAR(10),
  ADD COLUMN "categories" VARCHAR(40)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(40)[],
  ADD COLUMN "fullmind_relevance" VARCHAR(10),
  ADD COLUMN "classified_at" TIMESTAMP(3);

CREATE INDEX "news_articles_fullmind_relevance_published_at_idx"
  ON "news_articles"("fullmind_relevance", "published_at");
