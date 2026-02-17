"""
Competitor Spend CSV Data Loader

Parses the GovSpend competitor PO data CSV and populates the competitor_spend table.
Aggregates spend by district, competitor, and fiscal year.

Fiscal Year Logic:
- FY runs July 1 - June 30
- July 2025 - June 2026 = FY26
- July 2024 - June 2025 = FY25
"""

import os
import csv
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from collections import defaultdict
import psycopg2
from psycopg2.extras import execute_values
from tqdm import tqdm

# Import utilities
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.currency import parse_currency
from utils.leaid import normalize_leaid


def parse_po_date(date_str: str) -> Optional[datetime]:
    """
    Parse PO date from ISO format string.

    Handles formats like: 2026-01-28T12:00:00.000Z
    """
    if not date_str or not date_str.strip():
        return None

    try:
        # Handle ISO format with Z suffix
        date_str = date_str.strip().replace('Z', '+00:00')
        return datetime.fromisoformat(date_str.replace('.000+00:00', '+00:00'))
    except ValueError:
        try:
            # Try parsing just the date portion
            return datetime.strptime(date_str[:10], '%Y-%m-%d')
        except ValueError:
            return None


def get_fiscal_year(date: datetime) -> str:
    """
    Get fiscal year string from a date.

    Fiscal year runs July 1 - June 30.
    - July 2025 - June 2026 = FY26
    - July 2024 - June 2025 = FY25
    """
    if date.month >= 7:
        # July-December: FY is next calendar year
        fy = date.year + 1
    else:
        # January-June: FY is current calendar year
        fy = date.year

    # Return last 2 digits with FY prefix
    return f"FY{fy % 100:02d}"


def parse_csv_row(row: Dict[str, str]) -> Optional[Dict]:
    """
    Parse a CSV row into a normalized record.

    Returns None if the row cannot be parsed (missing required fields).
    """
    # Get NCES ID (LEAID)
    leaid_raw = row.get("NCES ID - Clean", "")
    leaid = normalize_leaid(leaid_raw)

    if not leaid:
        return None

    # Get competitor name
    competitor = row.get("Competitor", "").strip()
    if not competitor:
        return None

    # Parse PO date
    po_date_str = row.get("PO Date", "")
    po_date = parse_po_date(po_date_str)
    if not po_date:
        return None

    # Parse spend amount
    spend = parse_currency(row.get("PO Spend", ""))
    if spend <= 0:
        return None

    # Calculate fiscal year
    fiscal_year = get_fiscal_year(po_date)

    return {
        "leaid": leaid,
        "competitor": competitor,
        "fiscal_year": fiscal_year,
        "spend": spend,
        "po_id": row.get("POID", ""),
    }


def load_competitor_spend_csv(csv_path: Path) -> List[Dict]:
    """
    Load and parse the competitor spend CSV file.

    Args:
        csv_path: Path to the CSV file

    Returns:
        List of parsed records
    """
    records = []
    skipped = 0

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in tqdm(reader, desc="Parsing CSV"):
            record = parse_csv_row(row)
            if record:
                records.append(record)
            else:
                skipped += 1

    print(f"Parsed {len(records)} valid PO records, skipped {skipped}")
    return records


def aggregate_by_district_competitor_fy(records: List[Dict]) -> List[Dict]:
    """
    Aggregate PO records by district, competitor, and fiscal year.

    Returns list of aggregated records with total_spend and po_count.
    """
    # Use nested defaultdict for aggregation
    aggregated = defaultdict(lambda: {"total_spend": 0.0, "po_count": 0})

    for r in records:
        key = (r["leaid"], r["competitor"], r["fiscal_year"])
        aggregated[key]["total_spend"] += r["spend"]
        aggregated[key]["po_count"] += 1

    # Convert to list of records
    result = []
    for (leaid, competitor, fiscal_year), data in aggregated.items():
        result.append({
            "leaid": leaid,
            "competitor": competitor,
            "fiscal_year": fiscal_year,
            "total_spend": round(data["total_spend"], 2),
            "po_count": data["po_count"],
        })

    print(f"Aggregated to {len(result)} district-competitor-FY combinations")
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


