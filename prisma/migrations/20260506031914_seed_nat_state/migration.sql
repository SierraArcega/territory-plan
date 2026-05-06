-- Add a synthetic 'NAT' (national / federal) entry to the states table for
-- federal-scope agencies that don't have a place-of-performance state.
-- Used by SAM, SBIR, grant, and forecast source-type RFPs that lack pop_state.
--
-- 'NAT' is 3 chars, breaking the original varchar(2) USPS assumption — widen
-- the relevant columns to varchar(8). Other tables (districts, schools, etc.)
-- only ever hold real USPS codes today, so we leave them at varchar(2).

ALTER TABLE states     ALTER COLUMN abbrev       TYPE varchar(8);
ALTER TABLE rfps       ALTER COLUMN state_abbrev TYPE varchar(8);

INSERT INTO states (fips, abbrev, name, created_at, updated_at)
VALUES ('95', 'NAT', 'National / Federal', now(), now())
ON CONFLICT (fips) DO NOTHING;

-- Backfill existing rfps: federal-scope source types that landed with NULL or
-- literal 'NA' state get bucketed into 'NAT' retroactively, so the agency-
-- district-maps triage page and the state filter behave consistently.
UPDATE rfps
SET state_abbrev = 'NAT', state_fips = '95'
WHERE higher_gov_source_type IN ('sam', 'sbir', 'grant', 'forecast')
  AND (state_abbrev IS NULL OR upper(state_abbrev) = 'NA');
