#!/usr/bin/env python3
"""Build corrected Rev Incept CSV with manual fixes applied."""

import csv
import re
import sys

# Read raw matched results (skip stderr line)
with open('Data Files/rev_incept_matched_results.csv', newline='') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if line.startswith('Name,'):
            break
    reader = csv.DictReader(lines[i:])
    rows = list(reader)

# ============================================================
# MANUAL CORRECTIONS
# Key: (name_lower_stripped, state) → (leaid, db_name, match_type, confidence, notes)
# Using (name, state) tuple to handle duplicate names across states
# For no-state entries, state will be ''
# ============================================================

corrections = {}

def add(name, state, leaid, db_name, mtype, conf, notes):
    corrections[(name.lower().strip(), state.upper().strip())] = (leaid, db_name, mtype, conf, notes)

# === NY districts with hyphen/space issues ===
add("Bayport - Blue Point School District", "NY", "3604110", "Bayport-Blue Point Union Free School District", "CORRECTED", "HIGH", "Hyphen vs space in name")
add("Corning-Painted Post School District", "NY", "3608400", "Corning City School District", "CORRECTED", "MEDIUM", "Corning-Painted Post is commonly known as Corning City SD")
add("Eastport South Manor School District", "NY", "3600125", "Eastport-South Manor Central School District", "CORRECTED", "HIGH", "Missing hyphen")
add("Gilboa Conesville Central School", "NY", "3612120", "Gilboa-Conesville Central School District", "CORRECTED", "HIGH", "Missing hyphen")
add("Gilboa Conesville Central School District", "NY", "3612120", "Gilboa-Conesville Central School District", "CORRECTED", "HIGH", "Missing hyphen")
add("Gilboa-Conesville Central School District", "NY", "3612120", "Gilboa-Conesville Central School District", "CORRECTED", "HIGH", "Missing hyphen variant")
add("Hewlett Woodmere School District", "NY", "3631710", "Hewlett-Woodmere Union Free School District", "CORRECTED", "HIGH", "Missing hyphen")
add("Ichabod Crane Central School District", "NY", "3615210", "Kinderhook Central School District (Ichabod Crane)", "CORRECTED", "HIGH", "Ichabod Crane is nickname for Kinderhook CSD")
add("Mattituck - Cutchogue School District", "NY", "3600021", "Mattituck-Cutchogue Union Free School District", "CORRECTED", "HIGH", "Hyphen vs spaced dash")
add("Otsego Northern Catskills BOCES", "NY", None, None, "NO_MATCH", "NONE", "BOCES - not an LEA in federal data")
add("Patchogue - Medford School District", "NY", "3622470", "Patchogue-Medford Union Free School District", "CORRECTED", "HIGH", "Hyphen vs spaced dash")
add("Plainview Old-Bethpage School District", "NY", "3623220", "Plainview-Old Bethpage Central School District", "CORRECTED", "HIGH", "Hyphen placement")
add("Shoreham - Wading River School District", "NY", "3626840", "Shoreham-Wading River Central School District", "CORRECTED", "HIGH", "Hyphen vs spaced dash")

# === NY low confidence → correct matches ===
add("Enlarged City School District of Middletown", "NY", "3619320", "Middletown City School District", "CORRECTED", "HIGH", "Official vs common name")
add("Gloversville Enlarged School District", "NY", "3612270", "Gloversville City School District", "CORRECTED", "HIGH", "Enlarged vs City naming")
add("Greater Amsterdam School District", "NY", "3602970", "Amsterdam City School District", "CORRECTED", "HIGH", "Greater vs City naming")
add("Greater Johnstown School District", "NY", "3615980", "Johnstown City School District", "CORRECTED", "HIGH", "Greater vs City naming")
add("Oyster Bay East Norwich School District", "NY", "3622290", "Oyster Bay-East Norwich Central School District", "CORRECTED", "HIGH", "Missing hyphen")
add("Highland Falls-Fort Montgomery Central School District", "NY", "3614430", "Highland Falls Central School District", "CORRECTED", "HIGH", "Fort Montgomery part of HF CSD")
add("Mount Pleasant Cottage School District", "NY", "3620190", "Mount Pleasant Cottage Union Free School District", "CORRECTED", "MEDIUM", "Cottage UFSD is a special act district")
add("Grove Street Academy", "NY", None, None, "NO_MATCH", "NONE", "Individual school - no separate LEA")
add("New Visions Aim Charter High School II", "NY", "3601116", "NEW VISIONS AIM CHARTER HIGH SCHOOL II", "CORRECTED", "HIGH", "Specific charter")
add("New Visions Public Schools", "NY", None, None, "NO_MATCH", "NONE", "Charter management org - not a single LEA")
add("King Center Charter School (District)", "NY", "3600035", "KING CENTER CHARTER SCHOOL", "CORRECTED", "HIGH", "DB match found")
add("Renaissance Charter School", "NY", "3600045", "RENAISSANCE CHARTER SCHOOL", "CORRECTED", "MEDIUM", "Multiple Renaissance charters exist")

