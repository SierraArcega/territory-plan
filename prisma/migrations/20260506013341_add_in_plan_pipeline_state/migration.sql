-- Add 'in_plan' to the district_pipeline_state enum.
-- Fires when a district is in any FY27 territory plan and has no
-- active/recently-closed opportunity. Slots between recently_lost and cold.

ALTER TABLE rfps
  DROP CONSTRAINT rfps_district_pipeline_state_check;

ALTER TABLE rfps
  ADD CONSTRAINT rfps_district_pipeline_state_check
    CHECK (district_pipeline_state IS NULL
           OR district_pipeline_state IN ('active','recently_won','recently_lost','in_plan','cold'));
