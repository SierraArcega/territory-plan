"""
Vendor Financials CSV Loader

Loads vendor financial data from the Customer Book Consolidation CSV
into the vendor_financials table.

Handles:
- Fullmind and Elevate K12 data
- Rows with "ADD" as LEA ID get generated synthetic IDs + stub district records
- Currency parsing ($1,234.56 format)
- Multi-FY loading: FY24, FY25, FY26 metrics and FY27 pipeline from a single row

Usage:
    python3 vendor_financials.py /path/to/customer-book.csv
    python3 vendor_financials.py  # defaults to data/Customer Book Consolidation - Combined Targets + Pipeline (1).csv
"""

import os
import csv
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
import psycopg2
from psycopg2.extras import execute_values
from tqdm import tqdm

# Import utilities
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.currency import parse_currency
from utils.leaid import normalize_leaid, STATE_ABBREV_TO_FIPS

# Vendor name mapping: CSV "Company" -> DB vendor ID
COMPANY_TO_VENDOR = {
    "Fullmind": "fullmind",
    "Elevate K12": "elevate",
    "Proximity Learning": "proximity",
    "Tutored By Teachers": "tbt",
}


def get_db_connection():
    """Connect to the database using DIRECT_URL or DATABASE_URL env var."""
    database_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DIRECT_URL or DATABASE_URL environment variable is required")
    return psycopg2.connect(database_url)


def generate_synthetic_leaid(state_abbrev: str, seq: int) -> str:
    """
    Generate a synthetic LEA ID for accounts without a real NCES ID.

    Format: {state_fips}9{seq:04d}
    The '9' prefix in the district portion avoids collision with real NCES IDs
    (real district IDs rarely start with 9).
    """
    fips = STATE_ABBREV_TO_FIPS.get(state_abbrev.upper())
    if not fips:
        fips = "99"  # Unknown state
    return f"{fips}9{seq:04d}"


def ensure_district_exists(cur, leaid: str, name: str, state_abbrev: str):
    """Insert a stub district record if it doesn't exist."""
    # Truncate state_abbrev to 2 chars for DB column constraint
    abbrev = state_abbrev.upper()[:2] if state_abbrev else "XX"
    state_fips = STATE_ABBREV_TO_FIPS.get(abbrev, "99")
    cur.execute(
        """
        INSERT INTO districts (leaid, name, state_abbrev, state_fips, account_type, updated_at)
        VALUES (%s, %s, %s, %s, 'other', NOW())
        ON CONFLICT (leaid) DO NOTHING
        """,
        (leaid, name, abbrev, state_fips),
    )


