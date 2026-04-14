-- 2026-04-13_normalize_district_name_fn.sql
-- Idempotent installer for normalize_district_name().
-- Takes a raw district name and returns a canonical form for fuzzy equality.
-- Example:
--   'Richland County School District 1'  -> 'richland1'
--   'Richland School District 1'         -> 'richland1'
--   'Yuba City Unified School District'  -> 'yuba'
--   'Woodville Elementary School District' -> 'woodville'

-- NOTE: Task 4's Python equivalent (scheduler/sync/district_resolver.py) must
-- produce byte-identical output. Two porting hazards to watch:
--   1. `\s` here is POSIX (ASCII-only); Python's default `re.\s` is Unicode.
--      Use re.ASCII or literal [ \t\n\r\f\v] in Python to match.
--   2. POSIX is leftmost-longest; Python re is leftmost-first. Keep the
--      multi-word phrases (e.g. "unified school district") listed BEFORE
--      their component words in the alternation — current ordering is safe.
CREATE OR REPLACE FUNCTION normalize_district_name(name TEXT) RETURNS TEXT AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(coalesce(name, '')),
      -- strip common district-type words (order matters for multi-word phrases)
      -- Word list empirically derived from districts.name and opportunities.district_name.
      -- Extend if a legitimate match is rejected in the Task 2 dry-run review.
      '\s*(unified school district|independent school district|consolidated school district|public school district|school district|schools|school|district|unified|public|elementary|junior|senior|high|middle|central|city|county|independent|charter|community|academy)\s*',
      ' ',
      'g'
    ),
    -- strip any remaining non-alphanumeric
    '[^a-z0-9]+', '', 'g'
  );
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION normalize_district_name(TEXT) IS
  'Canonical form used to compare district names across opportunities.district_name and districts.name. Stops common district-type words and punctuation.';
