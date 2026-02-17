-- Drop unused graduation rate male/female columns
-- The EdFacts grad-rates API does not include sex/gender disaggregation,
-- so these columns can never be populated.
ALTER TABLE "districts" DROP COLUMN IF EXISTS "graduation_rate_male";
ALTER TABLE "districts" DROP COLUMN IF EXISTS "graduation_rate_female";
