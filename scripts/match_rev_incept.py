#!/usr/bin/env python3
"""Match 'Districts from Rev Incept to Date' against districts table."""

import csv
import os
import re
import sys
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

# State abbreviation → full name (for display)
STATE_NAMES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'DC': 'District of Columbia', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii',
    'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
    'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
    'WI': 'Wisconsin', 'WY': 'Wyoming'
}

# Keywords that indicate this is NOT a K-12 district
NON_K12_KEYWORDS = [
    'university', 'college', 'upward bound', 'gear up', 'diocese',
    'metropolitan state', 'state university', 'community college',
    'technical college', 'institute of technology',
    'd2c', 'events & engagement', 'events and engagement',
    'department of corrections', 'board of education',
    'lulac national', 'united friends', 'parris foundation',
    'opportunity resource', 'project stay',  'learn inc',
    'catherine carlton', 'methodist home',
]

def get_conn():
    import psycopg2
    from dotenv import load_dotenv
    load_dotenv()
    url = os.environ['DIRECT_URL']
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
    # Remove (dupe), (District), etc.
    s = re.sub(r'\s*\((?:dupe|district)\)\s*', ' ', s, flags=re.IGNORECASE)
    s = re.sub(r'\s*\([^)]*\)', '', s)
    # Expand common abbreviations
    s = s.replace(' isd', ' independent school district')
    s = s.replace(' cusd', ' community unit school district')
    s = s.replace(' usd', ' unified school district')
    # Remove common suffixes
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
                 'public school', 'school board',
                 'elementary school district',
                 'union free school district', 'free school district',
                 'enlarged school district',
                 'county office of education',
                 'county superintendent of schools',
                 'office of education',
                 'boces', 'pcs',
                 'district']:
        s = s.replace(word, '')
    # Remove district numbers
    s = re.sub(r'\s*#?\s*(?:no\.?\s*)?(?:re-?)?\d+[a-z]?\s*$', '', s)
    s = re.sub(r'\s*\d+[a-z]?\s*$', '', s)
    s = re.sub(r'[^a-z\s]', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def word_overlap_score(a, b):
    if not a or not b:
        return 0.0
    words_a = set(a.split())
    words_b = set(b.split())
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    return len(intersection) / max(len(words_a), 1)

def is_non_k12(name):
    """Check if this is a university/college/non-K12 entity."""
    lower = name.lower()
    for kw in NON_K12_KEYWORDS:
        if kw in lower:
            return True
    return False

def main():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT leaid, name, state_abbrev, account_name FROM districts ORDER BY leaid")
    db_districts = cur.fetchall()
    print(f"Loaded {len(db_districts)} districts from database", file=sys.stderr)

    # Build state lookup
    by_state = {}
    all_districts = []  # For no-state entries
    for leaid, name, st, acct in db_districts:
        entry = (leaid, name, acct, normalize(name), normalize(acct) if acct else '')
        all_districts.append((leaid, name, st, acct, normalize(name), normalize(acct) if acct else ''))
        if st:
            st = st.upper()
            if st not in by_state:
                by_state[st] = []
            by_state[st].append(entry)

    csv_path = os.path.join(os.path.dirname(__file__), '..', 'Data Files',
                            'Deduping Workbook - Districts from Rev Incept to Date.csv')
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    writer = csv.writer(sys.stdout)
    writer.writerow([
        'Name', 'State', 'LMS ID', 'NCES ID (Given)',
        'Matched LEAID', 'Matched DB Name', 'Match Type', 'Confidence', 'Notes'
    ])

    for row in rows:
        name = row.get('Name', '').strip()
        state = row.get('State Abb.', '').strip().upper()
        lms_id = row.get('LMS ID', '').strip()
        nces_given = row.get('NCES ID', '').strip()
        notes_orig = row.get('Notes', '').strip()

        if not name or name in ('D2C', 'Events & Engagement Revenue', 'Events and Engagement', 'Events & Engagement'):
            continue

        # Remove (dupe) from name for matching
        clean_name = re.sub(r'\s*\(dupe\)\s*$', '', name, flags=re.IGNORECASE).strip()

        # Skip non-K12 entities
        if is_non_k12(clean_name):
            writer.writerow([name, state, lms_id, nces_given, '', '', 'NON_K12', 'N/A',
                           'University/college/non-K12 entity'])
            continue

        # International entries
        if state == 'INT':
            writer.writerow([name, state, lms_id, nces_given, '', '', 'INTERNATIONAL', 'N/A',
                           'International school - no NCES ID'])
            continue

        norm_input = normalize(clean_name)

        # If NCES ID already given, verify
        if nces_given:
            cur.execute("SELECT leaid, name FROM districts WHERE leaid = %s", (nces_given,))
            result = cur.fetchone()
            if result:
                writer.writerow([name, state, lms_id, nces_given,
                               result[0], result[1], 'VERIFIED', 'HIGH', ''])
            else:
                writer.writerow([name, state, lms_id, nces_given,
                               nces_given, '(NOT IN DB)', 'GIVEN_NOT_FOUND', 'LOW', ''])
            continue

        # Determine candidate pool
        if state and state in by_state:
            candidates = by_state[state]
            search_scope = 'state'
        elif state:
            # State given but no districts for that state
            writer.writerow([name, state, lms_id, '',
                           '', '', 'NO_STATE_DATA', 'NONE', f'No districts for state {state}'])
            continue
        else:
            # No state - search all districts
            candidates = [(l, n, a, nn, na) for l, n, st, a, nn, na in all_districts]
            search_scope = 'all'

        # Score candidates
        scored = []
        for leaid, db_name, acct_name, norm_db, norm_acct in candidates:
            # Exact normalized match
            if norm_input and norm_input == norm_db:
                scored.append((1.0, leaid, db_name, 'EXACT_NORM'))
                continue
            if acct_name and clean_name.lower().strip() == acct_name.lower().strip():
                scored.append((0.99, leaid, db_name, 'EXACT_ACCOUNT'))
                continue
            if norm_acct and norm_input and norm_input == norm_acct:
                scored.append((0.98, leaid, db_name, 'EXACT_NORM_ACCOUNT'))
                continue
            if norm_input and norm_db:
                if norm_input in norm_db or norm_db in norm_input:
                    scored.append((0.90, leaid, db_name, 'SUBSTRING'))
                    continue
            score = word_overlap_score(norm_input, norm_db)
            if score >= 0.5:
                scored.append((score, leaid, db_name, 'WORD_OVERLAP'))
            if norm_acct:
                acct_score = word_overlap_score(norm_input, norm_acct)
                if acct_score >= 0.5:
                    scored.append((acct_score, leaid, db_name, 'ACCT_OVERLAP'))

        scored.sort(key=lambda x: -x[0])

        scope_note = ' (searched all states)' if search_scope == 'all' else ''

        if not scored:
            writer.writerow([name, state, lms_id, '',
                           '', '', 'NO_MATCH', 'NONE', scope_note.strip()])
        elif scored[0][0] >= 0.90:
            best = scored[0]
            alts = '; '.join(f"{s[1]}={s[2]} ({s[0]:.0%})" for s in scored[1:3]) if len(scored) > 1 else ''
            conf = 'HIGH' if search_scope == 'state' else 'MEDIUM'
            writer.writerow([name, state, lms_id, '',
                           best[1], best[2], best[3], conf, alts + scope_note])
        elif scored[0][0] >= 0.60:
            best = scored[0]
            alts = '; '.join(f"{s[1]}={s[2]} ({s[0]:.0%})" for s in scored[1:3]) if len(scored) > 1 else ''
            conf = 'MEDIUM' if search_scope == 'state' else 'LOW'
            writer.writerow([name, state, lms_id, '',
                           best[1], best[2], best[3], conf, alts + scope_note])
        else:
            alts = '; '.join(f"{s[1]}={s[2]} ({s[0]:.0%})" for s in scored[:3])
            writer.writerow([name, state, lms_id, '',
                           '', '', 'LOW_CONFIDENCE', 'LOW', alts + scope_note])

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
