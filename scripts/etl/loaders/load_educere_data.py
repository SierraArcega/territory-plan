"""
Educere Competitor Spend CSV Data Loader

Parses the Educere unique PO CSV export and populates the competitor_spend table.
Aggregates spend by district and fiscal year.

The CSV contains columns: Agency NCES ID, Competitor, PO Number, PO Amount,
Agency, Agency City, Agency State, PO Signed Date, Fiscal Year.

Unlike the GovSpend CSV used by competitor_spend.py, this CSV has a pre-computed
Fiscal Year column, so FY is read directly rather than derived from the PO date.
"""

import os
import csv
import argparse
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from collections import defaultdict
import psycopg2
from psycopg2.extras import execute_values

# Import utilities
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.currency import parse_currency
from utils.leaid import normalize_leaid


# Default CSV path relative to project root
DEFAULT_CSV_PATH = "data/Educere_Unique_POs.xlsx - Unique POs.csv"

# Hardcoded competitor name
COMPETITOR = "Educere"


def parse_educere_row(row: Dict[str, str]) -> Optional[Dict]:
    """
    Parse a CSV row into a normalized record.

    Returns None if the row cannot be parsed (missing required fields).
    """
    # Get NCES ID (LEAID)
    leaid_raw = row.get("Agency NCES ID", "")
    leaid = normalize_leaid(leaid_raw)

    if not leaid:
        return None

    # Parse PO amount
    spend = parse_currency(row.get("PO Amount", ""))
    if spend <= 0:
        return None

    # Read fiscal year directly from CSV (e.g., "FY26", "FY22")
    fiscal_year = row.get("Fiscal Year", "").strip()
    if not fiscal_year:
        return None

    return {
        "leaid": leaid,
        "competitor": COMPETITOR,
        "fiscal_year": fiscal_year,
        "spend": spend,
    }


def load_educere_csv(csv_path: Path) -> List[Dict]:
    """
    Load and parse the Educere CSV file.

    Args:
        csv_path: Path to the CSV file

    Returns:
        List of parsed records
    """
    records = []
    skipped = 0
    empty_nces = 0

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Track empty NCES IDs separately
            leaid_raw = row.get("Agency NCES ID", "").strip()
            if not leaid_raw:
                empty_nces += 1
                skipped += 1
                continue

            record = parse_educere_row(row)
            if record:
                records.append(record)
            else:
                skipped += 1

    print(f"Parsed {len(records)} valid PO records")
    print(f"Skipped {skipped} rows ({empty_nces} with empty NCES ID)")
    return records


def aggregate_by_district_fy(records: List[Dict]) -> List[Dict]:
    """
    Aggregate PO records by district and fiscal year.

    Returns list of aggregated records with total_spend and po_count.
    """
    aggregated = defaultdict(lambda: {"total_spend": 0.0, "po_count": 0})

    for r in records:
        key = (r["leaid"], r["fiscal_year"])
        aggregated[key]["total_spend"] += r["spend"]
        aggregated[key]["po_count"] += 1

    result = []
    for (leaid, fiscal_year), data in aggregated.items():
        result.append({
            "leaid": leaid,
            "competitor": COMPETITOR,
            "fiscal_year": fiscal_year,
            "total_spend": round(data["total_spend"], 2),
            "po_count": data["po_count"],
        })

    print(f"Aggregated to {len(result)} district-FY combinations")
    return result


def get_valid_leaids(connection_string: str) -> set:
    """Get set of valid LEAIDs from districts table."""
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()
    cur.execute("SELECT leaid FROM districts")
    leaids = {row[0] for row in cur.fetchall()}
    cur.close()
    conn.close()
    return leaids


