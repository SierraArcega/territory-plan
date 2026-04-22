-- Supports the cross-publisher syndication dedup check in upsertArticle:
-- "same title, published within 24h of incoming article".

CREATE INDEX "news_articles_title_published_at_idx"
  ON "news_articles"("title", "published_at");
