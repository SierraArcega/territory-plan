#!/usr/bin/env python3
"""
fix_matches.py - Query Supabase districts table to find correct LEA IDs
for problematic matches from the deduping workbook.
"""

import os
import sys
import re
import psycopg2
from dotenv import load_dotenv

# Load .env from the project root
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

def get_connection():
    """Connect using DIRECT_URL, stripping pgbouncer/connection_limit params."""
    url = os.environ.get('DIRECT_URL')
    if not url:
        print("ERROR: DIRECT_URL not found in .env")
        sys.exit(1)
    # Strip pgbouncer and connection_limit query params
    url = re.sub(r'[?&]pgbouncer=[^&]*', '', url)
    url = re.sub(r'[?&]connection_limit=[^&]*', '', url)
    # Clean up leftover ? or & at end
    url = url.rstrip('?&')
    return psycopg2.connect(url)

def search_district(cur, state, search_term, patterns=None):
    """
    Search districts table by state and name/account_name patterns.
    patterns: list of ILIKE patterns to OR together. If None, uses search_term.
    """
    if patterns is None:
        patterns = [f'%{search_term}%']
    
    conditions = []
    params = []
    for p in patterns:
        conditions.append("(name ILIKE %s OR account_name ILIKE %s)")
        params.extend([p, p])
    
    where_clause = " OR ".join(conditions)
    query = f"""
        SELECT leaid, name, account_name 
        FROM districts 
        WHERE state_abbrev = %s AND ({where_clause})
        ORDER BY name 
        LIMIT 10;
    """
    params_full = [state] + params
    cur.execute(query, params_full)
    return cur.fetchall()

def print_results(state, search_term, rows):
    """Print formatted results for a search."""
    print(f"\n  [{state}] Search: \"{search_term}\"")
    if rows:
        for r in rows:
            leaid, name, account_name = r
            acct = account_name if account_name else "(none)"
            print(f"    -> leaid={leaid}, name=\"{name}\", account_name=\"{acct}\"")
    else:
        print(f"    -> NO RESULTS FOUND")