def insert_educere_spend(
    connection_string: str,
    records: List[Dict],
    valid_leaids: set,
    batch_size: int = 500
) -> Dict:
    """
    Insert Educere spend records into the database.

    Only inserts records for districts that exist in the districts table.
    Deletes only Educere rows before inserting (targeted delete, not truncate).

    Returns dict with counts: matched, unmatched, inserted.
    """
    # Filter to valid LEAIDs
    matched = [r for r in records if r["leaid"] in valid_leaids]
    unmatched = [r for r in records if r["leaid"] not in valid_leaids]

    print(f"Matched {len(matched)} records to valid districts")
    print(f"Unmatched {len(unmatched)} records (district not found)")

    if unmatched:
        # Log unique unmatched LEAIDs
        unmatched_leaids = sorted(set(r["leaid"] for r in unmatched))
        print(f"  Unmatched LEAIDs ({len(unmatched_leaids)}): {', '.join(unmatched_leaids[:10])}{'...' if len(unmatched_leaids) > 10 else ''}")

    if not matched:
        return {"matched": 0, "unmatched": len(unmatched), "inserted": 0}

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Targeted delete: only Educere rows
    print("Deleting existing Educere competitor_spend rows...")
    cur.execute("DELETE FROM competitor_spend WHERE competitor = %s", (COMPETITOR,))
    deleted = cur.rowcount
    print(f"  Deleted {deleted} existing rows")

    # Insert all matched records
    insert_sql = """
        INSERT INTO competitor_spend (
            leaid, competitor, fiscal_year, total_spend, po_count, last_updated
        ) VALUES %s
    """

    values = [
        (
            r["leaid"],
            r["competitor"],
            r["fiscal_year"],
            r["total_spend"],
            r["po_count"],
            datetime.now(),
        )
        for r in matched
    ]

    print(f"Inserting {len(values)} Educere competitor spend records...")
    for i in range(0, len(values), batch_size):
        batch = values[i:i + batch_size]
        execute_values(cur, insert_sql, batch)

    conn.commit()
    cur.close()
    conn.close()

    return {
        "matched": len(matched),
        "unmatched": len(unmatched),
        "inserted": len(matched),
    }


def log_data_refresh(
    connection_string: str,
    records_updated: int,
    records_failed: int,
    status: str,
    error_message: Optional[str] = None
):
    """Log the ETL run to data_refresh_logs table."""
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO data_refresh_logs (
            data_source, records_updated, records_failed, status, error_message, started_at, completed_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        "educere_spend",
        records_updated,
        records_failed,
        status,
        error_message,
        datetime.now(),
        datetime.now(),
    ))

    conn.commit()
    cur.close()
    conn.close()


def print_summary(records: List[Dict]):
    """Print summary statistics of the loaded data."""
    print("\n=== Educere Spend Summary ===")

    # By fiscal year
    by_fy = defaultdict(lambda: {"spend": 0, "count": 0, "districts": set()})
    for r in records:
        by_fy[r["fiscal_year"]]["spend"] += r["total_spend"]
        by_fy[r["fiscal_year"]]["count"] += r["po_count"]
        by_fy[r["fiscal_year"]]["districts"].add(r["leaid"])

    print("\nBy Fiscal Year:")
    total_spend = 0
    total_pos = 0
    total_districts = set()
    for fy in sorted(by_fy.keys(), reverse=True):
        data = by_fy[fy]
        print(f"  {fy}: ${data['spend']:,.2f} ({data['count']} POs, {len(data['districts'])} districts)")
        total_spend += data["spend"]
        total_pos += data["count"]
        total_districts.update(data["districts"])

    print(f"\nTotal: ${total_spend:,.2f} ({total_pos} POs, {len(total_districts)} unique districts)")


def main():
    """CLI entry point."""
    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description="Load Educere competitor spend CSV data")
    parser.add_argument(
        "--file",
        default=DEFAULT_CSV_PATH,
        help=f"Path to Educere CSV file (default: {DEFAULT_CSV_PATH})"
    )

    args = parser.parse_args()

    # Get connection string
    connection_string = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DIRECT_URL or DATABASE_URL environment variable not set")

    # Strip Supabase-specific query params
    if "?" in connection_string:
        base_url = connection_string.split("?")[0]
        params = connection_string.split("?")[1]
        valid_params = [p for p in params.split("&") if p and not p.startswith("pgbouncer")]
        connection_string = base_url + ("?" + "&".join(valid_params) if valid_params else "")

    csv_path = Path(args.file)
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    try:
        # Load and parse CSV
        records = load_educere_csv(csv_path)

        # Aggregate by district-FY
        aggregated = aggregate_by_district_fy(records)

        # Get valid LEAIDs
        print("Fetching valid LEAIDs from database...")
        valid_leaids = get_valid_leaids(connection_string)
        print(f"Found {len(valid_leaids)} valid district LEAIDs")

        # Insert to database
        result = insert_educere_spend(connection_string, aggregated, valid_leaids)

        # Print summary
        matched_records = [r for r in aggregated if r["leaid"] in valid_leaids]
        print_summary(matched_records)

        # Log success
        log_data_refresh(
            connection_string,
            records_updated=result["inserted"],
            records_failed=result["unmatched"],
            status="success"
        )

        # Refresh materialized view so map tiles reflect new data
        from utils.refresh_views import refresh_map_features
        refresh_map_features(connection_string)

        print(f"\n=== ETL Complete ===")
        print(f"Inserted: {result['inserted']} records")
        print(f"Unmatched: {result['unmatched']} records")

    except Exception as e:
        print(f"ETL failed: {e}")
        log_data_refresh(
            connection_string,
            records_updated=0,
            records_failed=0,
            status="failed",
            error_message=str(e)
        )
        raise


if __name__ == "__main__":
    main()
