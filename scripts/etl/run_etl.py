#!/usr/bin/env python3
"""
ETL Pipeline Orchestrator

Runs the complete ETL pipeline:
1. Load NCES EDGE boundaries into PostGIS
2. Fetch Urban Institute enrollment data
3. Load Fullmind CSV data with matching

Usage:
    python run_etl.py --all
    python run_etl.py --boundaries --shapefile /path/to/shapefile.shp
    python run_etl.py --fullmind /path/to/fullmind.csv
"""

import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).parent))

from loaders.nces_edge import download_nces_edge, find_shapefile, load_nces_edge_to_postgis
from loaders.urban_institute import fetch_district_directory, update_district_enrollment
from loaders.fullmind import (
    load_fullmind_csv,
    get_valid_leaids,
    categorize_records,
    insert_fullmind_data,
    insert_unmatched_accounts,
    generate_match_report,
)


def verify_database_connection(connection_string: str) -> bool:
    """Verify database connection and PostGIS extension."""
    import psycopg2

    try:
        conn = psycopg2.connect(connection_string)
        cur = conn.cursor()

        # Check PostGIS
        cur.execute("SELECT PostGIS_Version()")
        postgis_version = cur.fetchone()[0]
        print(f"PostGIS version: {postgis_version}")

        # Check tables exist
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('districts', 'fullmind_data', 'unmatched_accounts')
        """)
        tables = [row[0] for row in cur.fetchall()]
        print(f"Found tables: {tables}")

        cur.close()
        conn.close()
        return True

    except Exception as e:
        print(f"Database connection error: {e}")
        return False


def run_boundaries_etl(
    connection_string: str,
    shapefile_path: Path = None,
    download_dir: str = "./data",
) -> int:
    """
    Run NCES EDGE boundaries ETL.

    Returns number of districts loaded.
    """
    print("\n" + "="*60)
    print("STEP 1: Loading NCES EDGE Boundaries")
    print("="*60)

    if shapefile_path and shapefile_path.exists():
        print(f"Using provided shapefile: {shapefile_path}")
    else:
        print("Downloading NCES EDGE shapefile...")
        extract_path = download_nces_edge(download_dir)
        shapefile_path = find_shapefile(extract_path)
        if not shapefile_path:
            raise FileNotFoundError(f"No .shp file found in {extract_path}")
        print(f"Found shapefile: {shapefile_path}")

    count = load_nces_edge_to_postgis(shapefile_path, connection_string)
    print(f"\nLoaded {count} district boundaries")
    return count


def run_enrollment_etl(
    connection_string: str,
    year: int = 2023,
) -> int:
    """
    Run Urban Institute enrollment ETL.

    Returns number of districts updated.
    """
    print("\n" + "="*60)
    print("STEP 2: Fetching Urban Institute Enrollment Data")
    print("="*60)

    records = fetch_district_directory(year=year)

    if not records:
        print("Warning: No enrollment records fetched")
        return 0

    count = update_district_enrollment(connection_string, records, year=year)
    print(f"\nUpdated {count} districts with enrollment data")
    return count


def run_fullmind_etl(
    connection_string: str,
    csv_path: Path,
    output_dir: str = "./reports",
) -> dict:
    """
    Run Fullmind CSV ETL.

    Returns match summary dict.
    """
    print("\n" + "="*60)
    print("STEP 3: Loading Fullmind Data")
    print("="*60)

    if not csv_path.exists():
        raise FileNotFoundError(f"Fullmind CSV not found: {csv_path}")

    print(f"Loading from: {csv_path}")

    # Parse CSV
    records = load_fullmind_csv(csv_path)

    # Get valid LEAIDs
    valid_leaids = get_valid_leaids(connection_string)
    print(f"Found {len(valid_leaids)} valid district LEAIDs in database")

    # Categorize
    matched, unmatched = categorize_records(records, valid_leaids)

    # Insert data
    insert_fullmind_data(connection_string, matched)
    insert_unmatched_accounts(connection_string, unmatched)

    # Generate report
    output_path = Path(output_dir)
    summary = generate_match_report(matched, unmatched, output_path)

    return summary


def print_database_stats(connection_string: str):
    """Print summary statistics from database."""
    import psycopg2

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    print("\n" + "="*60)
    print("DATABASE STATISTICS")
    print("="*60)

    # Districts count
    cur.execute("SELECT COUNT(*) FROM districts")
    districts = cur.fetchone()[0]
    print(f"Total districts: {districts:,}")

    # Districts with geometry
    cur.execute("SELECT COUNT(*) FROM districts WHERE geometry IS NOT NULL")
    with_geom = cur.fetchone()[0]
    print(f"Districts with geometry: {with_geom:,}")

    # Districts with enrollment
    cur.execute("SELECT COUNT(*) FROM districts WHERE enrollment IS NOT NULL")
    with_enrollment = cur.fetchone()[0]
    print(f"Districts with enrollment: {with_enrollment:,}")

    # Fullmind data
    cur.execute("SELECT COUNT(*) FROM fullmind_data")
    fullmind = cur.fetchone()[0]
    print(f"Fullmind data records: {fullmind:,}")

    # Customers
    cur.execute("SELECT COUNT(*) FROM fullmind_data WHERE is_customer = true")
    customers = cur.fetchone()[0]
    print(f"  - Customers: {customers:,}")

    # Pipeline
    cur.execute("SELECT COUNT(*) FROM fullmind_data WHERE has_open_pipeline = true")
    pipeline = cur.fetchone()[0]
    print(f"  - With open pipeline: {pipeline:,}")

    # Unmatched
    cur.execute("SELECT COUNT(*) FROM unmatched_accounts")
    unmatched = cur.fetchone()[0]
    print(f"Unmatched accounts: {unmatched:,}")

    # Top states by district count
    print("\nTop 10 states by district count:")
    cur.execute("""
        SELECT state_abbrev, COUNT(*) as cnt
        FROM districts
        WHERE state_abbrev IS NOT NULL
        GROUP BY state_abbrev
        ORDER BY cnt DESC
        LIMIT 10
    """)
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]:,}")

    cur.close()
    conn.close()


def main():
    """Main entry point."""
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="ETL Pipeline for Territory Plan Builder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Run complete pipeline
    python run_etl.py --all --fullmind-csv /path/to/fullmind.csv

    # Run only boundaries (with existing shapefile)
    python run_etl.py --boundaries --shapefile /path/to/shapefile.shp

    # Run only Fullmind import
    python run_etl.py --fullmind /path/to/fullmind.csv

    # Skip Urban Institute (faster, uses existing enrollment data)
    python run_etl.py --boundaries --fullmind /path/to/fullmind.csv
        """
    )

    parser.add_argument("--all", action="store_true",
                        help="Run all ETL steps")
    parser.add_argument("--boundaries", action="store_true",
                        help="Run NCES EDGE boundaries ETL")
    parser.add_argument("--enrollment", action="store_true",
                        help="Run Urban Institute enrollment ETL")
    parser.add_argument("--fullmind", type=str,
                        help="Run Fullmind CSV ETL with specified file")
    parser.add_argument("--shapefile", type=str,
                        help="Path to existing NCES shapefile (skips download)")
    parser.add_argument("--download-dir", default="./data",
                        help="Directory for downloads")
    parser.add_argument("--output-dir", default="./reports",
                        help="Directory for reports")
    parser.add_argument("--enrollment-year", type=int, default=2023,
                        help="Year for enrollment data")
    parser.add_argument("--stats-only", action="store_true",
                        help="Only print database statistics")

    args = parser.parse_args()

    # Get connection string
    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        print("Error: DATABASE_URL environment variable not set")
        print("Set it in .env file or environment")
        sys.exit(1)

    # Verify database
    if not verify_database_connection(connection_string):
        print("\nFailed to connect to database. Make sure:")
        print("1. PostgreSQL is running (docker-compose up -d)")
        print("2. Migrations have been applied (npx prisma migrate deploy)")
        sys.exit(1)

    # Stats only mode
    if args.stats_only:
        print_database_stats(connection_string)
        sys.exit(0)

    # Check if any ETL step specified
    if not (args.all or args.boundaries or args.enrollment or args.fullmind):
        print("No ETL steps specified. Use --all or specify individual steps.")
        print("Use --help for usage information.")
        sys.exit(1)

    # Run steps
    if args.all or args.boundaries:
        shapefile = Path(args.shapefile) if args.shapefile else None
        run_boundaries_etl(
            connection_string,
            shapefile_path=shapefile,
            download_dir=args.download_dir
        )

    if args.all or args.enrollment:
        run_enrollment_etl(
            connection_string,
            year=args.enrollment_year
        )

    if args.all and not args.fullmind:
        print("\nWarning: --all specified but no --fullmind CSV path provided")
        print("Skipping Fullmind data import")
    elif args.fullmind:
        run_fullmind_etl(
            connection_string,
            csv_path=Path(args.fullmind),
            output_dir=args.output_dir
        )

    # Print final stats
    print_database_stats(connection_string)

    print("\n" + "="*60)
    print("ETL COMPLETE")
    print("="*60)


if __name__ == "__main__":
    main()
