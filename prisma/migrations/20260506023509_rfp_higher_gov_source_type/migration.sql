-- Persist HigherGov's source_type so we can distinguish biddable RFPs ('sled',
-- 'federal') from forecasts ('forecast') and similar non-biddable signals.
-- Backfill all existing rows to 'sled' since they were ingested via the
-- pre-saved-search code path that hardcoded source_type=sled.

ALTER TABLE rfps
  ADD COLUMN higher_gov_source_type varchar(20);

UPDATE rfps SET higher_gov_source_type = 'sled' WHERE higher_gov_source_type IS NULL;

CREATE INDEX rfps_higher_gov_source_type_idx ON rfps (higher_gov_source_type);