def parse_csv(filepath: str) -> List[Dict]:
    """Parse the Customer Book CSV and return a list of row dicts."""
    rows = []
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def load_vendor_financials(filepath: str, dry_run: bool = False):
    """Load vendor financials from Customer Book CSV."""
    rows = parse_csv(filepath)
    print(f"Parsed {len(rows)} rows from CSV")

    conn = get_db_connection()
    cur = conn.cursor()

    # Track synthetic LEA ID generation per state
    synthetic_seq: Dict[str, int] = defaultdict(int)

    # First pass: find existing max synthetic IDs to avoid collisions
    cur.execute(
        "SELECT leaid FROM districts WHERE leaid ~ '^[0-9]{2}9[0-9]{4}$'"
    )
    for (existing_leaid,) in cur.fetchall():
        state_fips = existing_leaid[:2]
        seq = int(existing_leaid[3:])
        for abbrev, fips in STATE_ABBREV_TO_FIPS.items():
            if fips == state_fips:
                synthetic_seq[abbrev] = max(synthetic_seq[abbrev], seq)

    # Process rows
    fy26_records = []  # (leaid, vendor, fy, metrics...)
    fy25_records = []
    fy24_records = []
    fy27_records = []
    skipped = 0
    generated = 0

    for row in tqdm(rows, desc="Processing rows"):
        company = row.get("Company", "").strip()
        vendor = COMPANY_TO_VENDOR.get(company)
        if not vendor:
            skipped += 1
            continue

        raw_leaid = row.get("LEA ID", "").strip()
        state_abbrev = row.get("State", "").strip()
        account_name = row.get("Account", "").strip()

        if raw_leaid == "ADD" or not raw_leaid:
            # Generate synthetic LEA ID
            synthetic_seq[state_abbrev] += 1
            leaid = generate_synthetic_leaid(state_abbrev, synthetic_seq[state_abbrev])
            if not dry_run:
                ensure_district_exists(cur, leaid, account_name, state_abbrev)
            generated += 1
        else:
            leaid = normalize_leaid(raw_leaid)
            if not leaid:
                skipped += 1
                continue

        # Parse FY26 metrics
        fy26_pipeline = parse_currency(row.get("FY26 Pipeline"))
        fy26_bookings = parse_currency(row.get("FY26 Bookings"))
        fy26_delivered = parse_currency(row.get("FY26 Delivered"))
        fy26_scheduled = parse_currency(row.get("FY26 Scheduled"))
        fy26_deferred = parse_currency(row.get("Deferred Revenue"))
        fy26_revenue = parse_currency(row.get("FY26 Revenue"))

        has_fy26 = any([fy26_pipeline, fy26_bookings, fy26_delivered,
                        fy26_scheduled, fy26_deferred, fy26_revenue])
        if has_fy26:
            fy26_records.append((
                leaid, vendor, "FY26",
                fy26_pipeline,    # open_pipeline
                fy26_bookings,    # closed_won_bookings
                0,                # invoicing (not in CSV)
                fy26_scheduled,   # scheduled_revenue
                fy26_delivered,   # delivered_revenue
                fy26_deferred,    # deferred_revenue
                fy26_revenue,     # total_revenue
                0,                # delivered_take
                0,                # scheduled_take
                0,                # all_take
            ))

        # Parse FY25 metrics
        fy25_bookings = parse_currency(row.get("FY25 Bookings"))
        fy25_revenue = parse_currency(row.get("FY25 Revenues"))

        has_fy25 = any([fy25_bookings, fy25_revenue])
        if has_fy25:
            fy25_records.append((
                leaid, vendor, "FY25",
                0,                # open_pipeline
                fy25_bookings,    # closed_won_bookings
                0,                # invoicing
                0,                # scheduled_revenue
                0,                # delivered_revenue
                0,                # deferred_revenue
                fy25_revenue,     # total_revenue
                0,                # delivered_take
                0,                # scheduled_take
                0,                # all_take
            ))

        # Parse FY24 metrics
        fy24_bookings = parse_currency(row.get("FY24 Bookings"))
        fy24_revenue = parse_currency(row.get("FY24 Revenues"))

        has_fy24 = any([fy24_bookings, fy24_revenue])
        if has_fy24:
            fy24_records.append((
                leaid, vendor, "FY24",
                0,                # open_pipeline
                fy24_bookings,    # closed_won_bookings
                0,                # invoicing
                0,                # scheduled_revenue
                0,                # delivered_revenue
                0,                # deferred_revenue
                fy24_revenue,     # total_revenue
                0,                # delivered_take
                0,                # scheduled_take
                0,                # all_take
            ))

        # Parse FY27 metrics (pipeline only)
        # CSV has two FY27 columns ("FY27 Open Pipeline" and "FY27 Pipeline")
        # that contain identical values — use the first one.
        fy27_pipeline = parse_currency(row.get("FY27 Open Pipeline"))

        has_fy27 = fy27_pipeline > 0
        if has_fy27:
            fy27_records.append((
                leaid, vendor, "FY27",
                fy27_pipeline,    # open_pipeline
                0,                # closed_won_bookings
                0,                # invoicing
                0,                # scheduled_revenue
                0,                # delivered_revenue
                0,                # deferred_revenue
                0,                # total_revenue
                0,                # delivered_take
                0,                # scheduled_take
                0,                # all_take
            ))

    all_records = fy26_records + fy25_records + fy24_records + fy27_records
    print(f"Generated {generated} synthetic LEA IDs")
    print(f"Skipped {skipped} rows (unknown company or invalid LEA ID)")
    print(f"Prepared {len(fy26_records)} FY26, {len(fy25_records)} FY25, {len(fy24_records)} FY24, {len(fy27_records)} FY27 records")

    if dry_run:
        print("DRY RUN — no data written")
        conn.close()
        return

    # Upsert into vendor_financials
    if all_records:
        execute_values(
            cur,
            """
            INSERT INTO vendor_financials (
                leaid, vendor, fiscal_year,
                open_pipeline, closed_won_bookings, invoicing,
                scheduled_revenue, delivered_revenue, deferred_revenue, total_revenue,
                delivered_take, scheduled_take, all_take
            ) VALUES %s
            ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
                open_pipeline = GREATEST(vendor_financials.open_pipeline, EXCLUDED.open_pipeline),
                closed_won_bookings = GREATEST(vendor_financials.closed_won_bookings, EXCLUDED.closed_won_bookings),
                invoicing = GREATEST(vendor_financials.invoicing, EXCLUDED.invoicing),
                scheduled_revenue = GREATEST(vendor_financials.scheduled_revenue, EXCLUDED.scheduled_revenue),
                delivered_revenue = GREATEST(vendor_financials.delivered_revenue, EXCLUDED.delivered_revenue),
                deferred_revenue = GREATEST(vendor_financials.deferred_revenue, EXCLUDED.deferred_revenue),
                total_revenue = GREATEST(vendor_financials.total_revenue, EXCLUDED.total_revenue),
                delivered_take = GREATEST(vendor_financials.delivered_take, EXCLUDED.delivered_take),
                scheduled_take = GREATEST(vendor_financials.scheduled_take, EXCLUDED.scheduled_take),
                all_take = GREATEST(vendor_financials.all_take, EXCLUDED.all_take),
                last_updated = NOW()
            """,
            all_records,
        )

    conn.commit()
    print(f"Loaded {len(all_records)} vendor_financials records")

    # Log to data_refresh_logs
    try:
        cur.execute(
            """
            INSERT INTO data_refresh_logs (source, records_processed, status, details)
            VALUES ('vendor_financials_csv', %s, 'success', %s)
            """,
            (len(all_records), f"FY26: {len(fy26_records)}, FY25: {len(fy25_records)}, FY24: {len(fy24_records)}, FY27: {len(fy27_records)}, generated LEAIDs: {generated}"),
        )
        conn.commit()
    except Exception:
        pass  # data_refresh_logs may not exist

    cur.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load vendor financials from Customer Book CSV")
    default_csv = str(Path(__file__).parent.parent.parent.parent / "data" /
                      "Customer Book Consolidation - Combined Targets + Pipeline (1).csv")
    parser.add_argument("csv_path", nargs="?", default=default_csv,
                        help="Path to CSV file")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse CSV without writing to database")
    args = parser.parse_args()

    load_vendor_financials(args.csv_path, dry_run=args.dry_run)