# === Other state fixes ===
add("Camden-Fairview School District", "AR", "0506060", "Camden Fairview School District", "CORRECTED", "HIGH", "Hyphen vs space")
add("Aurora Public Schools", "CO", None, None, "NO_MATCH", "NONE", "Not in our DB (may be Adams-Arapahoe 28J)")
add("Horizons at Green Farms Academy", "CT", None, None, "NON_K12", "N/A", "Private enrichment program")
add("Charter Schools USA-Florida", "FL", None, None, "NO_MATCH", "NONE", "Charter management org - not a single LEA")
add("Nevada County Charter Services Authority (Jpa)", "NE", None, None, "NO_MATCH", "NONE", "State may be NV not NE; JPA entity not a district")
add("Clovis Municipal Schools", "NJ", "3500570", "Clovis Municipal Schools", "CORRECTED", "HIGH", "State should be NM not NJ")
add("Pee Dee Math, Science, and Technology Academy", "SC", None, None, "NO_MATCH", "NONE", "Charter school - not found as separate LEA")
add("South Carolina Public Charter District", "SC", "4503901", "SC Public Charter School District", "CORRECTED", "HIGH", "Name variant")
add("Viborg-Hurley School District 60-6", "SD", "4674520", "Viborg Hurley School District 60-6", "CORRECTED", "HIGH", "Hyphen vs space")
add("Two Rivers Public Charter School", "WA", "1100045", "Two Rivers PCS", "CORRECTED", "HIGH", "State should be DC not WA")
add("SC Whitmore School", "SC", None, None, "NO_MATCH", "NONE", "Individual school - no separate LEA found")
add("Christel House Indianapolis", "IN", "1800018", "Christel House Academy South", "CORRECTED", "HIGH", "Part of Christel House network")
add("Invent Learning Hub (District)", "IN", None, None, "NO_MATCH", "NONE", "Not found as separate LEA")
add("Seacoast Classical Academy", "NH", None, None, "NO_MATCH", "NONE", "Not found in districts table")

# === TX entries needing fixes ===
add("Alief Isd", "TX", "4807530", "Alief Independent School District", "CORRECTED", "HIGH", "ISD abbreviation")
add("Brownsville Isd", "TX", "4811550", "Brownsville Independent School District", "CORRECTED", "HIGH", "ISD abbreviation")
add("Cleveland ISD", "TX", "4813950", "Cleveland Independent School District", "CORRECTED", "HIGH", "ISD abbreviation")
add("Corpus Christi ISD", "TX", "4815120", "Corpus Christi Independent School District", "CORRECTED", "HIGH", "ISD abbreviation")
add("DeSoto ISD", "TX", "4816770", "DeSoto Independent School District", "CORRECTED", "HIGH", "ISD abbreviation")
add("Fort Bend ISD", "TX", "4819470", "Fort Bend Independent School District", "CORRECTED", "HIGH", "ISD abbreviation")
add("Bloom Academy Charter School", "TX", None, None, "NO_MATCH", "NONE", "Charter school - not found as separate LEA")
add("Bloom Academy Charter School (District)", "TX", None, None, "NO_MATCH", "NONE", "Charter school - not found as separate LEA")
add("International Leadership of Texas (ILT)", "TX", None, None, "NO_MATCH", "NONE", "Charter network - check for specific campus LEA")
add("Legacy Preparatory", "TX", None, None, "NO_MATCH", "NONE", "Not found as separate LEA")
add("Opportunity Resource Services", "TX", None, None, "NON_K12", "N/A", "Service provider - not a district")

