"""
Load Elevate K12 subscription line items (post-merger acquired data) into the
subscriptions table, then refresh district_financials so the revenue rolls into
vendor='fullmind' rows.

Source: data/Fullmind + EK12 _ Technology Transition - Sheet31.csv

Behavior:
- Reads the CSV (one row per subscription line item)
- Looks each row's "LMS Opp ID" up against opportunities.id
- Skips rows with no matching opportunity, writes them to a report file
- Full-replace strategy: DELETE FROM subscriptions, then bulk INSERT
- Calls refresh_fullmind_financials() so subscription revenue rolls into
  vendor='fullmind' rows in district_financials
- Calls refresh_map_features() so the choropleth picks up the new revenue
- Prints a summary by FY plus the top 5 districts by revenue

The loader is idempotent — re-running with an updated CSV produces the same
end state.
"""

import csv
import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values

# Add ETL utils to path
sys.path.insert(0, str(Path(__file__).parent / "etl"))
from utils.currency import parse_currency  # noqa: E402
from utils.refresh_views import refresh_map_features  # noqa: E402


CSV_PATH = (
    Path(__file__).parent.parent
    / "data"
    / "Fullmind + EK12 _ Technology Transition - Sheet31.csv"
)
UNMATCHED_REPORT_PATH = (
    Path(__file__).parent.parent / "reports" / "unmatched_elevate_subscriptions.csv"
)

# Columns we insert into subscriptions, in order. Must match the SQL
# INSERT below.
INSERT_COLUMNS = [
    "id",
    "opportunity_id",
    "contract_number",
    "net_price",
    "quantity",
    "net_total",
    "product",
    "product_type",
    "sub_product",
    "course_name",
    "curriculum_provider",
    "school_name",
    "grade",
    "office_hours",
    "cc_teacher_collab_meetings",
    "start_date",
    "delivery_end_date",
    "subscription_created_date",
    "contract_created_date",
    "contract_owner_name",
]


def get_connection_string() -> str:
    """Read DIRECT_URL or DATABASE_URL from .env, sanitize for psycopg2."""
    load_dotenv(Path(__file__).parent.parent / ".env")
    connection_string = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DIRECT_URL or DATABASE_URL not set")

    # Strip pgbouncer params for psycopg2
    if "?" in connection_string:
        base_url = connection_string.split("?")[0]
        params = connection_string.split("?")[1]
        valid_params = [
            p for p in params.split("&") if p and not p.startswith("pgbouncer")
        ]
        connection_string = base_url + (
            "?" + "&".join(valid_params) if valid_params else ""
        )
    return connection_string


def parse_date(value: Optional[str]) -> Optional[date]:
    """Parse M/D/YYYY → date, or return None for blanks."""
    if not value:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return datetime.strptime(value, "%m/%d/%Y").date()
    except ValueError:
        return None