def main():
    conn = get_connection()
    cur = conn.cursor()
    
    # Define all searches grouped by state
    # Each entry: (state, display_label, [list of ILIKE patterns])
    searches = [
        # -- Illinois (IL) --
        ("IL", "Chicago Public (district 299)", ["%Chicago Public%"]),
        ("IL", "Crete Monee / Crete-Monee", ["%Crete Monee%", "%Crete-Monee%"]),
        ("IL", "Community Consolidated 168", ["%Community Consolidated%168%"]),
        ("IL", "Parkside Elementary", ["%Parkside Elementary%"]),
        ("IL", "Ira F Aldridge / Aldridge", ["%Ira F Aldridge%", "%Aldridge%"]),
        ("IL", "John C Coonley / Coonley", ["%John C Coonley%", "%Coonley%"]),
        ("IL", "John J Pershing / Pershing", ["%John J Pershing%", "%Pershing%"]),
        ("IL", "University of Chicago", ["%University of Chicago%"]),
        ("IL", "Civitas Education", ["%Civitas Education%"]),
        ("IL", "North Lawndale", ["%North Lawndale%"]),
        ("IL", "Epic Academy", ["%Epic Academy%"]),

        # -- Texas (TX) --
        ("TX", "Sacred Heart Hallettsville / Hallettsville", ["%Sacred Heart%Hallettsville%", "%Hallettsville%"]),
        ("TX", "Monsignor Kelly", ["%Monsignor Kelly%"]),
        ("TX", "Lubbock Christian", ["%Lubbock Christian%"]),
        ("TX", "Jubilee Kingsville / Jubilee", ["%Jubilee%Kingsville%", "%Jubilee%"]),
        ("TX", "Cedars International", ["%Cedars International%"]),
        ("TX", "Columbus Independent", ["%Columbus Independent%"]),

        # -- Colorado (CO) --
        ("CO", "Weld County RE-8 / Re-8", ["%Weld County%RE-8%", "%Weld County%Re-8%"]),
        ("CO", "Aurora Public / Aurora", ["%Aurora Public%", "%Aurora%"]),
        ("CO", "Denver Public / Denver County", ["%Denver%Public%", "%Denver County%"]),
        ("CO", "KIPP Colorado", ["%KIPP Colorado%"]),

        # -- Arizona (AZ) --
        ("AZ", "Bella Vista", ["%Bella Vista%"]),
        ("AZ", "Humboldt Unified", ["%Humboldt Unified%"]),
        ("AZ", "Hopi", ["%Hopi%"]),

        # -- Ohio (OH) --
        ("OH", "Dayton Public / Dayton City", ["%Dayton%Public%", "%Dayton City%"]),
        ("OH", "Mt Healthy / Mount Healthy", ["%Mt Healthy%", "%Mount Healthy%"]),
        ("OH", "KIPP Columbus", ["%KIPP Columbus%"]),

        # -- Missouri (MO) --
        ("MO", "KIPP Kansas City", ["%KIPP%Kansas City%"]),
        ("MO", "Raytown", ["%Raytown%"]),

        # -- Louisiana (LA) --
        ("LA", "Desoto Parish / DeSoto", ["%Desoto Parish%", "%DeSoto%"]),
        ("LA", "Lafayette Renaissance / Lafayette Charter", ["%Lafayette Renaissance%", "%Lafayette%Charter%"]),
        ("LA", "Lasalle Parish / LaSalle", ["%Lasalle Parish%", "%LaSalle%"]),
        ("LA", "Saint Mary Parish / St. Mary", ["%Saint Mary Parish%", "%St. Mary%"]),
        ("LA", "Educators Quality", ["%Educators%Quality%"]),

        # -- Wisconsin (WI) --
        ("WI", "Nekoosa", ["%Nekoosa%"]),
        ("WI", "Lincoln Academy Beloit / Lincoln Academy", ["%Lincoln Academy%Beloit%", "%Lincoln Academy%"]),
        ("WI", "Menominee Tribal / Menominee", ["%Menominee Tribal%", "%Menominee%"]),

        # -- California (CA) --
        ("CA", "Options for Youth San Juan", ["%Options for Youth%San Juan%"]),
        ("CA", "Green Dot", ["%Green Dot%"]),
        ("CA", "Alliance College Ready", ["%Alliance%College Ready%"]),
        ("CA", "Gorman Learning", ["%Gorman Learning%"]),
        ("CA", "Camino Nuevo Burlington", ["%Camino Nuevo%Burlington%"]),

        # -- Indiana (IN) --
        ("IN", "Geo Focus", ["%Geo Focus%"]),
        ("IN", "Northwest Indiana Lighthouse / Lighthouse", ["%Northwest Indiana Lighthouse%", "%Lighthouse%"]),
        ("IN", "Matchbook Learning", ["%Matchbook Learning%"]),
        ("IN", "Rooted School", ["%Rooted School%"]),

        # -- North Carolina (NC) --
        ("NC", "Kipp North Carolina / KIPP NC", ["%Kipp North Carolina%", "%KIPP%NC%"]),
        ("NC", "Greenfield School", ["%Greenfield School%"]),
        ("NC", "Children / Childrens Village", ["%Children%", "%Childrens Village%"]),

        # -- South Carolina (SC) --
        ("SC", "York Preparatory", ["%York Preparatory%"]),
        ("SC", "Allegro Charter", ["%Allegro Charter%"]),
        ("SC", "Carolina School Inquiry", ["%Carolina School%Inquiry%"]),
        ("SC", "Midland STEM", ["%Midland STEM%"]),
        ("SC", "Midlands Middle", ["%Midlands Middle%"]),

        # -- Tennessee (TN) --
        ("TN", "Soulsville", ["%Soulsville%"]),
        ("TN", "Frayser", ["%Frayser%"]),
        ("TN", "IOTA Community", ["%IOTA Community%"]),

        # -- New York (NY) --
        ("NY", "Academy Charter", ["%Academy Charter%"]),
        ("NY", "Wellspring", ["%Wellspring%"]),
        ("NY", "Universal School", ["%Universal School%"]),
        ("NY", "Kipp Capital Region", ["%Kipp Capital Region%"]),

        # -- New Jersey (NJ) --
        ("NJ", "Barack Obama Green / Obama", ["%Barack Obama Green%", "%Obama%"]),
        ("NJ", "South Bound Brook", ["%South Bound Brook%"]),

        # -- Oklahoma (OK) --
        ("OK", "Mid-Del", ["%Mid-Del%"]),

        # -- Arkansas (AR) --
        ("AR", "Jacksonville Lighthouse / Lighthouse", ["%Jacksonville Lighthouse%", "%Lighthouse%"]),

        # -- Florida (FL) --
        ("FL", "Ascend Academy", ["%Ascend Academy%"]),

        # -- Georgia (GA) --
        ("GA", "Griffin-Spalding", ["%Griffin-Spalding%"]),

        # -- Delaware (DE) --
        ("DE", "Delaware Adolescent", ["%Delaware Adolescent%"]),

        # -- Michigan (MI) --
        ("MI", "Lakeview Calhoun", ["%Lakeview%Calhoun%"]),

        # -- Kentucky (KY) --
        ("KY", "Bardstown", ["%Bardstown%"]),
    ]

    # Group by state for display
    current_state = None
    for state, label, patterns in searches:
        if state != current_state:
            print(f"\n{'='*60}")
            print(f"  STATE: {state}")
            print(f"{'='*60}")
            current_state = state
        
        rows = search_district(cur, state, label, patterns)
        print_results(state, label, rows)

    cur.close()
    conn.close()
    print(f"\n{'='*60}")
    print("  DONE - All searches complete.")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
