"""
Replace Elevate K12 data in competitor_spend table with deduped workbook data.

Reads: "Deduping Workbook - Elevate Data (2).csv"
- Deletes all existing Elevate K12 rows
- Inserts new rows from CSV (skips rows without NCES)
- Sets po_count = 1 (aggregated data, no individual PO info)
"""

import os
import csv
import sys
from pathlib import Path
from datetime import datetime
from collections import defaultdict
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Add ETL utils to path
sys.path.insert(0, str(Path(__file__).parent / "etl"))
from utils.currency import parse_currency
from utils.leaid import normalize_leaid
from utils.refresh_views import refresh_map_features


def main():
    load_dotenv(Path(__file__).parent.parent / ".env")

    connection_string = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DIRECT_URL or DATABASE_URL not set")

    # Strip pgbouncer params for psycopg2
    if "?" in connection_string:
        base_url = connection_string.split("?")[0]
        params = connection_string.split("?")[1]
        valid_params = [p for p in params.split("&") if p and not p.startswith("pgbouncer")]
        connection_string = base_url + ("?" + "&".join(valid_params) if valid_params else "")

    csv_path = Path(__file__).parent.parent / "Data Files" / "Deduping Workbook - Elevate Data (2).csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    # Parse CSV
    records = []
    skipped = []
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            nces_raw = row.get("NCES", "").strip()
            leaid = normalize_leaid(nces_raw)
            competitor = row.get("Competitor", "").strip()
            fy = row.get("FY", "").strip()
            amount = parse_currency(row.get("Amount", ""))

            if not leaid:
                if competitor:  # skip blank trailing rows
                    skipped.append(row.get("District", "unknown"))
                continue
            if not competitor or not fy or amount <= 0:
                continue

            records.append({
                "leaid": leaid,
                "competitor": competitor,
                "fiscal_year": fy,
                "total_spend": round(amount, 2),
                "po_count": 1,
            })

    print(f"Parsed {len(records)} valid rows from CSV")
    if skipped:
        print(f"Skipped {len(skipped)} rows (no NCES): {skipped}")

    # Aggregate by (leaid, competitor, fiscal_year) - CSV may have multiple rows per combo
    agg = defaultdict(lambda: {"total_spend": 0.0, "po_count": 0})
    for r in records:
        key = (r["leaid"], r["competitor"], r["fiscal_year"])
        agg[key]["total_spend"] += r["total_spend"]
        agg[key]["po_count"] += 1

    aggregated = [
        {"leaid": k[0], "competitor": k[1], "fiscal_year": k[2],
         "total_spend": round(v["total_spend"], 2), "po_count": v["po_count"]}
        for k, v in agg.items()
    ]
    print(f"Aggregated to {len(aggregated)} unique district-competitor-FY combos")

    # Connect and get valid LEAIDs
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    cur.execute("SELECT leaid FROM districts")
    valid_leaids = {row[0] for row in cur.fetchall()}
    print(f"Found {len(valid_leaids)} valid districts in DB")

    matched = [r for r in aggregated if r["leaid"] in valid_leaids]
    unmatched = [r for r in aggregated if r["leaid"] not in valid_leaids]
    print(f"Matched: {len(matched)} | Unmatched: {len(unmatched)}")
    if unmatched:
        print("Unmatched LEAIDs:", [r["leaid"] for r in unmatched])

    # Show current Elevate K12 count
    cur.execute("SELECT COUNT(*) FROM competitor_spend WHERE competitor = 'Elevate K12'")
    existing_count = cur.fetchone()[0]
    print(f"\nExisting Elevate K12 rows in DB: {existing_count}")
    print(f"New rows to insert: {len(matched)}")

    # Delete existing Elevate K12 data
    cur.execute("DELETE FROM competitor_spend WHERE competitor = 'Elevate K12'")
    deleted = cur.rowcount
    print(f"Deleted {deleted} existing Elevate K12 rows")

    # Insert new data
    if matched:
        insert_sql = """
            INSERT INTO competitor_spend (leaid, competitor, fiscal_year, total_spend, po_count, last_updated)
            VALUES %s
        """
        values = [
            (r["leaid"], r["competitor"], r["fiscal_year"], r["total_spend"], r["po_count"], datetime.now())
            for r in matched
        ]
        execute_values(cur, insert_sql, values)
        print(f"Inserted {len(values)} new Elevate K12 rows")

    conn.commit()

    # Summary by FY
    cur.execute("""
        SELECT fiscal_year, COUNT(*), SUM(total_spend)
        FROM competitor_spend
        WHERE competitor = 'Elevate K12'
        GROUP BY fiscal_year
        ORDER BY fiscal_year
    """)
    print("\n=== Elevate K12 Summary ===")
    for fy, count, spend in cur.fetchall():
        print(f"  {fy}: {count} districts, ${spend:,.2f}")

    cur.close()
    conn.close()

    # Refresh materialized view so map tiles reflect new data
    refresh_map_features(connection_string)

    print("\nDone!")


if __name__ == "__main__":
    main()
