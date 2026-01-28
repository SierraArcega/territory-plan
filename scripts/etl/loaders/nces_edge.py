"""
NCES EDGE School District Boundaries Loader

Downloads and loads NCES EDGE shapefile data into PostGIS.

Source: https://nces.ed.gov/programs/edge/Geographic/DistrictBoundaries
"""

import os
import zipfile
import tempfile
from pathlib import Path
from typing import Optional
import requests
import geopandas as gpd
from tqdm import tqdm

# NCES EDGE download URL (update year as needed)
NCES_EDGE_URL = "https://nces.ed.gov/programs/edge/data/EDGE_SCHOOLDISTRICT_TL24_SY2324.zip"


def download_nces_edge(output_dir: str, url: str = NCES_EDGE_URL) -> Path:
    """
    Download NCES EDGE shapefile.

    Args:
        output_dir: Directory to save the downloaded file
        url: URL to download from

    Returns:
        Path to the extracted shapefile directory
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    zip_path = output_path / "nces_edge.zip"
    extract_path = output_path / "nces_edge"

    # Download if not exists
    if not zip_path.exists():
        print(f"Downloading NCES EDGE from {url}...")
        response = requests.get(url, stream=True)
        response.raise_for_status()

        total_size = int(response.headers.get('content-length', 0))

        with open(zip_path, 'wb') as f:
            with tqdm(total=total_size, unit='B', unit_scale=True, desc="Downloading") as pbar:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    pbar.update(len(chunk))

        print(f"Downloaded to {zip_path}")

    # Extract if not exists
    if not extract_path.exists():
        print(f"Extracting to {extract_path}...")
        with zipfile.ZipFile(zip_path, 'r') as z:
            z.extractall(extract_path)
        print("Extraction complete")

    return extract_path


def find_shapefile(directory: Path) -> Optional[Path]:
    """Find the .shp file in a directory."""
    for shp_file in directory.rglob("*.shp"):
        return shp_file
    return None


def load_nces_edge_to_postgis(
    shapefile_path: Path,
    connection_string: str,
    table_name: str = "districts",
    batch_size: int = 1000
) -> int:
    """
    Load NCES EDGE shapefile into PostGIS districts table.

    Filters:
    - FUNCSTAT = 'E' (Active entities only)
    - SDTYP != 'A' (Exclude pseudo/administrative units)

    Args:
        shapefile_path: Path to the shapefile
        connection_string: PostgreSQL connection string
        table_name: Target table name
        batch_size: Number of records per batch insert

    Returns:
        Number of districts loaded
    """
    print(f"Loading shapefile from {shapefile_path}...")
    gdf = gpd.read_file(shapefile_path)

    print(f"Total records in shapefile: {len(gdf)}")

    # Print column names for debugging
    print(f"Columns: {list(gdf.columns)}")

    # Filter for active school districts
    # FUNCSTAT = 'E' means active
    # SDTYP != 'A' excludes administrative units that are pseudo-districts
    original_count = len(gdf)

    if 'FUNCSTAT' in gdf.columns:
        gdf = gdf[gdf['FUNCSTAT'] == 'E']
        print(f"After FUNCSTAT='E' filter: {len(gdf)}")

    if 'SDTYP' in gdf.columns:
        # SDTYP 'A' = Administrative - Not a regular school district
        gdf = gdf[gdf['SDTYP'] != 'A']
        print(f"After SDTYP!='A' filter: {len(gdf)}")

    print(f"Filtered from {original_count} to {len(gdf)} districts")

    # Ensure CRS is WGS84 (EPSG:4326)
    if gdf.crs is None:
        print("Warning: No CRS found, assuming EPSG:4326")
        gdf.set_crs(epsg=4326, inplace=True)
    elif gdf.crs.to_epsg() != 4326:
        print(f"Reprojecting from {gdf.crs} to EPSG:4326...")
        gdf = gdf.to_crs(epsg=4326)

    # Prepare data for insertion
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Clear existing data
    print("Clearing existing district data...")
    cur.execute(f"TRUNCATE TABLE {table_name} CASCADE")

    # Map shapefile columns to database columns
    # NCES EDGE columns: GEOID, NAME, STATEFP, MTFCC, SDTYP, FUNCSTAT, LOGRADE, HIGRADE
    column_mapping = {
        'GEOID': 'leaid',      # 7-char district ID
        'NAME': 'name',
        'STATEFP': 'state_fips',
        'MTFCC': 'mtfcc',
        'SDTYP': 'sdtyp',
        'FUNCSTAT': 'funcstat',
        'LOGRADE': 'lograde',
        'HIGRADE': 'higrade',
    }

    # Import state mapping
    from ..utils.leaid import STATE_FIPS_TO_ABBREV

    insert_sql = """
        INSERT INTO districts (leaid, name, state_fips, state_abbrev, mtfcc, sdtyp, funcstat, lograde, higrade, geometry, centroid)
        VALUES %s
        ON CONFLICT (leaid) DO UPDATE SET
            name = EXCLUDED.name,
            state_fips = EXCLUDED.state_fips,
            state_abbrev = EXCLUDED.state_abbrev,
            mtfcc = EXCLUDED.mtfcc,
            sdtyp = EXCLUDED.sdtyp,
            funcstat = EXCLUDED.funcstat,
            lograde = EXCLUDED.lograde,
            higrade = EXCLUDED.higrade,
            geometry = EXCLUDED.geometry,
            centroid = EXCLUDED.centroid,
            updated_at = NOW()
    """

    records = []
    for idx, row in tqdm(gdf.iterrows(), total=len(gdf), desc="Preparing records"):
        geoid = str(row.get('GEOID', '')).zfill(7)
        state_fips = geoid[:2]
        state_abbrev = STATE_FIPS_TO_ABBREV.get(state_fips, None)

        # Convert geometry to WKT
        geom = row.geometry
        if geom is not None:
            # Ensure MultiPolygon
            if geom.geom_type == 'Polygon':
                from shapely.geometry import MultiPolygon
                geom = MultiPolygon([geom])
            geom_wkt = geom.wkt
            centroid_wkt = geom.centroid.wkt
        else:
            geom_wkt = None
            centroid_wkt = None

        records.append((
            geoid,
            row.get('NAME', ''),
            state_fips,
            state_abbrev,
            row.get('MTFCC', None),
            row.get('SDTYP', None),
            row.get('FUNCSTAT', 'E'),
            row.get('LOGRADE', None),
            row.get('HIGRADE', None),
            f"SRID=4326;{geom_wkt}" if geom_wkt else None,
            f"SRID=4326;{centroid_wkt}" if centroid_wkt else None,
        ))

    # Insert in batches
    print(f"Inserting {len(records)} districts in batches of {batch_size}...")
    for i in tqdm(range(0, len(records), batch_size), desc="Inserting batches"):
        batch = records[i:i+batch_size]
        execute_values(cur, insert_sql, batch, template="""(
            %s, %s, %s, %s, %s, %s, %s, %s, %s,
            ST_GeomFromEWKT(%s),
            ST_GeomFromEWKT(%s)
        )""")

    conn.commit()
    cur.close()
    conn.close()

    print(f"Successfully loaded {len(records)} districts")
    return len(records)


def main():
    """CLI entry point."""
    import argparse
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description="Load NCES EDGE boundaries into PostGIS")
    parser.add_argument("--download-dir", default="./data", help="Directory for downloads")
    parser.add_argument("--shapefile", help="Path to existing shapefile (skips download)")
    parser.add_argument("--url", default=NCES_EDGE_URL, help="NCES EDGE download URL")

    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    if args.shapefile:
        shapefile_path = Path(args.shapefile)
    else:
        extract_path = download_nces_edge(args.download_dir, args.url)
        shapefile_path = find_shapefile(extract_path)
        if not shapefile_path:
            raise FileNotFoundError(f"No .shp file found in {extract_path}")

    print(f"Using shapefile: {shapefile_path}")
    count = load_nces_edge_to_postgis(shapefile_path, connection_string)
    print(f"Loaded {count} districts")


if __name__ == "__main__":
    main()
