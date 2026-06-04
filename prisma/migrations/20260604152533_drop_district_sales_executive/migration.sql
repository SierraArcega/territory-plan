-- Drop the deprecated CRM sales-executive columns from districts.
-- Ownership is now consolidated on districts.owner_id (see the ownership
-- convergence work). Application code no longer reads or writes these columns.
--
-- PREREQUISITE: the district_map_features materialized view must already be
-- rebuilt from scripts/district-map-features-view.sql (owner-only version, no
-- sales_executive_id) BEFORE this migration runs — that matview is the only DB
-- object that referenced these columns. Deploy order:
--   1) deploy app code (no longer reads sales_executive_*)
--   2) psql -f scripts/district-map-features-view.sql   (rebuild matview)
--   3) prisma migrate deploy                            (this migration)

ALTER TABLE "districts" DROP COLUMN IF EXISTS "sales_executive_id";
ALTER TABLE "districts" DROP COLUMN IF EXISTS "sales_executive";
