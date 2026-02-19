-- Add denormalized rollup columns to territory_plans
ALTER TABLE territory_plans
  ADD COLUMN district_count INT NOT NULL DEFAULT 0,
  ADD COLUMN state_count INT NOT NULL DEFAULT 0,
  ADD COLUMN renewal_rollup DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN expansion_rollup DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN winback_rollup DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN new_business_rollup DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Backfill from existing data
UPDATE territory_plans tp SET
  district_count = sub.cnt,
  renewal_rollup = sub.r,
  expansion_rollup = sub.e,
  winback_rollup = sub.w,
  new_business_rollup = sub.n
FROM (
  SELECT
    plan_id,
    COUNT(*)::int AS cnt,
    COALESCE(SUM(renewal_target), 0) AS r,
    COALESCE(SUM(expansion_target), 0) AS e,
    COALESCE(SUM(winback_target), 0) AS w,
    COALESCE(SUM(new_business_target), 0) AS n
  FROM territory_plan_districts
  GROUP BY plan_id
) sub
WHERE tp.id = sub.plan_id;

-- Backfill state_count
UPDATE territory_plans tp SET
  state_count = sub.cnt
FROM (
  SELECT plan_id, COUNT(*)::int AS cnt
  FROM territory_plan_states
  GROUP BY plan_id
) sub
WHERE tp.id = sub.plan_id;
