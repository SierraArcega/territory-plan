"""
Backfill district_lea_id on Elevate K12 opportunities that the Railway sync
couldn't auto-resolve.

Background:
- The load_elevate_subscriptions.py loader matches all 951 CSV rows to
  opportunities by LMS Opp ID.
- ~29 of those parent opportunities have district_lea_id = NULL (the Railway
  sync's NCES auto-resolver couldn't map them, so the opp_agg + sub_agg CTEs
  in refresh_fullmind_financials() drop them and ~$2.1M of revenue is invisible
  to the district view.
- The CSV's "Contract: NCES ID" column DOES contain NCES IDs for most of those
  rows. We can backfill opportunities.district_lea_id from the CSV directly.

Behavior:
- Reads the EK12 CSV
- Builds a map: opp_id → (nces_id, account_name)
- Queries opportunities with NULL district_lea_id whose ID is in that map
- For each, derives a 7-char LEAID from the CSV NCES (handles zero-stripped
  6-digit district NCES and 11-digit school NCES — see derive_leaid_from_nces)
- Validates the derived LEAID exists in the districts table
- Bulk-UPDATEs opportunities (sets district_lea_id and district_nces_id)
- Calls refresh_fullmind_financials() so the previously-orphaned subscription
  revenue rolls into vendor='fullmind' rows
- Writes any remaining unresolved opportunities (no CSV NCES, or LEAID not in
  districts table) to reports/unresolved_elevate_opportunities.csv

Idempotent: re-running picks up no new work since the WHERE clause already
filters to district_lea_id IS NULL.
"""

import csv
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values

# Add ETL utils to path so we can reuse normalize_leaid
sys.path.insert(0, str(Path(__file__).parent / "etl"))
from utils.leaid import normalize_leaid  # noqa: E402


CSV_PATH = (
    Path(__file__).parent.parent
    / "data"
    / "Fullmind + EK12 _ Technology Transition - Sheet31.csv"
)
UNRESOLVED_REPORT_PATH = (
    Path(__file__).parent.parent / "reports" / "unresolved_elevate_opportunities.csv"
)


def get_connection_string() -> str:
    load_dotenv(Path(__file__).parent.parent / ".env")
    url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not url:
        raise ValueError("DIRECT_URL or DATABASE_URL not set")
    if "?" in url:
        base = url.split("?")[0]
        valid = [p for p in url.split("?")[1].split("&") if p and not p.startswith("pgbouncer")]
        url = base + ("?" + "&".join(valid) if valid else "")
    return url


def derive_leaid_from_nces(nces_raw: str) -> Optional[str]:
    """
    Convert a CSV NCES ID into a 7-char LEAID.

    Handles:
    - District NCES, possibly leading-zero-stripped:
        7 digits → use as-is, normalized
        ≤6 digits → zero-pad to 7 (e.g. "103120" → "0103120")
    - School NCES, possibly leading-zero-stripped:
        12 digits → first 7 digits is the parent district leaid
        11 digits → zero-pad to 12 first, then take first 7
                    (e.g. "80004602162" → "080004602162" → "0800046")

    Returns None for empty / non-numeric / unknown shapes.
    """
    if not nces_raw:
        return None
    s = nces_raw.strip()
    if not s or not s.isdigit():
        return None

    if len(s) <= 7:
        return normalize_leaid(s)

    if len(s) in (11, 12):
        padded = s.zfill(12)
        return padded[:7]

    return None


