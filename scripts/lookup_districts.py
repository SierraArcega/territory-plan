#!/usr/bin/env python3
"""
Query the districts table to find correct matches for problematic entries.
Uses DIRECT_URL from .env, strips pgbouncer params, connects via psycopg2.
"""

import os
import sys
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from dotenv import load_dotenv
import psycopg2

# Load .env from the project root
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

def get_clean_connection_string():
    """Get DIRECT_URL and strip pgbouncer/connection_limit params."""
    url = os.environ.get('DIRECT_URL')
    if not url:
        print("ERROR: DIRECT_URL not found in .env")
        sys.exit(1)
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    # Remove pgbouncer and connection_limit params
    for key in ['pgbouncer', 'connection_limit']:
        params.pop(key, None)
    clean_query = urlencode(params, doseq=True)
    clean_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path,
                            parsed.params, clean_query, parsed.fragment))
    return clean_url


def run_search(cur, search_num, description, patterns, state=None):
    """Run a search and print results."""
    where_clauses = []
    params_list = []
    for pat in patterns:
        where_clauses.append("(name ILIKE %s OR (account_name IS NOT NULL AND account_name ILIKE %s))")
        params_list.extend([f'%{pat}%', f'%{pat}%'])

    where_sql = " OR ".join(where_clauses)

    if state:
        sql = f"""
            SELECT leaid, name, state_abbrev 
            FROM districts 
            WHERE ({where_sql}) AND state_abbrev = %s
            ORDER BY name LIMIT 5;
        """
        params_list.append(state)
    else:
        sql = f"""
            SELECT leaid, name, state_abbrev 
            FROM districts 
            WHERE ({where_sql})
            ORDER BY name LIMIT 5;
        """

    cur.execute(sql, params_list)
    rows = cur.fetchall()

    state_label = f", state={state}" if state else ""
    pat_label = " OR ".join([f'"{p}"' for p in patterns])
    print(f"\n{'='*70}")
    print(f"Search #{search_num}: {description}")
    print(f"  Pattern(s): {pat_label}{state_label}")
    print(f"  Results ({len(rows)}):")
    if rows:
        for r in rows:
            print(f"    leaid={r[0]:<12} name={r[1]:<50} state={r[2]}")
    else:
        print("    (no results)")


