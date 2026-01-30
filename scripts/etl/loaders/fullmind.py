"""
Fullmind CSV Data Loader

Parses the Fullmind district data CSV and updates the districts table directly.
Handles LEAID matching and tracks unmatched accounts.

Note: As of Jan 2026, Fullmind data is stored directly on the districts table
(consolidated schema) rather than a separate fullmind_data table.
"""

import os
import csv
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import psycopg2
from psycopg2.extras import execute_values
from tqdm import tqdm

# Import utilities
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.currency import parse_currency, parse_int
from utils.leaid import normalize_leaid, STATE_ABBREV_TO_FIPS


# CSV column mappings (actual CSV headers -> internal names)
CSV_COLUMNS = {
    "Account Name": "account_name",
    "Sales Executive": "sales_executive",
    "ST": "state_abbrev",
    "LMSID": "lmsid",
    "LEAID": "leaid",
    "FY25 Sessions Revenue": "fy25_sessions_revenue",
    "FY25 Sessions Take": "fy25_sessions_take",
    "FY25 Sessions Count": "fy25_sessions_count",
    "FY26 Sessions Revenue": "fy26_sessions_revenue",
    "FY26 Sessions Take": "fy26_sessions_take",
    "FY26 Sessions Count": "fy26_sessions_count",
    "FY25 Closed Won Opp Count": "fy25_closed_won_opp_count",
    "FY25 Closed Won Net Booking": "fy25_closed_won_net_booking",
    "FY25 Net Invoicing": "fy25_net_invoicing",
    "FY26 Closed Won Opp Count": "fy26_closed_won_opp_count",
    "FY26 Closed Won Net Booking": "fy26_closed_won_net_booking",
    "FY26 Net Invoicing": "fy26_net_invoicing",
    "FY26 Open Pipeline Opp Count": "fy26_open_pipeline_opp_count",
    "FY26 Open Pipeline": "fy26_open_pipeline",
    "FY26 Open Pipeline - Weighted": "fy26_open_pipeline_weighted",
    "FY27 Open Pipeline Opp Count": "fy27_open_pipeline_opp_count",
    "FY27 Open Pipeline": "fy27_open_pipeline",
    "FY27 Open Pipeline Weighted": "fy27_open_pipeline_weighted",
}


def parse_csv_row(row: Dict[str, str]) -> Dict:
    """
    Parse a CSV row into a normalized record.

    Applies currency parsing, integer parsing, and LEAID normalization.
    """
    record = {}

    # Map columns
    for csv_col, internal_col in CSV_COLUMNS.items():
        record[internal_col] = row.get(csv_col, "")

    # Normalize LEAID
    record["leaid_raw"] = record["leaid"]  # Keep original for debugging
    record["leaid"] = normalize_leaid(record["leaid"])

    # Parse currency fields
    currency_fields = [
        "fy25_sessions_revenue", "fy25_sessions_take",
        "fy26_sessions_revenue", "fy26_sessions_take",
        "fy25_closed_won_net_booking", "fy25_net_invoicing",
        "fy26_closed_won_net_booking", "fy26_net_invoicing",
        "fy26_open_pipeline", "fy26_open_pipeline_weighted",
        "fy27_open_pipeline", "fy27_open_pipeline_weighted",
    ]
    for field in currency_fields:
        record[field] = parse_currency(record.get(field, ""))

    # Parse integer fields
    int_fields = [
        "fy25_sessions_count", "fy26_sessions_count",
        "fy25_closed_won_opp_count", "fy26_closed_won_opp_count",
        "fy26_open_pipeline_opp_count", "fy27_open_pipeline_opp_count",
    ]
    for field in int_fields:
        record[field] = parse_int(record.get(field, ""))

    # Compute status flags
    # is_customer: Has any closed won booking OR net invoicing in any year
    record["is_customer"] = (
        record["fy25_closed_won_net_booking"] > 0 or
        record["fy26_closed_won_net_booking"] > 0 or
        record["fy25_net_invoicing"] > 0 or
        record["fy26_net_invoicing"] > 0
    )

    # has_open_pipeline: Has any open pipeline value
    record["has_open_pipeline"] = (
        record["fy26_open_pipeline"] > 0 or
        record["fy27_open_pipeline"] > 0
    )

    return record


