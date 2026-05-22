"""Export an audit of vendor='fullmind' rows in district_financials.

Generates four CSVs:
  00_summary_by_fy.csv      — per-FY totals: live opp aggregate vs district_financials
  01_ghost_rows.csv         — every (leaid, fy) in district_financials whose live opps
                              sum to nothing, with annotations for row-by-row review
  02_reparented_opps.csv    — opps whose latest snapshot disagrees with the live opp's
                              current district_lea_id (full detail with anomaly flags)
  03_reparent_summary.csv   — same opps as 02, three-column human-readable view:
                              opp name, previously associated with, now associated with

Run: python3 scripts/audit-fullmind-financials.py
"""

import csv
import os
import pathlib
from datetime import date

import psycopg2
from dotenv import load_dotenv

ROOT = pathlib.Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / ".env.local", override=True)

DB_URL = os.environ.get("SUPABASE_DB_URL") or os.environ["DATABASE_URL"]
OUT = pathlib.Path.home() / f"financials-audit-{date.today().isoformat()}"
OUT.mkdir(exist_ok=True)


SUMMARY_SQL = """
WITH live_agg AS (
  SELECT 'FY' || RIGHT(school_yr, 2) AS fy,
         SUM(total_revenue)        AS live_total_revenue,
         SUM(net_booking_amount) FILTER (
           WHERE LOWER(stage) IN ('closed won','active','position purchased',
                                  'requisition received','return position pending')
         ) AS live_closed_won,
         SUM(net_booking_amount) FILTER (
           WHERE stage ~ '^[0-5]'
         ) AS live_open_pipeline,
         COUNT(*)                   AS live_opp_count
  FROM opportunities
  WHERE district_lea_id IS NOT NULL AND school_yr IS NOT NULL
  GROUP BY school_yr
),
df_agg AS (
  SELECT fiscal_year AS fy,
         SUM(total_revenue)        AS df_total_revenue,
         SUM(closed_won_bookings)  AS df_closed_won,
         SUM(open_pipeline)        AS df_open_pipeline,
         SUM(closed_won_opp_count + open_pipeline_opp_count) AS df_opp_count,
         COUNT(*)                  AS df_row_count
  FROM district_financials WHERE vendor='fullmind'
  GROUP BY fiscal_year
)
SELECT COALESCE(l.fy, d.fy) AS fy,
       l.live_total_revenue, d.df_total_revenue,
       (COALESCE(d.df_total_revenue,0) - COALESCE(l.live_total_revenue,0)) AS rev_gap,
       l.live_closed_won, d.df_closed_won,
       (COALESCE(d.df_closed_won,0) - COALESCE(l.live_closed_won,0)) AS closed_won_gap,
       l.live_open_pipeline, d.df_open_pipeline,
       (COALESCE(d.df_open_pipeline,0) - COALESCE(l.live_open_pipeline,0)) AS open_pipe_gap,
       l.live_opp_count, d.df_row_count
FROM live_agg l FULL OUTER JOIN df_agg d ON l.fy = d.fy
ORDER BY 1;
"""