def upsert_competitor_spend(
    connection_string: str,
    records: List[Dict],
    valid_leaids: set,
    batch_size: int = 500
) -> Dict:
    """
    Upsert competitor spend records into the database.

    Only inserts records for districts that exist in the districts table.

    Returns dict with counts: matched, unmatched, upserted.
    """
    # Filter to valid LEAIDs
    matched = [r for r in records if r["leaid"] in valid_leaids]
    unmatched = [r for r in records if r["leaid"] not in valid_leaids]

    print(f"Matched {len(matched)} records to valid districts")
    print(f"Unmatched {len(unmatched)} records (district not found)")

    if not matched:
        return {"matched": 0, "unmatched": len(unmatched), "upserted": 0}

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Clear existing data (full refresh approach)
    print("Clearing existing competitor_spend data...")
    cur.execute("TRUNCATE TABLE competitor_spend")

    # Insert all records
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

    print(f"Inserting {len(values)} competitor spend records...")
    for i in tqdm(range(0, len(values), batch_size), desc="Inserting"):
        batch = values[i:i+batch_size]
        execute_values(cur, insert_sql, batch)

    conn.commit()
    cur.close()
    conn.close()

    return {
        "matched": len(matched),
        "unmatched": len(unmatched),
        "upserted": len(matched),
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
        "competitor_spend",
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
    print("\n=== Competitor Spend Summary ===")

    # By competitor
    by_competitor = defaultdict(lambda: {"spend": 0, "count": 0, "districts": set()})
    for r in records:
        by_competitor[r["competitor"]]["spend"] += r["total_spend"]
        by_competitor[r["competitor"]]["count"] += r["po_count"]
        by_competitor[r["competitor"]]["districts"].add(r["leaid"])

    print("\nBy Competitor:")
    for competitor, data in sorted(by_competitor.items()):
        print(f"  {competitor}:")
        print(f"    Total Spend: ${data['spend']:,.2f}")
        print(f"    PO Count: {data['count']}")
        print(f"    Districts: {len(data['districts'])}")

    # By fiscal year
    by_fy = defaultdict(lambda: {"spend": 0, "count": 0})
    for r in records:
        by_fy[r["fiscal_year"]]["spend"] += r["total_spend"]
        by_fy[r["fiscal_year"]]["count"] += r["po_count"]

    print("\nBy Fiscal Year:")
    for fy in sorted(by_fy.keys(), reverse=True):
        data = by_fy[fy]
        print(f"  {fy}: ${data['spend']:,.2f} ({data['count']} POs)")


def main():
    """CLI entry point."""
    import argparse
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description="Load competitor spend CSV data")
    parser.add_argument("--file", required=True, help="Path to competitor spend CSV file")

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
        records = load_competitor_spend_csv(csv_path)

        # Aggregate by district-competitor-FY
        aggregated = aggregate_by_district_competitor_fy(records)

        # Get valid LEAIDs
        print("Fetching valid LEAIDs from database...")
        valid_leaids = get_valid_leaids(connection_string)
        print(f"Found {len(valid_leaids)} valid district LEAIDs")

        # Upsert to database
        result = upsert_competitor_spend(connection_string, aggregated, valid_leaids)

        # Print summary
        matched_records = [r for r in aggregated if r["leaid"] in valid_leaids]
        print_summary(matched_records)

        # Log success
        log_data_refresh(
            connection_string,
            records_updated=result["upserted"],
            records_failed=result["unmatched"],
            status="success"
        )

        # Refresh materialized view so map tiles reflect new data
        from utils.refresh_views import refresh_map_features
        refresh_map_features(connection_string)

        print(f"\n=== ETL Complete ===")
        print(f"Upserted: {result['upserted']} records")
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