def load_fullmind_csv(csv_path: Path) -> List[Dict]:
    """
    Load and parse the Fullmind CSV file.

    Args:
        csv_path: Path to the CSV file

    Returns:
        List of parsed records
    """
    records = []

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in tqdm(reader, desc="Parsing CSV"):
            record = parse_csv_row(row)
            records.append(record)

    print(f"Parsed {len(records)} records from CSV")
    return records


def get_valid_leaids(connection_string: str) -> set:
    """Get set of valid LEAIDs from districts table."""
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()
    cur.execute("SELECT leaid FROM districts")
    leaids = {row[0] for row in cur.fetchall()}
    cur.close()
    conn.close()
    return leaids


def categorize_records(
    records: List[Dict],
    valid_leaids: set
) -> Tuple[List[Dict], List[Dict]]:
    """
    Categorize records into matched and unmatched.

    Args:
        records: All parsed records
        valid_leaids: Set of valid LEAIDs from districts table

    Returns:
        Tuple of (matched_records, unmatched_records)
    """
    matched = []
    unmatched = []

    for record in records:
        leaid = record["leaid"]
        leaid_raw = record["leaid_raw"]

        if leaid is None:
            # No LEAID or invalid format
            if not leaid_raw or leaid_raw.strip() == "":
                record["match_failure_reason"] = "no_leaid"
            else:
                record["match_failure_reason"] = "invalid_leaid"
            unmatched.append(record)
        elif leaid not in valid_leaids:
            # Valid format but not in districts table
            record["match_failure_reason"] = "leaid_not_found"
            unmatched.append(record)
        else:
            matched.append(record)

    return matched, unmatched


