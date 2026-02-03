"""
Contacts CSV Data Loader

Parses the Contacts CSV and imports contacts into the contacts table,
matching each contact to a district via LEAID (NCES ID).

Uses leaid + email as a unique key for upserting.
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
from utils.leaid import normalize_leaid


# CSV column mappings (actual CSV headers -> internal names)
# Note: CSV has "Seniorty Level" (typo) not "Seniority Level"
CSV_COLUMNS = {
    "Salutation": "salutation",
    "Full Name": "name",
    "Title": "title",
    "Work Email": "email",
    "NCES ID": "leaid",
    "LinkedIn Profile": "linkedin_url",
    "Persona": "persona",
    "Seniorty Level": "seniority_level",  # Note typo in source CSV
}


def parse_csv_row(row: Dict[str, str]) -> Dict:
    """
    Parse a CSV row into a normalized contact record.
    """
    record = {}

    # Map columns
    for csv_col, internal_col in CSV_COLUMNS.items():
        value = row.get(csv_col, "")
        # Clean up whitespace
        if isinstance(value, str):
            value = value.strip()
        record[internal_col] = value if value else None

    # Normalize LEAID
    record["leaid_raw"] = record.get("leaid")
    record["leaid"] = normalize_leaid(record.get("leaid"))

    return record


def load_contacts_csv(csv_path: Path) -> List[Dict]:
    """
    Load and parse the Contacts CSV file.

    Args:
        csv_path: Path to the CSV file

    Returns:
        List of parsed contact records
    """
    records = []

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in tqdm(reader, desc="Parsing CSV"):
            record = parse_csv_row(row)
            # Skip records with no name
            if record.get("name"):
                records.append(record)

    print(f"Parsed {len(records)} contact records from CSV")
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


def upsert_contacts(
    connection_string: str,
    records: List[Dict],
    batch_size: int = 500
) -> int:
    """
    Upsert contacts into the contacts table.

    Uses (leaid, email) as the unique key for deduplication.
    For contacts without email, uses (leaid, name) as fallback.
    """
    if not records:
        return 0

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Track existing contacts by (leaid, email) and (leaid, name)
    print("Fetching existing contacts...")
    cur.execute("""
        SELECT id, leaid, email, name FROM contacts
    """)
    existing_by_email = {}  # (leaid, email) -> id
    existing_by_name = {}   # (leaid, name) -> id
    for row in cur.fetchall():
        contact_id, leaid, email, name = row
        if email:
            existing_by_email[(leaid, email.lower())] = contact_id
        existing_by_name[(leaid, name.lower())] = contact_id

    # Categorize records for insert vs update
    to_insert = []
    to_update = []

    for r in records:
        leaid = r["leaid"]
        email = r.get("email")
        name = r.get("name", "")

        # Try to match by email first, then by name
        existing_id = None
        if email:
            existing_id = existing_by_email.get((leaid, email.lower()))
        if existing_id is None and name:
            existing_id = existing_by_name.get((leaid, name.lower()))

        if existing_id:
            r["id"] = existing_id
            to_update.append(r)
        else:
            to_insert.append(r)

    # Deduplicate inserts by (leaid, email) or (leaid, name)
    seen = set()
    deduped_inserts = []
    for r in to_insert:
        leaid = r["leaid"]
        email = r.get("email")
        name = r.get("name", "")

        key = (leaid, email.lower()) if email else (leaid, name.lower())
        if key not in seen:
            seen.add(key)
            deduped_inserts.append(r)

    print(f"Contacts to insert: {len(deduped_inserts)}, to update: {len(to_update)}")

    # Insert new contacts
    if deduped_inserts:
        insert_sql = """
            INSERT INTO contacts (
                leaid, salutation, name, title, email, phone,
                linkedin_url, persona, seniority_level, is_primary
            ) VALUES %s
        """
        values = [
            (
                r["leaid"],
                r.get("salutation"),
                r["name"],
                r.get("title"),
                r.get("email"),
                None,  # phone not in CSV
                r.get("linkedin_url"),
                r.get("persona"),
                r.get("seniority_level"),
                False,  # is_primary default
            )
            for r in deduped_inserts
        ]

        print(f"Inserting {len(values)} new contacts...")
        for i in tqdm(range(0, len(values), batch_size), desc="Inserting"):
            batch = values[i:i+batch_size]
            execute_values(cur, insert_sql, batch)

    # Update existing contacts
    if to_update:
        print(f"Updating {len(to_update)} existing contacts...")
        for r in tqdm(to_update, desc="Updating"):
            cur.execute("""
                UPDATE contacts SET
                    salutation = COALESCE(%s, salutation),
                    name = %s,
                    title = COALESCE(%s, title),
                    email = COALESCE(%s, email),
                    linkedin_url = COALESCE(%s, linkedin_url),
                    persona = COALESCE(%s, persona),
                    seniority_level = COALESCE(%s, seniority_level)
                WHERE id = %s
            """, (
                r.get("salutation"),
                r["name"],
                r.get("title"),
                r.get("email"),
                r.get("linkedin_url"),
                r.get("persona"),
                r.get("seniority_level"),
                r["id"],
            ))

    conn.commit()
    cur.close()
    conn.close()

    return len(deduped_inserts) + len(to_update)


def generate_match_report(
    matched: List[Dict],
    unmatched: List[Dict],
    output_dir: Path
) -> Dict:
    """
    Generate match report files.

    Creates:
    - unmatched_contacts.csv: List of unmatched contacts
    - contacts_match_summary.json: Summary statistics
    """
    import json

    output_dir.mkdir(parents=True, exist_ok=True)

    # Write unmatched CSV
    unmatched_csv = output_dir / "unmatched_contacts.csv"
    with open(unmatched_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "name", "email", "title", "leaid_raw", "match_failure_reason",
            "persona", "seniority_level", "linkedin_url",
        ])
        writer.writeheader()
        for r in unmatched:
            writer.writerow({k: r.get(k, "") for k in writer.fieldnames})

    print(f"Wrote unmatched contacts to {unmatched_csv}")

    # Calculate summary
    total = len(matched) + len(unmatched)
    match_rate = len(matched) / total * 100 if total > 0 else 0

    # Breakdown by failure reason
    failure_reasons = {}
    for r in unmatched:
        reason = r.get("match_failure_reason", "unknown")
        failure_reasons[reason] = failure_reasons.get(reason, 0) + 1

    summary = {
        "total_records": total,
        "matched_count": len(matched),
        "unmatched_count": len(unmatched),
        "match_rate_percent": round(match_rate, 2),
        "failure_reasons": failure_reasons,
    }

    # Write summary JSON
    summary_json = output_dir / "contacts_match_summary.json"
    with open(summary_json, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"Wrote match summary to {summary_json}")

    # Print summary
    print("\n=== Contacts Match Summary ===")
    print(f"Total records: {summary['total_records']}")
    print(f"Matched: {summary['matched_count']} ({summary['match_rate_percent']}%)")
    print(f"Unmatched: {summary['unmatched_count']}")
    print(f"\nFailure reasons:")
    for reason, count in failure_reasons.items():
        print(f"  {reason}: {count}")

    return summary


def main():
    """CLI entry point."""
    import argparse
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description="Load Contacts CSV data")
    parser.add_argument("csv_path", help="Path to Contacts CSV file")
    parser.add_argument("--output-dir", default="./reports", help="Output directory for reports")

    args = parser.parse_args()

    connection_string = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DIRECT_URL or DATABASE_URL environment variable not set")

    csv_path = Path(args.csv_path)
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    # Load and parse CSV
    records = load_contacts_csv(csv_path)

    # Get valid LEAIDs
    print("Fetching valid LEAIDs from database...")
    valid_leaids = get_valid_leaids(connection_string)
    print(f"Found {len(valid_leaids)} valid district LEAIDs")

    # Categorize
    matched, unmatched = categorize_records(records, valid_leaids)
    print(f"Matched: {len(matched)}, Unmatched: {len(unmatched)}")

    # Upsert contacts
    upserted_count = upsert_contacts(connection_string, matched)
    print(f"Upserted {upserted_count} contacts")

    # Generate report
    output_dir = Path(args.output_dir)
    generate_match_report(matched, unmatched, output_dir)


if __name__ == "__main__":
    main()
