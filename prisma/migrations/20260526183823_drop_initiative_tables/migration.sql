-- Drop the deprecated Initiative gamified-leaderboard tables (PR 2 of the
-- initiative deprecation; PR 1 removed all app code in a prior release).
-- CASCADE clears the FK relations between these tables. No business data:
-- these hold ~50 rows of feature config + per-rep scoring only.
DROP TABLE IF EXISTS "initiative_scores" CASCADE;
DROP TABLE IF EXISTS "initiative_metrics" CASCADE;
DROP TABLE IF EXISTS "initiative_tier_thresholds" CASCADE;
DROP TABLE IF EXISTS "initiatives" CASCADE;
DROP TABLE IF EXISTS "metric_registry" CASCADE;
