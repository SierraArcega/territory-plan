-- Create service_category enum type
CREATE TYPE service_category AS ENUM ('return', 'new');

-- TerritoryPlanDistrict: add new target columns
ALTER TABLE territory_plan_districts
  ADD COLUMN renewal_target DECIMAL(15,2),
  ADD COLUMN winback_target DECIMAL(15,2),
  ADD COLUMN expansion_target DECIMAL(15,2),
  ADD COLUMN new_business_target DECIMAL(15,2);

-- Migrate existing data: revenue_target -> renewal_target, pipeline_target -> new_business_target
UPDATE territory_plan_districts SET renewal_target = revenue_target WHERE revenue_target IS NOT NULL;
UPDATE territory_plan_districts SET new_business_target = pipeline_target WHERE pipeline_target IS NOT NULL;

-- Drop old columns
ALTER TABLE territory_plan_districts DROP COLUMN revenue_target;
ALTER TABLE territory_plan_districts DROP COLUMN pipeline_target;

-- TerritoryPlanDistrictService: add category column with default
ALTER TABLE territory_plan_district_services
  ADD COLUMN category service_category NOT NULL DEFAULT 'return';

-- Drop old PK and create new one with category
ALTER TABLE territory_plan_district_services DROP CONSTRAINT territory_plan_district_services_pkey;
ALTER TABLE territory_plan_district_services
  ADD CONSTRAINT territory_plan_district_services_pkey PRIMARY KEY (plan_id, district_leaid, service_id, category);

-- UserGoal: add new target columns
ALTER TABLE user_goals
  ADD COLUMN renewal_target DECIMAL(15,2),
  ADD COLUMN winback_target DECIMAL(15,2),
  ADD COLUMN expansion_target DECIMAL(15,2),
  ADD COLUMN new_business_target DECIMAL(15,2);

-- Migrate existing user goal data
UPDATE user_goals SET renewal_target = revenue_target WHERE revenue_target IS NOT NULL;
UPDATE user_goals SET new_business_target = pipeline_target WHERE pipeline_target IS NOT NULL;

-- Drop old columns from user_goals
ALTER TABLE user_goals DROP COLUMN revenue_target;
ALTER TABLE user_goals DROP COLUMN pipeline_target;
