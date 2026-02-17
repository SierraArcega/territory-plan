-- migrate-unmatched-accounts.sql
--
-- Migrates rows from unmatched_accounts into the districts table using
-- synthetic M-series LEAIDs (M000001, M000002, ...).
--
-- Safe to run multiple times: each run starts the sequence after the
-- highest existing M-series LEAID, so previously migrated rows are
-- never touched.  The unmatched_accounts table is left intact.
--
-- Review carefully before executing against the live database.

DO $$
DECLARE
  next_num INT;
  rec      RECORD;
  new_leaid VARCHAR(7);
  migrated  INT := 0;
BEGIN
  -- Determine the next available M-series number.
  -- SUBSTRING(..., 2) strips the leading 'M', then casts to INT.
  SELECT COALESCE(MAX(CAST(SUBSTRING(leaid FROM 2) AS INT)), 0) + 1
    INTO next_num
    FROM districts
   WHERE leaid LIKE 'M%';

  -- Iterate through every unmatched account in insertion order.
  FOR rec IN SELECT * FROM unmatched_accounts ORDER BY id LOOP

    new_leaid := 'M' || LPAD(next_num::TEXT, 6, '0');

    INSERT INTO districts (
      leaid,
      name,
      account_type,
      state_fips,
      state_abbrev,
      sales_executive,
      lmsid,
      fy25_net_invoicing,
      fy26_net_invoicing,
      fy26_open_pipeline,
      fy27_open_pipeline,
      is_customer,
      has_open_pipeline,
      created_at,
      updated_at
    )
    SELECT
      new_leaid,
      rec.account_name,
      'other',
      COALESCE(s.fips, '00'),
      rec.state_abbrev,
      rec.sales_executive,
      rec.lmsid,
      rec.fy25_net_invoicing,
      rec.fy26_net_invoicing,
      rec.fy26_open_pipeline,
      rec.fy27_open_pipeline,
      rec.is_customer,
      rec.has_open_pipeline,
      rec.created_at,
      NOW()
    FROM (SELECT 1) AS dummy
    LEFT JOIN states s ON s.abbrev = rec.state_abbrev;

    next_num := next_num + 1;
    migrated  := migrated  + 1;
  END LOOP;

  RAISE NOTICE 'Migrated % unmatched accounts into districts.', migrated;
END $$;
