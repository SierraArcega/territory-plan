-- Adds service hierarchy (parent_service_id), four new top-level services
-- (Extra Help, AP, College Level, AVID) and three Homebound subtypes
-- (General, Medical, Suspension), seeds service_aliases from prod
-- sessions.service_type values, and tightens the unmapped view to scan
-- only sessions.service_type (subscription columns and sessions.service_name
-- aren't service taxonomy and produce noise).

-- ==========================================================================
-- 1. Service hierarchy
-- ==========================================================================
ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "parent_service_id" INTEGER;

DO $$ BEGIN
  ALTER TABLE "services"
    ADD CONSTRAINT "services_parent_service_id_fkey"
    FOREIGN KEY ("parent_service_id") REFERENCES "services"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "services_parent_service_id_idx"
  ON "services"("parent_service_id");

-- ==========================================================================
-- 2. New top-level services (Extra Help, AP, College Level, AVID)
-- ==========================================================================
INSERT INTO "services" ("name", "slug", "color", "sort_order") VALUES
  ('Extra Help',    'extra-help',    '#E89055', 13),
  ('AP',            'ap',            '#4A6B8C', 14),
  ('College Level', 'college-level', '#5C8D6F', 15),
  ('AVID',          'avid',          '#B5836A', 16)
ON CONFLICT (slug) DO NOTHING;

-- ==========================================================================
-- 3. Homebound subtypes — parent_service_id resolved by slug lookup
-- ==========================================================================
INSERT INTO "services" ("name", "slug", "color", "sort_order", "parent_service_id")
SELECT subtype.name, subtype.slug, subtype.color, subtype.sort_order, parent.id
FROM (VALUES
  ('Homebound - General',    'homebound-general',    '#6EA3BE', 17),
  ('Homebound - Medical',    'homebound-medical',    '#4F8CAB', 18),
  ('Homebound - Suspension', 'homebound-suspension', '#8FBAD0', 19)
) AS subtype(name, slug, color, sort_order)
CROSS JOIN (SELECT id FROM "services" WHERE slug = 'homebound') AS parent
ON CONFLICT (slug) DO NOTHING;

-- ==========================================================================
-- 4. Seed service_aliases from prod sessions.service_type values
--    (covers ~436K of ~437K total session rows; ignores 'n/a')
-- ==========================================================================
INSERT INTO "service_aliases" ("alias", "service_id", "ignored")
SELECT a.alias, s.id, FALSE
FROM (VALUES
  ('Homebound',                            'homebound'),
  ('homebounds',                           'homebound'),
  ('Homebound - General',                  'homebound-general'),
  ('Homebound - Medical',                  'homebound-medical'),
  ('Homebound - Suspension',               'homebound-suspension'),
  ('Whole Class Virtual Instruction',      'wcvi'),
  ('Suspension Alternative - WC',          'suspension-alt'),
  ('Credit Recovery',                      'credit-recovery'),
  ('Tutoring',                             'tutoring'),
  ('Tutoring (Acceleration/Remediation)',  'tutoring'),
  ('Homework Help',                        'homework-help'),
  ('Resource Room',                        'resource-rooms'),
  ('Test Prep',                            'test-prep'),
  ('State Test Prep',                      'test-prep'),
  ('SAT Test Prep',                        'test-prep'),
  ('Extra Help',                           'extra-help'),
  ('AP',                                   'ap'),
  ('College Level',                        'college-level'),
  ('AVID',                                 'avid'),
  ('virtualStaffing',                      'hybrid-staffing')
) AS a(alias, slug)
JOIN "services" s ON s.slug = a.slug
ON CONFLICT (alias) DO UPDATE SET
  service_id = EXCLUDED.service_id,
  ignored    = FALSE;

-- 'n/a' is real but meaningless — mark ignored so it stops appearing in the view.
INSERT INTO "service_aliases" ("alias", "service_id", "ignored")
VALUES ('n/a', NULL, TRUE)
ON CONFLICT (alias) DO UPDATE SET service_id = NULL, ignored = TRUE;

-- ==========================================================================
-- 5. Tighten unmapped view to sessions.service_type only.
--    sessions.service_name is a SKU (service_type + modifiers) not a service.
--    subscriptions.* are billing tiers/SKUs from Elevate, not service taxonomy.
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
) src
WHERE alias NOT IN (SELECT alias FROM "service_aliases")
GROUP BY alias
ORDER BY row_count DESC;