def update_districts_with_fullmind_data(
    connection_string: str,
    records: List[Dict],
    batch_size: int = 500
) -> int:
    """
    Update districts table with Fullmind CRM data.

    Deduplicates by leaid, aggregating numeric fields.
    Updates the Fullmind columns directly on the districts table.
    """
    if not records:
        return 0

    # Deduplicate by leaid - aggregate numeric fields, keep last string values
    deduped = {}
    numeric_fields = [
        "fy25_sessions_revenue", "fy25_sessions_take", "fy25_sessions_count",
        "fy26_sessions_revenue", "fy26_sessions_take", "fy26_sessions_count",
        "fy25_closed_won_opp_count", "fy25_closed_won_net_booking", "fy25_net_invoicing",
        "fy26_closed_won_opp_count", "fy26_closed_won_net_booking", "fy26_net_invoicing",
        "fy26_open_pipeline_opp_count", "fy26_open_pipeline", "fy26_open_pipeline_weighted",
        "fy27_open_pipeline_opp_count", "fy27_open_pipeline", "fy27_open_pipeline_weighted",
    ]

    for r in records:
        leaid = r["leaid"]
        if leaid not in deduped:
            deduped[leaid] = r.copy()
        else:
            # Aggregate numeric fields
            for field in numeric_fields:
                deduped[leaid][field] = deduped[leaid][field] + r[field]
            # Recalculate boolean flags
            deduped[leaid]["is_customer"] = (
                deduped[leaid]["fy25_net_invoicing"] > 0 or
                deduped[leaid]["fy26_net_invoicing"] > 0
            )
            deduped[leaid]["has_open_pipeline"] = (
                deduped[leaid]["fy26_open_pipeline"] > 0 or
                deduped[leaid]["fy27_open_pipeline"] > 0
            )
            # Keep first account_name, sales_executive, lmsid (they should be the same)

    records = list(deduped.values())
    print(f"Deduplicated to {len(records)} unique LEAIDs")

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Clear existing Fullmind data on districts (set to NULL/defaults)
    print("Clearing existing Fullmind data on districts...")
    cur.execute("""
        UPDATE districts SET
            account_name = NULL,
            sales_executive = NULL,
            lmsid = NULL,
            fy25_sessions_revenue = 0,
            fy25_sessions_take = 0,
            fy25_sessions_count = 0,
            fy26_sessions_revenue = 0,
            fy26_sessions_take = 0,
            fy26_sessions_count = 0,
            fy25_closed_won_opp_count = 0,
            fy25_closed_won_net_booking = 0,
            fy25_net_invoicing = 0,
            fy26_closed_won_opp_count = 0,
            fy26_closed_won_net_booking = 0,
            fy26_net_invoicing = 0,
            fy26_open_pipeline_opp_count = 0,
            fy26_open_pipeline = 0,
            fy26_open_pipeline_weighted = 0,
            fy27_open_pipeline_opp_count = 0,
            fy27_open_pipeline = 0,
            fy27_open_pipeline_weighted = 0,
            is_customer = false,
            has_open_pipeline = false
    """)

    # Use a temp table + UPDATE JOIN pattern for efficient bulk updates
    cur.execute("""
        CREATE TEMP TABLE fullmind_updates (
            leaid VARCHAR(7) PRIMARY KEY,
            account_name TEXT,
            sales_executive TEXT,
            lmsid TEXT,
            fy25_sessions_revenue DECIMAL,
            fy25_sessions_take DECIMAL,
            fy25_sessions_count INTEGER,
            fy26_sessions_revenue DECIMAL,
            fy26_sessions_take DECIMAL,
            fy26_sessions_count INTEGER,
            fy25_closed_won_opp_count INTEGER,
            fy25_closed_won_net_booking DECIMAL,
            fy25_net_invoicing DECIMAL,
            fy26_closed_won_opp_count INTEGER,
            fy26_closed_won_net_booking DECIMAL,
            fy26_net_invoicing DECIMAL,
            fy26_open_pipeline_opp_count INTEGER,
            fy26_open_pipeline DECIMAL,
            fy26_open_pipeline_weighted DECIMAL,
            fy27_open_pipeline_opp_count INTEGER,
            fy27_open_pipeline DECIMAL,
            fy27_open_pipeline_weighted DECIMAL,
            is_customer BOOLEAN,
            has_open_pipeline BOOLEAN
        )
    """)

    insert_temp_sql = """
        INSERT INTO fullmind_updates (
            leaid, account_name, sales_executive, lmsid,
            fy25_sessions_revenue, fy25_sessions_take, fy25_sessions_count,
            fy26_sessions_revenue, fy26_sessions_take, fy26_sessions_count,
            fy25_closed_won_opp_count, fy25_closed_won_net_booking, fy25_net_invoicing,
            fy26_closed_won_opp_count, fy26_closed_won_net_booking, fy26_net_invoicing,
            fy26_open_pipeline_opp_count, fy26_open_pipeline, fy26_open_pipeline_weighted,
            fy27_open_pipeline_opp_count, fy27_open_pipeline, fy27_open_pipeline_weighted,
            is_customer, has_open_pipeline
        ) VALUES %s
    """

    values = [
        (
            r["leaid"],
            r["account_name"],
            r["sales_executive"],
            r["lmsid"],
            r["fy25_sessions_revenue"],
            r["fy25_sessions_take"],
            r["fy25_sessions_count"],
            r["fy26_sessions_revenue"],
            r["fy26_sessions_take"],
            r["fy26_sessions_count"],
            r["fy25_closed_won_opp_count"],
            r["fy25_closed_won_net_booking"],
            r["fy25_net_invoicing"],
            r["fy26_closed_won_opp_count"],
            r["fy26_closed_won_net_booking"],
            r["fy26_net_invoicing"],
            r["fy26_open_pipeline_opp_count"],
            r["fy26_open_pipeline"],
            r["fy26_open_pipeline_weighted"],
            r["fy27_open_pipeline_opp_count"],
            r["fy27_open_pipeline"],
            r["fy27_open_pipeline_weighted"],
            r["is_customer"],
            r["has_open_pipeline"],
        )
        for r in records
    ]

    print(f"Inserting {len(values)} records into temp table...")
    for i in tqdm(range(0, len(values), batch_size), desc="Loading temp table"):
        batch = values[i:i+batch_size]
        execute_values(cur, insert_temp_sql, batch)

    # Bulk update districts from temp table
    print("Updating districts table...")
    cur.execute("""
        UPDATE districts d SET
            account_name = u.account_name,
            sales_executive = u.sales_executive,
            lmsid = u.lmsid,
            fy25_sessions_revenue = u.fy25_sessions_revenue,
            fy25_sessions_take = u.fy25_sessions_take,
            fy25_sessions_count = u.fy25_sessions_count,
            fy26_sessions_revenue = u.fy26_sessions_revenue,
            fy26_sessions_take = u.fy26_sessions_take,
            fy26_sessions_count = u.fy26_sessions_count,
            fy25_closed_won_opp_count = u.fy25_closed_won_opp_count,
            fy25_closed_won_net_booking = u.fy25_closed_won_net_booking,
            fy25_net_invoicing = u.fy25_net_invoicing,
            fy26_closed_won_opp_count = u.fy26_closed_won_opp_count,
            fy26_closed_won_net_booking = u.fy26_closed_won_net_booking,
            fy26_net_invoicing = u.fy26_net_invoicing,
            fy26_open_pipeline_opp_count = u.fy26_open_pipeline_opp_count,
            fy26_open_pipeline = u.fy26_open_pipeline,
            fy26_open_pipeline_weighted = u.fy26_open_pipeline_weighted,
            fy27_open_pipeline_opp_count = u.fy27_open_pipeline_opp_count,
            fy27_open_pipeline = u.fy27_open_pipeline,
            fy27_open_pipeline_weighted = u.fy27_open_pipeline_weighted,
            is_customer = u.is_customer,
            has_open_pipeline = u.has_open_pipeline
        FROM fullmind_updates u
        WHERE d.leaid = u.leaid
    """)
    updated_count = cur.rowcount
    print(f"Updated {updated_count} district records")

    # Drop temp table
    cur.execute("DROP TABLE fullmind_updates")

    conn.commit()
    cur.close()
    conn.close()

    return updated_count