# === DC entries ===
add("District of Columbia Public Charter School Board", "DC", None, None, "NON_K12", "N/A", "Oversight board - not a district")
add("Girls Global Academy PCS (District)", "DC", "1100083", "Girls Global Academy PCS", "CORRECTED", "MEDIUM", "Charter PCS in DC")

# === No-state entries: CORRECT matches (unique enough names) ===
# These matched correctly even without state
add("Belleville School District 118", "", "1705610", "Belleville School District 118", "CORRECTED", "HIGH", "IL district - unique name")
add("Butte County Office of Education", "", "0691002", "Butte County Office of Education", "CORRECTED", "HIGH", "CA - unique name")
add("Charlotte-Mecklenburg Schools", "", "3702970", "Charlotte-Mecklenburg Schools", "CORRECTED", "HIGH", "NC - unique name")
add("Crosslake Community Charter School (District)", "", "2700218", "CROSSLAKE COMMUNITY CHARTER SCHOOL", "CORRECTED", "HIGH", "MN - unique name")
add("Dekalb Community Unit School District 428", "", "1712000", "DeKalb Community Unit School District 428", "CORRECTED", "HIGH", "IL - unique name")
add("Elmsford Union Free School District", "", "3610650", "Elmsford Union Free School District", "CORRECTED", "HIGH", "NY - unique name")
add("Gates-Chili Central School District", "", "3611880", "Gates-Chili Central School District", "CORRECTED", "HIGH", "NY - unique name")
add("Globe Unified District", "", "0403500", "Globe Unified District", "CORRECTED", "HIGH", "AZ - unique name")
add("Health Sciences Charter School", "", "3601022", "HEALTH SCIENCES CHARTER SCHOOL", "CORRECTED", "HIGH", "NY - unique name")
add("Hornell City School District", "", "3614820", "Hornell City School District", "CORRECTED", "HIGH", "NY - unique name")
add("Irvington Township School District", "", "3407680", "Irvington Township School District", "CORRECTED", "HIGH", "NJ - unique name")
add("Jamesville-Dewitt Central School District", "", "3609090", "Jamesville-DeWitt Central School District", "CORRECTED", "HIGH", "NY - unique name")
add("Jersey City School District", "", "3407830", "Jersey City School District", "CORRECTED", "HIGH", "NJ - unique name")
add("Lackawanna City School District", "", "3616440", "Lackawanna City School District", "CORRECTED", "HIGH", "NY - unique name")
add("Lake Park Audubon School District", "", "2700162", "Lake Park Audubon School District", "CORRECTED", "HIGH", "MN - unique name")
add("Lancaster County School District 1", "", "4502580", "Lancaster County School District", "CORRECTED", "HIGH", "SC - unique with number")
add("Los Molinos Unified School District", "", "0622860", "Los Molinos Unified School District", "CORRECTED", "HIGH", "CA - unique name")
add("Marysville Joint Unified School District", "", "0624090", "Marysville Joint Unified School District", "CORRECTED", "HIGH", "CA - unique name")
add("Menahga Public School District", "", "2720580", "Menahga Public School District", "CORRECTED", "HIGH", "MN - unique name")
add("Minisink Valley Central School District", "", "3619560", "Minisink Valley Central School District", "CORRECTED", "HIGH", "NY - unique name")
add("Moorhead Public School District 152", "", "2721420", "Moorhead Public School District", "CORRECTED", "HIGH", "MN - unique name")
add("Palatine Community Consolidated School District 15", "", "1730420", "Palatine Community Consolidated School District 15", "CORRECTED", "HIGH", "IL - unique name")
add("Putnam-Westchester Boces", "", "3680680", "PUTNAM-WESTCHESTER BOCES", "CORRECTED", "HIGH", "NY - unique name")
add("Rochester City School District", "", "3624750", "Rochester City School District", "CORRECTED", "HIGH", "NY - unique name")
add("Roselle Borough School District", "", "3414280", "Roselle Borough School District", "CORRECTED", "HIGH", "NJ - unique name")
add("Rush-Henrietta Central School District", "", "3625170", "Rush-Henrietta Central School District", "CORRECTED", "HIGH", "NY - unique name")
add("Sacramento County Office of Education", "", "0691027", "Sacramento County Office of Education", "CORRECTED", "HIGH", "CA - unique name")
add("Schenectady City School District", "", "3626010", "Schenectady City School District", "CORRECTED", "HIGH", "NY - unique name")
add("South Brunswick Township School District", "", "3415210", "South Brunswick Township School District", "CORRECTED", "HIGH", "NJ - unique name")
add("Sutter Union High School District", "", "0638610", "Sutter Union High School District", "CORRECTED", "HIGH", "CA - unique name")
add("The Barack Obama Green Charter High School", "", "3400740", "The Barack Obama Green Charter High School District", "CORRECTED", "HIGH", "NJ - unique name")
add("Tigerton School District", "", "5514880", "Tigerton School District", "CORRECTED", "HIGH", "WI - unique name")
add("Warwick Valley Central School District", "", "3629970", "Warwick Valley Central School District", "CORRECTED", "HIGH", "NY - unique name")
add("Winslow Township School District", "", "3418060", "Winslow Township School District", "CORRECTED", "HIGH", "NJ - unique name")
add("Foundation Academy Charter School", "", "3400717", "Foundation Academy Charter School", "CORRECTED", "HIGH", "NJ - unique name")
add("Attica Central School District", "", "3603390", "Attica Central School District", "CORRECTED", "HIGH", "NY - unique name")

