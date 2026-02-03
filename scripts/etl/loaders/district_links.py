"""
District Links CSV Data Loader

Parses the districts CSV export and updates districts with
website and job board URLs.
"""

import csv
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import psycopg2
from psycopg2.extras import execute_values
from tqdm import tqdm

# Import utilities
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.leaid import normalize_leaid


def normalize_url(url: Optional[str]) -> Optional[str]:
    """
    Normalize a URL to ensure it has a protocol.

    - Strips whitespace
    - Prepends https:// if missing protocol
    - Returns None for empty values
    """
    if not url:
        return None

    url = url.strip()
    if not url:
        return None

    # Skip placeholder values
    if url.lower() in ('response', 'n/a', 'none', '-'):
        return None

    # Add protocol if missing
    if not url.startswith(('http://', 'https://')):
        url = f"https://{url}"

    return url


def parse_csv_row(row: Dict[str, str]) -> Dict:
    """
    Parse a CSV row into a normalized district links record.
    """
    leaid_raw = row.get("leaid", "")
    leaid = normalize_leaid(leaid_raw)

    website = normalize_url(row.get("Website"))
    job_board = normalize_url(row.get("Job Board"))

    return {
        "leaid": leaid,
        "leaid_raw": leaid_raw,
        "website_url": website,
        "job_board_url": job_board,
    }


def load_district_links_csv(csv_path: Path) -> List[Dict]:
    """
    Load and parse the district links CSV file.

    Args:
        csv_path: Path to the CSV file

    Returns:
        List of parsed district link records
    """
    records = []

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in tqdm(reader, desc="Parsing CSV"):
            record = parse_csv_row(row)
            # Only keep records with at least one URL
            if record.get("website_url") or record.get("job_board_url"):
                records.append(record)

    print(f"Parsed {len(records)} records with links from CSV")
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

    Returns:
        Tuple of (matched_records, unmatched_records)
    """
    matched = []
    unmatched = []

    for record in records:
        leaid = record.get("leaid")
        if leaid and leaid in valid_leaids:
            matched.append(record)
        else:
            unmatched.append(record)

    print(f"Matched: {len(matched)}, Unmatched: {len(unmatched)}")
    return matched, unmatched


def update_district_links(
    connection_string: str,
    records: List[Dict],
    batch_size: int = 500
) -> int:
    """
    Update districts with website and job board URLs.

    Args:
        connection_string: PostgreSQL connection string
        records: List of matched district link records
        batch_size: Number of records per batch

    Returns:
        Number of districts updated
    """
    if not records:
        return 0

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    updated = 0

    # Process in batches
    for i in tqdm(range(0, len(records), batch_size), desc="Updating districts"):
        batch = records[i:i + batch_size]

        # Build values for batch update
        values = [
            (r["leaid"], r["website_url"], r["job_board_url"])
            for r in batch
        ]

        # Use UPDATE with VALUES for batch update
        execute_values(
            cur,
            """
            UPDATE districts AS d
            SET
                website_url = v.website_url,
                job_board_url = v.job_board_url,
                updated_at = NOW()
            FROM (VALUES %s) AS v(leaid, website_url, job_board_url)
            WHERE d.leaid = v.leaid
            """,
            values,
            template="(%s, %s, %s)"
        )

        updated += cur.rowcount
        conn.commit()

    cur.close()
    conn.close()

    print(f"Updated {updated} districts with links")
    return updated


def generate_report(
    matched: List[Dict],
    unmatched: List[Dict],
    output_dir: Path
) -> dict:
    """
    Generate a summary report of the import.

    Returns:
        Summary dict with counts
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Count stats
    website_count = sum(1 for r in matched if r.get("website_url"))
    job_board_count = sum(1 for r in matched if r.get("job_board_url"))
    both_count = sum(1 for r in matched if r.get("website_url") and r.get("job_board_url"))

    summary = {
        "total_parsed": len(matched) + len(unmatched),
        "matched": len(matched),
        "unmatched": len(unmatched),
        "with_website": website_count,
        "with_job_board": job_board_count,
        "with_both": both_count,
    }

    # Write unmatched to CSV for review
    if unmatched:
        unmatched_path = output_dir / "district_links_unmatched.csv"
        with open(unmatched_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["leaid_raw", "website_url", "job_board_url"])
            writer.writeheader()
            for r in unmatched:
                writer.writerow({
                    "leaid_raw": r.get("leaid_raw"),
                    "website_url": r.get("website_url"),
                    "job_board_url": r.get("job_board_url"),
                })
        print(f"Wrote unmatched records to: {unmatched_path}")

    print("\n=== District Links Import Summary ===")
    print(f"Total parsed:     {summary['total_parsed']:,}")
    print(f"Matched:          {summary['matched']:,}")
    print(f"Unmatched:        {summary['unmatched']:,}")
    print(f"With website:     {summary['with_website']:,}")
    print(f"With job board:   {summary['with_job_board']:,}")
    print(f"With both:        {summary['with_both']:,}")

    return summary
