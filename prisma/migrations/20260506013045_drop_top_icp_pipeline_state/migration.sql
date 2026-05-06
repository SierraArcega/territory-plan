-- Drop 'top_icp' from the district_pipeline_state enum.
-- Existing rows with 'top_icp' will be folded into 'cold' on the next
-- refresh-rfp-signals run (or by the inline UPDATE below for cleanliness).

UPDATE rfps SET district_pipeline_state = 'cold' WHERE district_pipeline_state = 'top_icp';

ALTER TABLE rfps
  DROP CONSTRAINT rfps_district_pipeline_state_check;

ALTER TABLE rfps
  ADD CONSTRAINT rfps_district_pipeline_state_check
    CHECK (district_pipeline_state IS NULL
           OR district_pipeline_state IN ('active','recently_won','recently_lost','cold'));
