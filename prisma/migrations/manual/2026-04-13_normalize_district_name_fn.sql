-- 2026-04-13_normalize_district_name_fn.sql
-- Idempotent installer for normalize_district_name().
-- Takes a raw district name and returns a canonical form for fuzzy equality.
-- Example:
--   'Richland County School District 1'  -> 'richland1'
--   'Richland School District 1'         -> 'richland1'
--   'Yuba City Unified School District'  -> 'yubacity'
--   'Woodville Elementary School District' -> 'woodville'

CREATE OR REPLACE FUNCTION normalize_district_name(name TEXT) RETURNS TEXT AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(coalesce($1, '')),
      -- strip common district-type words (order matters for multi-word phrases)
      '\s*(unified school district|independent school district|consolidated school district|public school district|school district|schools|school|district|unified|public|elementary|junior|senior|high|middle|central|city|county|independent|charter|community|academy|public)\s*',
      ' ',
      'g'
    ),
    -- strip any remaining non-alphanumeric
    '[^a-z0-9]+', '', 'g'
  );
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION normalize_district_name(TEXT) IS
  'Canonical form used to compare district names across opportunities.district_name and districts.name. Stops common district-type words and punctuation.';