def main():
    conn_str = get_clean_connection_string()
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()

    # --- NY districts with spacing issues ---
    run_search(cur, 1, "NY - Bayport", ["Bayport"], state="NY")
    run_search(cur, 2, "NY - Corning", ["Corning"], state="NY")
    run_search(cur, 3, "NY - Eastport / South Manor", ["Eastport", "South Manor"], state="NY")
    run_search(cur, 4, "NY - Gilboa", ["Gilboa"], state="NY")
    run_search(cur, 5, "NY - Hewlett", ["Hewlett"], state="NY")
    run_search(cur, 6, "NY - Ichabod Crane", ["Ichabod Crane"], state="NY")
    run_search(cur, 7, "NY - Mattituck", ["Mattituck"], state="NY")
    run_search(cur, 8, "NY - Otsego Northern / Catskills BOCES", ["Otsego Northern", "Catskills BOCES"], state="NY")
    run_search(cur, 9, "NY - Patchogue", ["Patchogue"], state="NY")
    run_search(cur, 10, "NY - Plainview", ["Plainview"], state="NY")
    run_search(cur, 11, "NY - Shoreham", ["Shoreham"], state="NY")
    run_search(cur, 12, "NY - Middletown (city SD)", ["Middletown"], state="NY")
    run_search(cur, 13, "NY - Gloversville", ["Gloversville"], state="NY")
    run_search(cur, 14, "NY - Amsterdam", ["Amsterdam"], state="NY")
    run_search(cur, 15, "NY - Johnstown", ["Johnstown"], state="NY")
    run_search(cur, 16, "NY - Oyster Bay", ["Oyster Bay"], state="NY")
    run_search(cur, 17, "NY - Highland Falls", ["Highland Falls"], state="NY")
    run_search(cur, 18, "NY - Mount Pleasant", ["Mount Pleasant"], state="NY")
    run_search(cur, 19, "NY - New Visions", ["New Visions"], state="NY")
    run_search(cur, 20, "NY - King Center", ["King Center"], state="NY")
    run_search(cur, 21, "NY - Grove Street", ["Grove Street"], state="NY")

    # --- AR ---
    run_search(cur, 22, "AR - Camden / Fairview", ["Camden", "Fairview"], state="AR")

    # --- CO ---
    run_search(cur, 23, "CO - Aurora", ["Aurora"], state="CO")

    # --- SC ---
    run_search(cur, 24, "SC - Pee Dee", ["Pee Dee"], state="SC")
    run_search(cur, 25, "SC - Public Charter", ["Public Charter"], state="SC")
    run_search(cur, 26, "SC - Spartanburg 7 or 07", ["Spartanburg"], state="SC")

    # --- SD ---
    run_search(cur, 27, "SD - Viborg", ["Viborg"], state="SD")

    # --- NM ---
    run_search(cur, 28, "NM - Clovis", ["Clovis"], state="NM")

    # --- WA vs DC ---
    run_search(cur, 29, "WA - Two Rivers", ["Two Rivers"], state="WA")
    run_search(cur, 30, "DC - Two Rivers", ["Two Rivers"], state="DC")

    # --- No-state / state identification ---
    run_search(cur, 31, "No state - Central Regional (likely NJ)", ["Central Regional"])
    run_search(cur, 32, "NJ - Central Regional", ["Central Regional"], state="NJ")
    run_search(cur, 33, "NJ - River Dell", ["River Dell"], state="NJ")
    run_search(cur, 34, "NJ - Linden", ["Linden"], state="NJ")
    run_search(cur, 35, "MN - Fridley", ["Fridley"], state="MN")
    run_search(cur, 36, "TN - Kipp Memphis", ["Kipp Memphis"], state="TN")
    run_search(cur, 37, "GA - Kipp Metro Atlanta / KIPP Atlanta", ["Kipp Metro Atlanta", "KIPP Atlanta"], state="GA")
    run_search(cur, 38, "No state - Fort Yates", ["Fort Yates"])
    run_search(cur, 39, "ND - Fort Yates", ["Fort Yates"], state="ND")
    run_search(cur, 40, "NJ - Rutherford", ["Rutherford"], state="NJ")
    run_search(cur, 41, "FL - Seminole County", ["Seminole County"], state="FL")
    run_search(cur, 42, "OH - Dayton City / Dayton Public", ["Dayton City", "Dayton Public"], state="OH")
    run_search(cur, 43, "NY - Earl Monroe / Renaissance Basketball", ["Earl Monroe", "Renaissance Basketball"], state="NY")
    run_search(cur, 44, "No state - Fordham Leadership", ["Fordham Leadership"])
    run_search(cur, 45, "SC - Spartanburg district 7 (broader)", ["Spartanburg"], state="SC")

    # For #45, do a more targeted search for Spartanburg 7
    cur.execute("""
        SELECT leaid, name, state_abbrev 
        FROM districts 
        WHERE state_abbrev = 'SC' 
          AND (name ILIKE '%%Spartanburg%%7%%' OR name ILIKE '%%Spartanburg%%07%%'
               OR name ILIKE '%%Spartanburg County%%7%%' OR name ILIKE '%%Spartanburg%%Seven%%')
        ORDER BY name LIMIT 10;
    """)
    rows = cur.fetchall()
    print(f"\n{'='*70}")
    print(f"Search #45b: SC - Spartanburg specifically district 7/07")
    print(f"  Results ({len(rows)}):")
    if rows:
        for r in rows:
            print(f"    leaid={r[0]:<12} name={r[1]:<50} state={r[2]}")
    else:
        print("    (no results)")

    cur.close()
    conn.close()
    print(f"\n{'='*70}")
    print("Done. All searches complete.")


if __name__ == "__main__":
    main()
