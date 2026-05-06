-- Add is_new + is_urgent denormalized booleans on rfps.
-- Refreshed by the same nightly signal-refresh job that maintains
-- district_pipeline_state. Flags are time-relative and will go stale
-- between refreshes — that's the documented tradeoff for not requiring
-- a date predicate in every rep-facing query.

ALTER TABLE rfps
  ADD COLUMN is_new    boolean NOT NULL DEFAULT false,
  ADD COLUMN is_urgent boolean NOT NULL DEFAULT false;

CREATE INDEX rfps_is_urgent_idx ON rfps (is_urgent) WHERE is_urgent = true;
CREATE INDEX rfps_is_new_idx    ON rfps (is_new)    WHERE is_new = true;
