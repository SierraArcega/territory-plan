-- Add btree index on districts.name to support ORDER BY and prefix matching
-- in the district list endpoint. The list endpoint paginates with
-- `ORDER BY name ASC LIMIT N`, which triggered a full-table sort on ~15-20k
-- rows on every call (~11s observed in production trace).

CREATE INDEX IF NOT EXISTS "districts_name_idx" ON "districts"("name");