def insert_unmatched_accounts(
    connection_string: str,
    records: List[Dict],
    batch_size: int = 500
) -> int:
    """Insert unmatched accounts into unmatched_accounts table."""
    if not records:
        return 0

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Clear existing unmatched
    print("Clearing existing unmatched_accounts...")
    cur.execute("TRUNCATE TABLE unmatched_accounts")

    insert_sql = """
        INSERT INTO unmatched_accounts (
            account_name, sales_executive, state_abbrev, lmsid,
            leaid_raw, match_failure_reason,
            fy25_net_invoicing, fy26_net_invoicing,
            fy26_open_pipeline, fy27_open_pipeline,
            is_customer, has_open_pipeline
        ) VALUES %s
    """

    values = [
        (
            r["account_name"],
            r["sales_executive"],
            r["state_abbrev"] or "XX",  # Unknown state
            r["lmsid"],
            r["leaid_raw"],
            r["match_failure_reason"],
            r["fy25_net_invoicing"],
            r["fy26_net_invoicing"],
            r["fy26_open_pipeline"],
            r["fy27_open_pipeline"],
            r["is_customer"],
            r["has_open_pipeline"],
        )
        for r in records
    ]

    print(f"Inserting {len(values)} unmatched accounts...")
    for i in tqdm(range(0, len(values), batch_size), desc="Inserting"):
        batch = values[i:i+batch_size]
        execute_values(cur, insert_sql, batch)

    conn.commit()
    cur.close()
    conn.close()

    return len(values)