# === No-state entries: WRONG matches → fixed ===
add("Central Regional High School", "", "3402910", "Central Regional School District", "CORRECTED", "HIGH", "NJ district")
add("River Dell Regional High School District", "", "3412260", "River Dell Regional School District", "CORRECTED", "HIGH", "NJ district")
add("Linden Public Schools", "", "3408610", "Linden City School District", "CORRECTED", "HIGH", "NJ (was matched to MI Linden Charter)")
add("Fridley Public Schools", "", "2712420", "Fridley Public School District", "CORRECTED", "HIGH", "MN (was matched to i3 Academy)")
add("Fort Yates Public Schools", "", "3807200", "Fort Yates Public School District 4", "CORRECTED", "HIGH", "ND district")
add("Rutherford School District", "", "3414460", "Rutherford Borough School District", "CORRECTED", "HIGH", "NJ (was matched to NC Rutherford County)")
add("Spartanburg County School District 07", "", "4503660", "Spartanburg School District 7", "CORRECTED", "HIGH", "SC (was matched to IL U-46)")
add("Paterson Public Schools", "", "3412600", "Paterson City School District", "CORRECTED", "HIGH", "NJ (was matched to WA)")
add("Earl Monroe New Renaissance Basketball School", "", "3601229", "E MONROE NEW RENAISSANCE BASKETBALL", "CORRECTED", "HIGH", "NY charter")
add("NYC Dept of Education", "", "3620580", "New York City Geographic District #2", "CORRECTED", "MEDIUM", "NYC DOE - multiple geographic districts; using main entry")

# === No-state entries: AMBIGUOUS (multiple possible states) → flag ===
add("Dayton Public Schools", "", "3904384", "Dayton City School District", "CORRECTED", "MEDIUM", "Likely OH but could be other states - verify")
add("Dayton School District", "", "3904384", "Dayton City School District", "CORRECTED", "MEDIUM", "Likely OH but could be other states - verify")
add("Camden County School District", "", "1300780", "Camden County School District", "CORRECTED", "MEDIUM", "Likely GA - verify (also exists in other states)")
add("Columbia County Schools", "", None, None, "AMBIGUOUS", "LOW", "Multiple states have Columbia County - need state to match")
add("Everett Public Schools", "", None, None, "AMBIGUOUS", "LOW", "Could be MA (2504770) or WA (5304050) - need state to match")
add("Plainfield Public Schools", "", None, None, "AMBIGUOUS", "LOW", "Could be NJ or CT - need state to match")
add("Seminole County Schools", "", None, None, "AMBIGUOUS", "LOW", "Could be FL (1201710) or GA or OK - need state to match")
add("Watertown Public Schools", "", None, None, "AMBIGUOUS", "LOW", "Could be CT, MA, NY, WI, SD - need state to match")
add("Richmond County School District", "", None, None, "AMBIGUOUS", "LOW", "Could be GA (1304380) or NC - need state to match")

