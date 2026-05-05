-- Adds the four EK12 (Elevate K12) instructional service buckets as catalog
-- rows, seeds aliases for all 11 known subscriptions.product_type values
-- (instructional → mapped, add-ons + billing artifacts → ignored), and
-- expands the unmapped_service_aliases view to scan subscriptions.product_type
-- in addition to sessions.service_type.

-- ==========================================================================
-- 1. Four new EK12 instructional services. Enriched fields stay NULL.
-- ==========================================================================
INSERT INTO "services" ("name", "slug", "color", "sort_order") VALUES
  ('EK12 Tier 1',           'ek12-tier-1',           '#2D7E8C', 20),
  ('EK12 Diverse Learning', 'ek12-diverse-learning', '#6B4C8C', 21),
  ('EK12 Enrichment',       'ek12-enrichment',       '#A8923C', 22),
  ('EK12 Supplemental',     'ek12-supplemental',     '#C46B8A', 23)
ON CONFLICT (slug) DO NOTHING;

-- ==========================================================================
-- 2. Map the four instructional product_type values to the new services.
-- ==========================================================================
INSERT INTO "service_aliases" ("alias", "service_id", "ignored")
SELECT a.alias, s.id, FALSE
FROM (VALUES
  ('Tier 1',           'ek12-tier-1'),
  ('Diverse Learning', 'ek12-diverse-learning'),
  ('Enrichment',       'ek12-enrichment'),
  ('Supplemental',     'ek12-supplemental')
) AS a(alias, slug)
JOIN "services" s ON s.slug = a.slug
ON CONFLICT (alias) DO UPDATE SET
  service_id = EXCLUDED.service_id,
  ignored    = FALSE;

-- ==========================================================================
-- 3. Mark add-ons and billing artifacts as ignored. They have real revenue
--    but aren't catalog services — same separation as the Add-Ons section in
--    PricingAndPackagingPage. Ignored=true keeps them out of the unmapped
--    drift view so the admin tab stays focused on real gaps.
-- ==========================================================================
INSERT INTO "service_aliases" ("alias", "service_id", "ignored") VALUES
  ('Teacher Collaberation Meetings', NULL, TRUE),
  ('Teacher Collaboration Hours',    NULL, TRUE),
  ('Office Hours',                   NULL, TRUE),
  ('Student Office Hours',           NULL, TRUE),
  ('Fee',                            NULL, TRUE),
  ('Credit',                         NULL, TRUE),
  ('Placeholder Product',            NULL, TRUE)
ON CONFLICT (alias) DO UPDATE SET service_id = NULL, ignored = TRUE;

-- ==========================================================================
-- 4. Expand unmapped view to also scan subscriptions.product_type.
--    sessions.service_name and subscriptions.product / sub_product remain
--    excluded — they're SKUs/subjects, not service taxonomy.
-- ==========================================================================
CREATE OR REPLACE VIEW "unmapped_service_aliases" AS
SELECT
  alias,
  STRING_AGG(DISTINCT source, ', ' ORDER BY source) AS sources,
  SUM(row_count)::int                                AS row_count,
  MAX(last_seen)                                     AS last_seen
FROM (
  SELECT service_type AS alias, 'sessions.service_type' AS source,
         COUNT(*) AS row_count, MAX(synced_at) AS last_seen
  FROM "sessions"
  WHERE service_type IS NOT NULL AND service_type <> ''
  GROUP BY service_type
  UNION ALL
  SELECT product_type, 'subscriptions.product_type',
         COUNT(*), MAX(synced_at)
  FROM "subscriptions"
  WHERE product_type IS NOT NULL AND product_type <> ''
  GROUP BY product_type
) src
WHERE alias NOT IN (SELECT alias FROM "service_aliases")
GROUP BY alias
ORDER BY row_count DESC;