GHOSTS_SQL = """
WITH live_tuples AS (
  SELECT district_lea_id AS leaid, 'FY' || RIGHT(school_yr,2) AS fy
  FROM opportunities
  WHERE district_lea_id IS NOT NULL AND school_yr IS NOT NULL
  GROUP BY district_lea_id, school_yr
),
live_any_fy AS (
  SELECT DISTINCT district_lea_id AS leaid FROM opportunities
  WHERE district_lea_id IS NOT NULL
),
snap_for_tuple AS (
  SELECT district_lea_id AS leaid, 'FY' || RIGHT(school_yr,2) AS fy,
         COUNT(DISTINCT opportunity_id) AS snapshot_opp_count,
         STRING_AGG(DISTINCT opportunity_id, ', ' ORDER BY opportunity_id) AS snapshot_opp_ids
  FROM opportunity_snapshots
  GROUP BY district_lea_id, school_yr
)
SELECT
  df.leaid,
  d.name                                  AS district_name,
  d.state_abbrev                          AS state,
  df.fiscal_year,
  df.total_revenue,
  df.closed_won_bookings,
  df.open_pipeline,
  df.closed_won_opp_count,
  df.open_pipeline_opp_count,
  df.session_count,
  df.last_updated::date                   AS last_updated,
  CASE
    WHEN df.last_updated < '2026-04-01'   THEN 'A_historical_pre_snapshot'
    WHEN COALESCE(s.snapshot_opp_count,0) > 0 THEN 'B_recent_reparent'
    ELSE 'B_recent_no_snapshot'
  END                                     AS cohort,
  CASE
    WHEN df.leaid LIKE 'M%'               THEN 'synthetic_M_placeholder'
    WHEN df.leaid LIKE '999%'             THEN 'synthetic_999_placeholder'
    WHEN df.leaid LIKE 'A%' OR df.leaid !~ '^[0-9]+$' THEN 'non_numeric_leaid'
    WHEN df.leaid = '0000001'             THEN 'test_district'
    ELSE 'standard_nces_leaid'
  END                                     AS leaid_class,
  (la.leaid IS NOT NULL)                  AS district_has_live_opps_other_fy,
  COALESCE(s.snapshot_opp_count, 0)       AS snapshot_opp_count_for_tuple,
  s.snapshot_opp_ids                      AS snapshot_opp_ids
FROM district_financials df
LEFT JOIN districts       d  ON d.leaid  = df.leaid
LEFT JOIN live_tuples     lt ON lt.leaid = df.leaid AND lt.fy  = df.fiscal_year
LEFT JOIN live_any_fy     la ON la.leaid = df.leaid
LEFT JOIN snap_for_tuple  s  ON s.leaid  = df.leaid AND s.fy   = df.fiscal_year
WHERE df.vendor='fullmind'
  AND lt.leaid IS NULL
  AND (df.total_revenue > 0 OR df.closed_won_bookings > 0 OR df.open_pipeline > 0
       OR df.closed_won_opp_count > 0 OR df.open_pipeline_opp_count > 0
       OR df.session_count > 0)
ORDER BY GREATEST(df.total_revenue, df.closed_won_bookings, df.open_pipeline) DESC;
"""


REPARENTS_SQL = """
WITH latest_snapshot AS (
  SELECT DISTINCT ON (opportunity_id)
    opportunity_id,
    district_lea_id    AS snap_lea_id,
    school_yr          AS snap_school_yr,
    'FY' || RIGHT(school_yr,2) AS snap_fy,
    net_booking_amount AS snap_booking,
    captured_at::date  AS last_snapshot
  FROM opportunity_snapshots
  ORDER BY opportunity_id, captured_at DESC
)
SELECT
  s.opportunity_id          AS opp_id,
  o.name                    AS opp_name,
  o.school_yr               AS school_yr,
  s.snap_fy                 AS fy,
  o.stage                   AS stage,
  o.close_date::date        AS close_date,
  o.sales_rep_name          AS sales_rep,
  s.snap_lea_id             AS old_lea_id,
  ds.name                   AS old_district_name,
  ds.state_abbrev           AS old_state,
  o.district_lea_id         AS new_lea_id,
  dn.name                   AS new_district_name,
  dn.state_abbrev           AS new_state,
  o.district_name           AS new_district_name_on_opp,
  s.snap_booking            AS snap_booking,
  o.net_booking_amount      AS live_booking,
  s.last_snapshot,
  o.synced_at::date         AS last_synced,
  -- anomaly flags
  CASE WHEN o.district_lea_id IS NULL THEN 'YES' END                  AS dropped_to_null,
  CASE WHEN o.district_lea_id = '0000001' THEN 'YES' END               AS new_is_test_district,
  CASE WHEN o.district_lea_id LIKE 'M%' AND s.snap_lea_id NOT LIKE 'M%' THEN 'YES' END AS real_to_synthetic,
  CASE WHEN s.snap_lea_id LIKE 'M%' AND o.district_lea_id NOT LIKE 'M%' THEN 'YES' END AS synthetic_to_real,
  CASE WHEN ds.state_abbrev IS NOT NULL AND dn.state_abbrev IS NOT NULL
            AND ds.state_abbrev <> dn.state_abbrev THEN 'YES' END     AS cross_state_remap,
  CASE WHEN normalize_district_name(ds.name) = normalize_district_name(dn.name)
            AND s.snap_lea_id <> o.district_lea_id THEN 'YES' END     AS same_name_diff_leaid
FROM latest_snapshot s
JOIN opportunities o ON o.id = s.opportunity_id
LEFT JOIN districts ds ON ds.leaid = s.snap_lea_id
LEFT JOIN districts dn ON dn.leaid = o.district_lea_id
WHERE s.snap_lea_id IS NOT NULL
  AND s.snap_lea_id IS DISTINCT FROM o.district_lea_id
ORDER BY (o.net_booking_amount IS NOT NULL) DESC, o.net_booking_amount DESC NULLS LAST;
"""


