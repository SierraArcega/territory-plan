-- Add FK relations from Opportunity → District and Session → Opportunity.
-- See plan: Docs/superpowers/plans/2026-04-11-opportunity-session-fk.md
-- Production check (2026-04-11) found 355 orphaned opportunities and an unknown
-- number of orphaned sessions; both must be NULLed before adding the constraints.

-- Step 1: Clean up orphaned references BEFORE adding FK constraints
UPDATE opportunities
SET district_lea_id = NULL
WHERE district_lea_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM districts WHERE leaid = opportunities.district_lea_id
);

UPDATE sessions
SET opportunity_id = NULL
WHERE opportunity_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM opportunities WHERE id = sessions.opportunity_id
);

-- Step 2: Change column types and nullability
ALTER TABLE "opportunities" ALTER COLUMN "district_lea_id" TYPE VARCHAR(7);
ALTER TABLE "sessions" ALTER COLUMN "opportunity_id" DROP NOT NULL;

-- Step 3: Add FK constraints (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_district_lea_id_fkey'
  ) THEN
    ALTER TABLE "opportunities"
      ADD CONSTRAINT "opportunities_district_lea_id_fkey"
      FOREIGN KEY ("district_lea_id") REFERENCES "districts"("leaid")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_opportunity_id_fkey'
  ) THEN
    ALTER TABLE "sessions"
      ADD CONSTRAINT "sessions_opportunity_id_fkey"
      FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
