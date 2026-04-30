-- Maps a session timestamp to a Fullmind fiscal-year string ("YYYY-YY").
-- Fiscal years run July 1 → June 30. Returns NULL for NULL input.
-- Example: '2025-07-01' → '2025-26'; '2025-06-30' → '2024-25'.
--
-- Used by the rep_session_actuals view to bucket session revenue by when the
-- session actually happened, not by the parent opportunity's school_yr tag.
-- See spec: Docs/superpowers/specs/2026-04-30-leaderboard-fy-attribution-fix-design.md

CREATE OR REPLACE FUNCTION session_fy(ts timestamptz) RETURNS text AS $$
  SELECT CASE
    WHEN ts IS NULL THEN NULL
    WHEN EXTRACT(MONTH FROM ts) >= 7
      THEN EXTRACT(YEAR FROM ts)::int::text || '-' ||
           LPAD(((EXTRACT(YEAR FROM ts)::int + 1) % 100)::text, 2, '0')
    ELSE (EXTRACT(YEAR FROM ts)::int - 1)::text || '-' ||
         LPAD((EXTRACT(YEAR FROM ts)::int % 100)::text, 2, '0')
  END
$$ LANGUAGE SQL IMMUTABLE;
