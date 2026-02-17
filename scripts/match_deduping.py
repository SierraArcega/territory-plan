#!/usr/bin/env python3
"""Match deduping workbook entries against districts table by name + state."""

import csv
import os
import re
import sys
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

# State name → abbreviation mapping
STATE_ABBREV = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC'
}

def get_conn():
    """Get psycopg2 connection using DIRECT_URL."""
    import psycopg2
    from dotenv import load_dotenv
    load_dotenv()
    url = os.environ['DIRECT_URL']
    # Strip Supabase params
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    clean_qs = {k: v for k, v in qs.items() if k not in ('pgbouncer', 'connection_limit')}
    clean_url = urlunparse(parsed._replace(query=urlencode(clean_qs, doseq=True)))
    return psycopg2.connect(clean_url)

def normalize(name):
    """Normalize a district/school name for comparison."""
    if not name:
        return ''
    s = name.lower().strip()
    # Remove parenthetical notes like (District), (Charter), (KY), (FL), etc.
    s = re.sub(r'\s*\([^)]*\)', '', s)
    # Remove common suffixes/noise words
    for word in ['school district', 'public schools', 'public school district',
                 'community school district', 'community unit school district',
                 'unified school district', 'independent school district',
                 'central school district', 'city school district',
                 'community schools', 'county schools', 'county school district',
                 'county school system', 'city schools', 'school corporation',
                 'community consolidated school district',
                 'consolidated school district',
                 'exempted village school district',
                 'township school district', 'borough school district',
                 'regional school district', 'parish school board',
                 'area schools', 'area school district',
                 'charter school', 'charter schools', 'charter academy',
                 'charter', 'academy', 'school', 'schools',
                 'unified district', 'elementary district',
                 'high school district', 'union school district',
                 'reorganized school district', 'school system',
                 'supervisory union', 'municipal schools',
                 'community college prep', 'college preparatory',
                 'public school', 'school board',
                 'usd', 'cusd', 'isd', 'sd']:
        s = s.replace(word, '')
    # Remove district numbers like #1, No. 2, 111, Re-5, etc.
    s = re.sub(r'\s*#?\s*(?:no\.?\s*)?(?:re-?)?\d+[a-z]?\s*$', '', s)
    s = re.sub(r'\s*\d+[a-z]?\s*$', '', s)
    # Clean up
    s = re.sub(r'[^a-z\s]', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def word_overlap_score(a, b):
    """Score similarity based on word overlap."""
    if not a or not b:
        return 0.0
    words_a = set(a.split())
    words_b = set(b.split())
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    # Jaccard-like but weighted toward recall on the query side
    return len(intersection) / max(len(words_a), 1)

def main():
    conn = get_conn()
    cur = conn.cursor()

    # Load all districts from DB (name, state_abbrev, leaid, account_name)
    cur.execute("""
        SELECT leaid, name, state_abbrev, account_name
        FROM districts
        ORDER BY leaid
    """)
    db_districts = cur.fetchall()
    print(f"Loaded {len(db_districts)} districts from database", file=sys.stderr)

    # Build lookup structures
    # state_abbrev → list of (leaid, name, account_name, normalized_name, normalized_account)
    by_state = {}
    for leaid, name, st, acct in db_districts:
        if st:
            st = st.upper()
            if st not in by_state:
                by_state[st] = []
            by_state[st].append((leaid, name, acct, normalize(name), normalize(acct) if acct else ''))

    # Read CSV
    csv_path = os.path.join(os.path.dirname(__file__), '..', 'Data Files', 'Deduping Workbook - Sheet19.csv')
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Output CSV
    writer = csv.writer(sys.stdout)
    writer.writerow([
        'District', 'State', 'NCES District (Given)', 'NCES School (Given)',
        'Matched LEAID', 'Matched DB Name', 'Match Type', 'Confidence', 'Alt Suggestions'
    ])

    for row in rows:
        district = row.get('District', '').strip()
        state = row.get('State', '').strip()
        nces_district = row.get('NCES District', '').strip()
        nces_school = row.get('NCES School', '').strip()

        if not district:
            continue

        state_ab = STATE_ABBREV.get(state, '')
        norm_input = normalize(district)

        # If they already have an NCES ID, verify it
        if nces_district:
            cur.execute("SELECT leaid, name FROM districts WHERE leaid = %s", (nces_district,))
            result = cur.fetchone()
            if result:
                writer.writerow([
                    district, state, nces_district, nces_school,
                    result[0], result[1], 'VERIFIED', 'HIGH', ''
                ])
            else:
                # NCES given but not in our DB - try name match anyway
                writer.writerow([
                    district, state, nces_district, nces_school,
                    nces_district, '(NOT IN DB)', 'GIVEN_NOT_FOUND', 'LOW', ''
                ])
            continue

        # No NCES ID - try to match
        candidates = by_state.get(state_ab, [])
        if not candidates:
            writer.writerow([
                district, state, '', nces_school,
                '', '', 'NO_STATE_MATCH', 'NONE', ''
            ])
            continue

        # Score candidates
        scored = []
        for leaid, db_name, acct_name, norm_db, norm_acct in candidates:
            # Exact normalized match
            if norm_input and norm_input == norm_db:
                scored.append((1.0, leaid, db_name, 'EXACT_NORM'))
                continue
            # Exact match on account_name
            if acct_name and district.lower().strip() == acct_name.lower().strip():
                scored.append((0.99, leaid, db_name, 'EXACT_ACCOUNT'))
                continue
            # Normalized account match
            if norm_acct and norm_input == norm_acct:
                scored.append((0.98, leaid, db_name, 'EXACT_NORM_ACCOUNT'))
                continue
            # Check if input name contains DB name or vice versa
            if norm_input and norm_db:
                if norm_input in norm_db or norm_db in norm_input:
                    scored.append((0.90, leaid, db_name, 'SUBSTRING'))
                    continue
            # Word overlap
            score = word_overlap_score(norm_input, norm_db)
            if score >= 0.5:
                scored.append((score, leaid, db_name, 'WORD_OVERLAP'))
            # Also check account name overlap
            if norm_acct:
                acct_score = word_overlap_score(norm_input, norm_acct)
                if acct_score >= 0.5:
                    scored.append((acct_score, leaid, db_name, 'ACCT_OVERLAP'))

        scored.sort(key=lambda x: -x[0])

        if not scored:
            writer.writerow([
                district, state, '', nces_school,
                '', '', 'NO_MATCH', 'NONE', ''
            ])
        elif scored[0][0] >= 0.90:
            best = scored[0]
            alts = '; '.join(f"{s[1]}={s[2]} ({s[0]:.0%})" for s in scored[1:3]) if len(scored) > 1 else ''
            writer.writerow([
                district, state, '', nces_school,
                best[1], best[2], best[3], 'HIGH', alts
            ])
        elif scored[0][0] >= 0.60:
            best = scored[0]
            alts = '; '.join(f"{s[1]}={s[2]} ({s[0]:.0%})" for s in scored[1:3]) if len(scored) > 1 else ''
            writer.writerow([
                district, state, '', nces_school,
                best[1], best[2], best[3], 'MEDIUM', alts
            ])
        else:
            alts = '; '.join(f"{s[1]}={s[2]} ({s[0]:.0%})" for s in scored[:3])
            writer.writerow([
                district, state, '', nces_school,
                '', '', 'LOW_CONFIDENCE', 'LOW', alts
            ])

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