# === No-state entries: NO MATCH / NON-K12 ===
add("Fordham Leadership Academy", "", None, None, "NO_MATCH", "NONE", "Not found as separate LEA")
add("Kipp Memphis Collegiate Schools", "", None, None, "NO_MATCH", "NONE", "KIPP network - not in our DB as TN LEA")
add("Kipp Metro Atlanta Schools", "", None, None, "NO_MATCH", "NONE", "KIPP network - not in our DB as GA LEA")
add("Old National Trail Special Services Cooperative", "", None, None, "NON_K12", "N/A", "Special services cooperative - not a district")
add("PS 180 SeeALL Academy", "", "3620580", "New York City Geographic District #2", "CORRECTED", "MEDIUM", "Individual NYC school - parent is NYC DOE")
add("Bronx HS District 8", "NY", "3620580", "New York City Geographic District #2", "CORRECTED", "MEDIUM", "NYC geographic district - part of NYC DOE")
add("Massachusetts Department of Education", "", None, None, "NON_K12", "N/A", "State agency - not a district")
add("Department of Corrections", "", None, None, "NON_K12", "N/A", "State agency - not a K-12 district")
add("Virginia Board of Education", "", None, None, "NON_K12", "N/A", "State agency - not a district")
add("D2C", "", None, None, "NON_K12", "N/A", "Not a district")
add("Events & Engagement Revenue", "", None, None, "NON_K12", "N/A", "Not a district")
add("Events and Engagement", "", None, None, "NON_K12", "N/A", "Not a district")

# === FL entries ===
add("Broward County Public Schools", "FL", "1200870", "Broward County School District", "CORRECTED", "HIGH", "Common vs official name")
add("Duval County Public Schools", "FL", "1200390", "Duval County School District", "CORRECTED", "HIGH", "Common vs official name")

# === Dupe entries - keep same as original ===
add("Lemont Township High School District 210(dupe)", "IL", None, None, "DUPE", "N/A", "Duplicate of Lemont Township HSD 210")
add("LEXINGTON DISTRICT 1(dupe)", "SC", None, None, "DUPE", "N/A", "Duplicate of Lexington District 1")
add("Niagara-Wheatfield School District(dupe)", "NY", None, None, "DUPE", "N/A", "Duplicate of Niagara-Wheatfield School District")
add("Tarrant County College(dupe)", "TX", None, None, "DUPE", "N/A", "Duplicate of Tarrant County College")

# === GA entries ===
add("BIA Charter School", "GA", None, None, "NO_MATCH", "NONE", "Not found as separate LEA")
add("Gwinnett County Public Schools", "GA", "1302070", "Gwinnett County School District", "CORRECTED", "HIGH", "Common vs official name")

# === NH ===
add("Barnstead School Administrative Unit Office", "NH", None, None, "NO_MATCH", "NONE", "SAU office - not a district LEA")

# === SC entries with name variants ===
add("Allendale School District 01", "SC", "4500750", "Allendale County School District", "CORRECTED", "HIGH", "County vs numbered name")
add("FLORENCE DISTRICT 3", "SC", "4502190", "Florence School District 3", "CORRECTED", "HIGH", "Abbreviated name")
add("LEXINGTON DISTRICT 1", "SC", "4502700", "Lexington School District 1", "CORRECTED", "HIGH", "Abbreviated name")
add("Lexington District 2", "SC", "4502730", "Lexington School District 2", "CORRECTED", "HIGH", "Abbreviated name")
add("Richland School District Two", "SC", "4503390", "Richland School District 2", "CORRECTED", "HIGH", "Two vs 2")
add("Williamsburg", "SC", "4503900", "Williamsburg County School District", "CORRECTED", "MEDIUM", "Partial name only")
add("Charter Institute at Erskine (District)", "SC", None, None, "NO_MATCH", "NONE", "Charter authorizer - not a traditional LEA")
add("Hampton County School District", "SC", "4502370", "Hampton School District 1", "CORRECTED", "MEDIUM", "County vs numbered district")
add("Laurens County School District 55", "SC", "4502640", "Laurens School District 55", "CORRECTED", "HIGH", "County in name")
add("Laurens County School District 56", "SC", "4502670", "Laurens School District 56", "CORRECTED", "HIGH", "County in name")