REPARENT_SUMMARY_SQL = """
WITH latest_snapshot AS (
  SELECT DISTINCT ON (opportunity_id)
    opportunity_id, district_lea_id AS snap_lea,
    'FY' || RIGHT(school_yr,2) AS snap_fy
  FROM opportunity_snapshots ORDER BY opportunity_id, captured_at DESC
)
SELECT
  COALESCE(NULLIF(o.name,''), '(no name — ' || LOWER(o.stage) || ', ' || s.snap_fy || ')') AS opp,
  CASE
    WHEN s.snap_lea LIKE 'M%' THEN ds.name || ' (synthetic placeholder)'
    WHEN ds.state_abbrev IS NOT NULL THEN ds.name || ' (' || ds.state_abbrev || ')'
    ELSE ds.name
  END AS previously_associated_with,
  CASE
    WHEN o.district_lea_id IS NULL THEN '(unmapped)'
    WHEN o.district_lea_id = '0000001' THEN dn.name || ' — TEST DISTRICT'
    WHEN o.district_lea_id LIKE 'M%' THEN dn.name || ' (synthetic placeholder)'
    WHEN dn.state_abbrev IS NOT NULL THEN dn.name || ' (' || dn.state_abbrev || ')'
    ELSE dn.name
  END AS now_associated_with
FROM latest_snapshot s
JOIN opportunities o ON o.id = s.opportunity_id
LEFT JOIN districts ds ON ds.leaid = s.snap_lea
LEFT JOIN districts dn ON dn.leaid = o.district_lea_id
WHERE s.snap_lea IS NOT NULL
  AND s.snap_lea IS DISTINCT FROM o.district_lea_id
ORDER BY o.net_booking_amount DESC NULLS LAST;
"""


def export_csv(conn, sql, out_path):
    with conn.cursor() as cur:
        cur.execute(sql)
        cols = [c[0] for c in cur.description]
        rows = cur.fetchall()
    with open(out_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in rows:
            w.writerow(["" if v is None else v for v in r])
    return len(rows)


def main():
    conn = psycopg2.connect(DB_URL)
    try:
        n0 = export_csv(conn, SUMMARY_SQL,           OUT / "00_summary_by_fy.csv")
        n1 = export_csv(conn, GHOSTS_SQL,            OUT / "01_ghost_rows.csv")
        n2 = export_csv(conn, REPARENTS_SQL,         OUT / "02_reparented_opps.csv")
        n3 = export_csv(conn, REPARENT_SUMMARY_SQL,  OUT / "03_reparent_summary.csv")
    finally:
        conn.close()
    print(f"Wrote audit to {OUT}")
    print(f"  00_summary_by_fy.csv      {n0} rows")
    print(f"  01_ghost_rows.csv         {n1} rows")
    print(f"  02_reparented_opps.csv    {n2} rows")
    print(f"  03_reparent_summary.csv   {n3} rows")


if __name__ == "__main__":
    main()