def parse_int(value: Optional[str]) -> Optional[int]:
    """Parse an integer (signed). Returns None for blanks."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        try:
            return int(float(value))
        except ValueError:
            return None


def main():
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV not found: {CSV_PATH}")

    print(f"Reading {CSV_PATH.name}...")
    rows: List[Dict[str, str]] = []
    with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    print(f"  Parsed {len(rows)} rows from CSV")

    conn = psycopg2.connect(get_connection_string())
    cur = conn.cursor()

    # Pre-fetch valid opportunity IDs so we can detect unmatched rows
    print("Loading valid opportunity IDs...")
    cur.execute("SELECT id FROM opportunities")
    valid_opp_ids = {row[0] for row in cur.fetchall()}
    print(f"  Found {len(valid_opp_ids)} opportunities in DB")

    # Build records, partitioning into matched / unmatched
    records: List[Tuple] = []
    unmatched: List[Dict[str, str]] = []
    seen_sub_ids: Set[str] = set()
    duplicates_in_csv: List[str] = []

    for row in rows:
        sub_id = (row.get("Subscription: Subscription #") or "").strip()
        opp_id = (row.get("LMS Opp ID") or "").strip()

        if not sub_id or not opp_id:
            # Blank row or missing key — skip silently
            continue

        if sub_id in seen_sub_ids:
            duplicates_in_csv.append(sub_id)
            continue
        seen_sub_ids.add(sub_id)

        if opp_id not in valid_opp_ids:
            unmatched.append(row)
            continue

        records.append(
            (
                sub_id,
                opp_id,
                (row.get("Contract #") or "").strip() or None,
                parse_currency(row.get("Net Price")),
                parse_int(row.get("Quantity")),
                parse_currency(row.get("Net Total")),
                (row.get("Product") or "").strip() or None,
                (row.get("Product Type") or "").strip() or None,
                (row.get("Sub Product") or "").strip() or None,
                (row.get("Course Name") or "").strip() or None,
                (row.get("Curriculum Provider") or "").strip() or None,
                (row.get("School (Account)") or "").strip() or None,
                (row.get("Grade") or "").strip() or None,
                (row.get("Office Hours") or "").strip() or None,
                (row.get("CC/Teacher Collaboration Meetings") or "").strip() or None,
                parse_date(row.get("Start Date")),
                parse_date(row.get("Delivery End Date")),
                parse_date(row.get("Subscription: Created Date")),
                parse_date(row.get("Contract: Created Date")),
                (row.get("Contract: Contract Owner") or "").strip() or None,
            )
        )

    print(f"  Matched: {len(records)} | Unmatched: {len(unmatched)}")
    if duplicates_in_csv:
        print(
            f"  Skipped {len(duplicates_in_csv)} duplicate subscription IDs in CSV: "
            f"{duplicates_in_csv[:5]}"
            + ("..." if len(duplicates_in_csv) > 5 else "")
        )

    # Full-replace: DELETE then INSERT
    cur.execute("SELECT COUNT(*) FROM subscriptions")
    existing_count = cur.fetchone()[0]
    print(f"\nExisting subscriptions in DB: {existing_count}")
    print(f"New rows to insert: {len(records)}")

    cur.execute("DELETE FROM subscriptions")
    deleted = cur.rowcount
    print(f"Deleted {deleted} existing rows")

    if records:
        insert_sql = f"""
            INSERT INTO subscriptions ({", ".join(INSERT_COLUMNS)})
            VALUES %s
        """
        execute_values(cur, insert_sql, records, page_size=500)
        print(f"Inserted {len(records)} subscription rows")

    # Refresh the rollup function so subscription revenue lands in
    # vendor='fullmind' district_financials rows
    print("\nRefreshing district_financials (refresh_fullmind_financials)...")
    cur.execute("SELECT refresh_fullmind_financials()")

    conn.commit()

    # Report: subscription totals by FY (via the rollup the refresh function just wrote)
    cur.execute(
        """
        SELECT fiscal_year,
               COUNT(*)               AS districts,
               SUM(subscription_count) AS subs,
               SUM(total_revenue)     AS total_rev
        FROM district_financials
        WHERE vendor = 'fullmind'
          AND COALESCE(subscription_count, 0) > 0
        GROUP BY fiscal_year
        ORDER BY fiscal_year
        """
    )
    print("\n=== Subscription rollup (vendor='fullmind') ===")
    print(f"{'FY':<6} {'Districts':>10} {'Subs':>8} {'Total Revenue':>20}")
    grand_total = 0.0
    for fy, districts, subs, total_rev in cur.fetchall():
        rev = float(total_rev or 0)
        grand_total += rev
        print(f"{fy:<6} {districts:>10} {subs:>8} {rev:>20,.2f}")
    print(f"{'TOTAL':<6} {'':>10} {'':>8} {grand_total:>20,.2f}")

    # Top 5 districts by total_revenue with subscription_count > 0
    cur.execute(
        """
        SELECT df.leaid, d.name, df.fiscal_year,
               df.subscription_count, df.total_revenue
        FROM district_financials df
        JOIN districts d ON d.leaid = df.leaid
        WHERE df.vendor = 'fullmind'
          AND COALESCE(df.subscription_count, 0) > 0
        ORDER BY df.total_revenue DESC
        LIMIT 5
        """
    )
    print("\n=== Top 5 districts (vendor='fullmind') ===")
    for leaid, name, fy, subs, total_rev in cur.fetchall():
        print(f"  {leaid} {name[:40]:<40} {fy} subs={subs:<4} ${float(total_rev):,.2f}")

    cur.close()
    conn.close()

    # Refresh map tiles so choropleth picks up the new revenue
    refresh_map_features(get_connection_string())

    # Write unmatched report (if any)
    if unmatched:
        UNMATCHED_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        fieldnames = list(unmatched[0].keys())
        with open(UNMATCHED_REPORT_PATH, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(unmatched)
        print(f"\nUnmatched rows written to: {UNMATCHED_REPORT_PATH}")
        print(
            f"  ({len(unmatched)} subscription rows whose LMS Opp ID was not found in opportunities)"
        )

    print("\nDone!")


if __name__ == "__main__":
    main()