# === PA entries ===
add("School Lane Charter School", "PA", None, None, "NO_MATCH", "NONE", "Individual charter - no separate LEA found without (District)")
add("United School District", "PA", "4224420", "United School District", "CORRECTED", "HIGH", "PA match")

# === OR ===
add("Siuslaw School District", "OR", "4112180", "Siuslaw School District 97J", "CORRECTED", "HIGH", "Missing district number")

# === WV entries ===
# These should match fine but let me verify

# === MA ===
add("Bedford Public Schools", "MA", "2500390", "Bedford School District", "CORRECTED", "HIGH", "Public Schools vs School District")
add("Collegiate Charter School of Lowell (District)", "MA", None, None, "NO_MATCH", "NONE", "Not found as separate LEA")

# === MN ===
add("Onamia Public School District", "MN", "2721720", "Onamia Public School District", "CORRECTED", "HIGH", "Direct match")

# === MT ===
add("University of Wyoming", "MT", None, None, "NON_K12", "N/A", "University - not K-12 (also wrong state)")

# === NJ ===
add("Commercial Township School District", "NJ", "3403330", "Commercial Township School District", "CORRECTED", "HIGH", "Direct match")

# === VA ===
add("Nottoway County Public Schools", "VA", "5103300", "Nottoway County Public Schools", "CORRECTED", "HIGH", "Direct match")
add("Portsmouth Public Schools", "VA", "5103870", "Portsmouth City Public Schools", "CORRECTED", "HIGH", "City vs no-City name")

# === WI ===
add("Whitehall School District", "WI", "5516490", "Whitehall School District", "CORRECTED", "HIGH", "Direct match")

# === TX with abbreviations ===
add("Freer Independent School District", "TX", "4819920", "Freer Independent School District", "CORRECTED", "HIGH", "Direct match")
add("La Grange Independent School District", "TX", "4826310", "La Grange Independent School District", "CORRECTED", "HIGH", "Direct match")
add("Spring Independent School District", "TX", "4841070", "Spring Independent School District", "CORRECTED", "HIGH", "Direct match")
add("Wharton Independent School District", "TX", "4845600", "Wharton Independent School District", "CORRECTED", "HIGH", "Direct match")
add("Houston Independent School District", "TX", "4823640", "Houston Independent School District", "CORRECTED", "HIGH", "Direct match")

# ============================================================
# Write output
# ============================================================

writer = csv.writer(sys.stdout)
writer.writerow([
    'Name', 'State', 'LMS ID', 'NCES ID (Given)',
    'Matched LEAID', 'Matched DB Name', 'Match Type', 'Confidence', 'Notes'
])

stats = {"corrected": 0, "kept": 0, "nulled": 0, "non_k12": 0, "ambiguous": 0}

for row in rows:
    name = row.get('Name', '').strip()
    state = row.get('State', '').strip().upper()
    lms_id = row.get('LMS ID', '').strip()
    nces_given = row.get('NCES ID (Given)', '').strip()

    if not name:
        continue

    key = (name.lower().strip(), state)

    if key in corrections:
        leaid, db_name, mtype, conf, notes = corrections[key]
        writer.writerow([
            name, state, lms_id, nces_given,
            leaid or '', db_name or '', mtype, conf, notes
        ])
        if leaid:
            stats["corrected"] += 1
        elif mtype == 'NON_K12':
            stats["non_k12"] += 1
        elif mtype == 'AMBIGUOUS':
            stats["ambiguous"] += 1
        else:
            stats["nulled"] += 1
    else:
        # Keep original
        writer.writerow([
            name, state, lms_id, nces_given,
            row.get('Matched LEAID', ''),
            row.get('Matched DB Name', ''),
            row.get('Match Type', ''),
            row.get('Confidence', ''),
            row.get('Notes', '')
        ])
        stats["kept"] += 1

print(f"\nStats: {stats}", file=sys.stderr)
