-- Add self-referential parent_leaid column to districts for rollup relationships
-- (e.g., NYC DOE leaid 3620580 rolls up the 32 NYC Geographic Districts)
ALTER TABLE districts
  ADD COLUMN parent_leaid VARCHAR(7) NULL REFERENCES districts(leaid) ON DELETE SET NULL;

ALTER TABLE districts
  ADD CONSTRAINT districts_no_self_parent
  CHECK (parent_leaid IS NULL OR parent_leaid <> leaid);

CREATE INDEX idx_districts_parent_leaid ON districts(parent_leaid);