def generate_match_report(
    matched: List[Dict],
    unmatched: List[Dict],
    output_dir: Path
) -> Dict:
    """
    Generate match report files.

    Creates:
    - unmatched_fullmind.csv: List of unmatched accounts
    - match_summary.json: Summary statistics

    Returns:
        Summary statistics dict
    """
    import json

    output_dir.mkdir(parents=True, exist_ok=True)

    # Write unmatched CSV
    unmatched_csv = output_dir / "unmatched_fullmind.csv"
    with open(unmatched_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "account_name", "state_abbrev", "sales_executive",
            "leaid_raw", "match_failure_reason",
            "fy25_net_invoicing", "fy26_net_invoicing",
            "fy26_open_pipeline", "fy27_open_pipeline",
            "is_customer", "has_open_pipeline",
        ])
        writer.writeheader()
        for r in unmatched:
            writer.writerow({k: r.get(k, "") for k in writer.fieldnames})

    print(f"Wrote unmatched accounts to {unmatched_csv}")

    # Calculate summary
    total = len(matched) + len(unmatched)
    match_rate = len(matched) / total * 100 if total > 0 else 0

    # Breakdown by failure reason
    failure_reasons = {}
    for r in unmatched:
        reason = r.get("match_failure_reason", "unknown")
        failure_reasons[reason] = failure_reasons.get(reason, 0) + 1

    # Breakdown by state
    unmatched_by_state = {}
    for r in unmatched:
        state = r.get("state_abbrev", "XX")
        unmatched_by_state[state] = unmatched_by_state.get(state, 0) + 1

    summary = {
        "total_records": total,
        "matched_count": len(matched),
        "unmatched_count": len(unmatched),
        "match_rate_percent": round(match_rate, 2),
        "failure_reasons": failure_reasons,
        "unmatched_by_state": dict(sorted(
            unmatched_by_state.items(),
            key=lambda x: x[1],
            reverse=True
        )),
        "matched_customers": sum(1 for r in matched if r["is_customer"]),
        "matched_pipeline": sum(1 for r in matched if r["has_open_pipeline"]),
        "unmatched_customers": sum(1 for r in unmatched if r["is_customer"]),
        "unmatched_pipeline": sum(1 for r in unmatched if r["has_open_pipeline"]),
    }

    # Write summary JSON
    summary_json = output_dir / "match_summary.json"
    with open(summary_json, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"Wrote match summary to {summary_json}")

    # Print summary
    print("\n=== Match Summary ===")
    print(f"Total records: {summary['total_records']}")
    print(f"Matched: {summary['matched_count']} ({summary['match_rate_percent']}%)")
    print(f"Unmatched: {summary['unmatched_count']}")
    print(f"\nFailure reasons:")
    for reason, count in failure_reasons.items():
        print(f"  {reason}: {count}")
    print(f"\nMatched customers: {summary['matched_customers']}")
    print(f"Matched with pipeline: {summary['matched_pipeline']}")

    return summary


def main():
    """CLI entry point."""
    import argparse
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description="Load Fullmind CSV data")
    parser.add_argument("csv_path", help="Path to Fullmind CSV file")
    parser.add_argument("--output-dir", default="./reports", help="Output directory for reports")

    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    csv_path = Path(args.csv_path)
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    # Load and parse CSV
    records = load_fullmind_csv(csv_path)

    # Get valid LEAIDs
    print("Fetching valid LEAIDs from database...")
    valid_leaids = get_valid_leaids(connection_string)
    print(f"Found {len(valid_leaids)} valid district LEAIDs")

    # Categorize
    matched, unmatched = categorize_records(records, valid_leaids)
    print(f"Matched: {len(matched)}, Unmatched: {len(unmatched)}")

    # Update districts with matched Fullmind data
    matched_count = update_districts_with_fullmind_data(connection_string, matched)
    print(f"Updated {matched_count} district records with Fullmind data")

    # Insert unmatched
    unmatched_count = insert_unmatched_accounts(connection_string, unmatched)
    print(f"Inserted {unmatched_count} unmatched accounts")

    # Generate report
    output_dir = Path(args.output_dir)
    generate_match_report(matched, unmatched, output_dir)


if __name__ == "__main__":
    main()