def main():
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV not found: {CSV_PATH}")

    # Build a map: opp_id → (csv_nces_raw, account_name)
    # The CSV has many rows per opp; we just need one entry per opp.
    opp_to_csv: Dict[str, Tuple[str, str]] = {}
    with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            opp_id = (row.get("LMS Opp ID") or "").strip()
            nces = (row.get("Contract: NCES ID") or "").strip()
            acct = (row.get("Account") or "").strip()
            if opp_id and opp_id not in opp_to_csv:
                opp_to_csv[opp_id] = (nces, acct)

    print(f"Built CSV map with {len(opp_to_csv)} unique opportunities")

    conn = psycopg2.connect(get_connection_string())
    cur = conn.cursor()

    # Pre-load valid leaids from districts table so we can validate before update
    cur.execute("SELECT leaid FROM districts")
    valid_leaids = {row[0] for row in cur.fetchall()}
    print(f"Loaded {len(valid_leaids)} valid leaids from districts table")

    # Find opportunities with NULL district_lea_id whose subscriptions
    # are in the subscriptions table (i.e., the EK12 unmapped opps).
    cur.execute(
        """
        SELECT DISTINCT o.id, o.name
        FROM opportunities o
        JOIN subscriptions s ON s.opportunity_id = o.id
        WHERE o.district_lea_id IS NULL
        ORDER BY o.name
        """
    )
    unmapped_opps = cur.fetchall()
    print(f"\nFound {len(unmapped_opps)} unique opportunities with NULL district_lea_id")

    updates: List[Tuple[str, str, str]] = []  # (leaid, nces_padded, opp_id)
    no_csv_nces: List[Tuple[str, str, str]] = []  # (opp_id, name, account)
    leaid_not_in_districts: List[Tuple[str, str, str, str]] = []  # (opp_id, name, raw_nces, derived_leaid)

    for opp_id, opp_name in unmapped_opps:
        csv_entry = opp_to_csv.get(opp_id)
        if not csv_entry:
            no_csv_nces.append((opp_id, opp_name or "", ""))
            continue

        raw_nces, account = csv_entry
        if not raw_nces:
            no_csv_nces.append((opp_id, opp_name or "", account))
            continue

        derived = derive_leaid_from_nces(raw_nces)
        if not derived:
            no_csv_nces.append((opp_id, opp_name or "", account))
            continue

        if derived not in valid_leaids:
            leaid_not_in_districts.append((opp_id, opp_name or "", raw_nces, derived))
            continue

        # Store the CSV nces in a normalized form too. For 7-digit it's the
        # padded leaid; for 12-digit school we keep the original (school NCES).
        nces_for_storage = raw_nces.zfill(12) if len(raw_nces) in (11, 12) else derived
        updates.append((derived, nces_for_storage, opp_id))

    print(f"\n  Updates ready:                    {len(updates)}")
    print(f"  Unresolvable (no CSV NCES):       {len(no_csv_nces)}")
    print(f"  Unresolvable (leaid not in DB):   {len(leaid_not_in_districts)}")

    if updates:
        # Bulk UPDATE via VALUES + JOIN. Single statement, atomic.
        update_sql = """
            UPDATE opportunities AS o
               SET district_lea_id  = u.new_leaid,
                   district_nces_id = u.new_nces
              FROM (VALUES %s) AS u(new_leaid, new_nces, opp_id)
             WHERE o.id = u.opp_id
               AND o.district_lea_id IS NULL
        """
        execute_values(cur, update_sql, updates, template="(%s, %s, %s)")
        print(f"\nUpdated {cur.rowcount} opportunity rows")

        # Refresh so the previously-hidden subscription revenue rolls into
        # vendor='fullmind' district_financials rows.
        print("\nRefreshing district_financials (refresh_fullmind_financials)...")
        cur.execute("SELECT refresh_fullmind_financials()")

        conn.commit()
    else:
        print("\nNo updates to apply.")

    # Post-update report: subs in vs out of rollup
    cur.execute(
        """
        SELECT
          COUNT(*) FILTER (WHERE o.district_lea_id IS NOT NULL) AS in_rollup,
          COUNT(*) FILTER (WHERE o.district_lea_id IS NULL)     AS still_orphaned,
          COALESCE(SUM(s.net_total) FILTER (WHERE o.district_lea_id IS NULL), 0)
            AS still_orphaned_revenue
        FROM subscriptions s
        JOIN opportunities o ON o.id = s.opportunity_id
        """
    )
    in_r, still_orphaned, still_rev = cur.fetchone()
    print("\n=== Post-backfill ===")
    print(f"  Subscriptions in rollup:        {in_r}")
    print(f"  Subscriptions still orphaned:   {still_orphaned}")
    print(f"  Still orphaned revenue:         ${float(still_rev or 0):,.2f}")

    cur.close()
    conn.close()

    # Write unresolved cases for manual handling
    unresolved = no_csv_nces + [
        (oid, name, f"derived={lid} not in districts; raw={raw}", "")
        for (oid, name, raw, lid) in leaid_not_in_districts
    ]
    if unresolved:
        UNRESOLVED_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(UNRESOLVED_REPORT_PATH, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["opportunity_id", "opportunity_name", "reason_or_csv_nces", "account"])
            for row in unresolved:
                writer.writerow(row)
        print(f"\nUnresolved cases written to: {UNRESOLVED_REPORT_PATH}")
        print(f"  ({len(unresolved)} opportunities need manual mapping)")

    print("\nDone!")


if __name__ == "__main__":
    main()
