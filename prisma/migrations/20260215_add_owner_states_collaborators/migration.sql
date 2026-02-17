-- 1. Add ownerId column
ALTER TABLE territory_plans ADD COLUMN owner_id UUID REFERENCES user_profiles(id);
CREATE INDEX idx_territory_plans_owner_id ON territory_plans(owner_id);

-- 2. Migrate existing owner string -> ownerId where possible
UPDATE territory_plans tp
SET owner_id = up.id
FROM user_profiles up
WHERE tp.owner IS NOT NULL
  AND lower(trim(tp.owner)) = lower(trim(up.full_name));

-- 3. Create territory_plan_states junction table
CREATE TABLE territory_plan_states (
  plan_id TEXT NOT NULL REFERENCES territory_plans(id) ON DELETE CASCADE,
  state_fips VARCHAR(2) NOT NULL REFERENCES states(fips),
  PRIMARY KEY (plan_id, state_fips)
);

-- 4. Migrate existing stateFips into junction table
INSERT INTO territory_plan_states (plan_id, state_fips)
SELECT id, state_fips FROM territory_plans
WHERE state_fips IS NOT NULL;

-- 5. Create territory_plan_collaborators junction table
CREATE TABLE territory_plan_collaborators (
  plan_id TEXT NOT NULL REFERENCES territory_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, user_id)
);

-- 6. Drop old columns
ALTER TABLE territory_plans DROP COLUMN owner;
ALTER TABLE territory_plans DROP COLUMN state_fips;
