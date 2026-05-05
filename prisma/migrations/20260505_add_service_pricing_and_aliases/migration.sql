-- Adds two new services (Homebased, Virtual Medical Classroom) with blank
-- enriched fields, plus the per-fiscal-year service_pricing table and the
-- service_aliases mapping (with an unmapped_service_aliases drift view to
-- catch new alias strings showing up in synced sessions/subscriptions).

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "delivery_type" AS ENUM ('1:1', '1:10', '1:30');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Insert Homebased + Virtual Medical Classroom. Fields beyond the required
-- ones stay NULL until someone fills them in.
INSERT INTO "services" ("name", "slug", "color", "sort_order") VALUES
  ('Homebased', 'homebased', '#7AAFC4', 11),
  ('Virtual Medical Classroom', 'virtual-medical-classroom', '#B89FCC', 12)
ON CONFLICT (slug) DO NOTHING;

-- CreateTable: service_pricing
CREATE TABLE IF NOT EXISTS "service_pricing" (
  "id"             SERIAL          NOT NULL,
  "service_id"     INTEGER         NOT NULL,
  "fiscal_year"    INTEGER         NOT NULL,
  "delivery"       "delivery_type" NOT NULL,
  "rate_cents"     INTEGER         NOT NULL,
  "description"    TEXT,
  "effective_from" TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT "service_pricing_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_pricing_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_pricing_service_year_delivery_key"
  ON "service_pricing"("service_id", "fiscal_year", "delivery");

CREATE INDEX IF NOT EXISTS "service_pricing_fiscal_year_idx"
  ON "service_pricing"("fiscal_year");

-- CreateTable: service_aliases
-- One row per alias string seen in sessions/subscriptions. Maps to a
-- canonical Service (or ignored=true to suppress an alias we don't care about).
CREATE TABLE IF NOT EXISTS "service_aliases" (
  "alias"      TEXT        NOT NULL,
  "service_id" INTEGER,
  "ignored"    BOOLEAN     NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "service_aliases_pkey" PRIMARY KEY ("alias"),
  CONSTRAINT "service_aliases_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "service_aliases_service_id_idx"
  ON "service_aliases"("service_id");

-- View: unmapped_service_aliases
-- Surfaces alias strings present in synced data that have no row in
-- service_aliases. The admin UI reads this to show drift.
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
  SELECT service_name, 'sessions.service_name',
         COUNT(*), MAX(synced_at)
  FROM "sessions"
  WHERE service_name IS NOT NULL AND service_name <> ''
  GROUP BY service_name
  UNION ALL
  SELECT product, 'subscriptions.product',
         COUNT(*), MAX(synced_at)
  FROM "subscriptions"
  WHERE product IS NOT NULL AND product <> ''
  GROUP BY product
  UNION ALL
  SELECT product_type, 'subscriptions.product_type',
         COUNT(*), MAX(synced_at)
  FROM "subscriptions"
  WHERE product_type IS NOT NULL AND product_type <> ''
  GROUP BY product_type
  UNION ALL
  SELECT sub_product, 'subscriptions.sub_product',
         COUNT(*), MAX(synced_at)
  FROM "subscriptions"
  WHERE sub_product IS NOT NULL AND sub_product <> ''
  GROUP BY sub_product
) src
WHERE alias NOT IN (SELECT alias FROM "service_aliases")
GROUP BY alias
ORDER BY row_count DESC;

-- Trigger: keep service_aliases.updated_at fresh on UPDATE
CREATE OR REPLACE FUNCTION "service_aliases_set_updated_at"() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "service_aliases_updated_at" ON "service_aliases";
CREATE TRIGGER "service_aliases_updated_at"
  BEFORE UPDATE ON "service_aliases"
  FOR EACH ROW EXECUTE FUNCTION "service_aliases_set_updated_at"();
