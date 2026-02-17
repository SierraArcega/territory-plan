#!/usr/bin/env python3
"""Build corrected deduping CSV with manual fixes applied."""

import csv
import sys

# Read the raw matched results (skip stderr line)
with open('Data Files/deduping_matched_results.csv', newline='') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if line.startswith('District,'):
            break
    reader = csv.DictReader(lines[i:])
    rows = list(reader)

# ============================================================
# MANUAL CORRECTIONS
# Key: input district name (lowercase) → (leaid, db_name, match_type, confidence, notes)
# Use None for leaid/db_name when no match exists
# ============================================================
corrections = {
    # === WRONG MATCHES → CORRECT LEA IDs ===
    "chicago public schools": ("1709930", "Chicago Public School District 299", "CORRECTED", "HIGH", "Was matched to North Chicago 187"),
    "crete monee community unit school district 201u": ("1711250", "Crete-Monee Community Unit School District 201-U", "CORRECTED", "HIGH", "Was matched to CU SD 300"),
    "community consolidated school district 168": ("1735460", "Community Consolidated School District 168", "CORRECTED", "HIGH", "Was matched to CCSD 93"),
    "weld county reorganized school district no. re-8": ("0804020", "Weld County School District RE-8", "CORRECTED", "HIGH", "Was matched to RE-2"),
    "denver public schools no. 1": ("0803360", "Denver County School District 1", "CORRECTED", "HIGH", "Was matched to DENVER 1 (0800004)"),
    "dayton public schools": ("3904384", "Dayton City School District", "CORRECTED", "HIGH", "Was matched to Alliance/Dayton Leadership"),
    "mt healthy city school district": ("3904441", "Mount Healthy City School District", "CORRECTED", "HIGH", "Was matched to Mt. Healthy Prep Academy"),
    "options for youth - san juan": ("0601794", "Options for Youth-San Juan District", "CORRECTED", "HIGH", "Was matched to San Gabriel"),
    "barack obama green charter high school": ("3400740", "The Barack Obama Green Charter High School District", "CORRECTED", "HIGH", "Was matched to Academy Charter HS"),
    "south bound brook borough public school": ("3415180", "South Bound Brook Borough School District", "CORRECTED", "HIGH", "Was matched to Bound Brook"),
    "nekoosa high school": ("5510380", "Nekoosa School District", "CORRECTED", "HIGH", "School within this district"),
    "the lincoln academy beloit": ("5500092", "The Lincoln Academy Inc", "CORRECTED", "HIGH", "Was matched to Beloit SD"),
    "menominee tribal school": ("5509070", "Menominee Indian School District", "CORRECTED", "MEDIUM", "Tribal school - closest district match"),
    "saint mary parish school board": ("2201620", "St. Mary Parish School District", "CORRECTED", "HIGH", "St. vs Saint spelling"),
    "raytown quality schools": ("2926070", "Raytown C-2 School District", "CORRECTED", "HIGH", "Brand name vs official name"),
    "johnston county public schools": ("3702370", "Johnston County Schools", "CORRECTED", "HIGH", "Was matched to Johnston Charter Academy"),
    "bardstown city schools (ky)": ("2100270", "Bardstown Independent School District", "CORRECTED", "HIGH", "Already had correct suggestion"),
    "jubilee academy - kingsville": ("4800179", "JUBILEE ACADEMIES", "CORRECTED", "MEDIUM", "Campus within Jubilee Academies network"),
    "jacksonville lighthouse charter (district)": ("0500402", "ARKANSAS LIGHTHOUSE CHARTER SCHOOLS", "CORRECTED", "MEDIUM", "Part of AR Lighthouse network"),
    "lakeview sch. district (calhoun)": ("2620850", "Lakeview School District", "CORRECTED", "HIGH", "Keep match, note Calhoun county disambiguation"),
    "york preparatory academy": (None, None, "NO_MATCH", "NONE", "Charter school - not a separate LEA in our DB"),
    "kipp north carolina public schools": (None, None, "NO_MATCH", "NONE", "KIPP NC network - no single LEA"),
    "kipp kansas city": (None, None, "NO_MATCH", "NONE", "KIPP KC network - no single LEA in our DB"),
    "lafayette renaissance charter academy": ("2200231", "Acadiana Renaissance Charter Academy", "CORRECTED", "MEDIUM", "Likely this academy; verify with Fullmind CRM"),
    "university of chicago charter schools": (None, None, "NO_MATCH", "NONE", "Charter network within CPS - no separate LEA"),
    "civitas education partners": (None, None, "NO_MATCH", "NONE", "Charter management org - not a district"),
    "geo focus academy": ("1800219", "GEO Next Generation Academy", "CORRECTED", "MEDIUM", "Part of GEO network; best match"),
    "florence county school district 02": ("4502160", "Florence School District 2", "CORRECTED", "HIGH", "Was matched to Florence 1"),
    "lexington county school district 01": ("4502700", "Lexington School District 1", "CORRECTED", "HIGH", "Same district, name variant"),
    "west harvey-dixmoor school district 147": ("1718480", "West Harvey-Dixmoor Public School District 147", "CORRECTED", "HIGH", "Was matched to Harvey 152"),
    "aurora public schools": (None, None, "NO_MATCH", "NONE", "Not in our DB for Colorado"),

    # === PRIVATE/RELIGIOUS SCHOOLS - no LEA ===
    "sacred heart catholic school - hallettsville": (None, None, "PRIVATE_SCHOOL", "NONE", "Private Catholic school - nearest district: 4822120 Hallettsville ISD"),
    "monsignor kelly catholic high school": (None, None, "PRIVATE_SCHOOL", "NONE", "Private Catholic school in Beaumont TX"),
    "lubbock christian school": (None, None, "PRIVATE_SCHOOL", "NONE", "Private school - nearest district: 4828500 Lubbock ISD"),
    "church of st. john the apostle": (None, None, "PRIVATE_SCHOOL", "NONE", "Private Catholic school in NJ"),
    "star christian academy": (None, None, "PRIVATE_SCHOOL", "NONE", "Private school in NC"),
    "bella vista college prep": (None, None, "PRIVATE_SCHOOL", "NONE", "Private school in AZ - no LEA"),

    # === INDIVIDUAL SCHOOLS (within Chicago PS 299) ===
    "parkside elementary community academy": ("1709930", "Chicago Public School District 299", "SCHOOL_IN_DISTRICT", "HIGH", "Individual school within CPS"),
    "ira f aldridge elementary school": ("1709930", "Chicago Public School District 299", "SCHOOL_IN_DISTRICT", "HIGH", "Individual school within CPS"),
    "john c coonley elementary school": ("1709930", "Chicago Public School District 299", "SCHOOL_IN_DISTRICT", "HIGH", "Individual school within CPS"),
    "john j pershing elementary humanities magnet": ("1709930", "Chicago Public School District 299", "SCHOOL_IN_DISTRICT", "HIGH", "Individual school within CPS"),

    # === LOW CONFIDENCE → better answers ===
    "north lawndale college preparatory": (None, None, "NO_MATCH", "NONE", "Charter school in Chicago - no separate LEA found"),
    "epic academy high school": (None, None, "NO_MATCH", "NONE", "Charter school in Chicago - no separate LEA found"),
    "jubilee academy - westwood": ("4800179", "JUBILEE ACADEMIES", "CORRECTED", "MEDIUM", "Campus within Jubilee Academies network"),

    # === MEDIUM CONFIDENCE - confirm correct ===
    "mt. diablo unified school district": ("0626370", "Mount Diablo Unified School District", "CORRECTED", "HIGH", "Mt vs Mount confirmed"),
    "alliance marine - innovation and technology 6-12 complex (district)": ("0601835", "Alliance Marine - Innovation and Tech 6-12 Complex DIST", "CORRECTED", "HIGH", "Confirmed correct"),
    "alliance margaret m. bloomfield technology academy high (district)": ("0601707", "Alliance Margaret M. Bloomfield Tech Acad High DIST", "CORRECTED", "HIGH", "Confirmed correct"),
    "kipp university park middle school": ("0602575", "KIPP University Park District", "CORRECTED", "HIGH", "Confirmed correct"),
    "lps oakland r and d campus (district)": ("0601967", "LPS Oakland R & D Campus District", "CORRECTED", "HIGH", "Confirmed correct"),
    "camino nuevo charter academy - burlington": ("0601741", "Camino Nuevo Charter Academy #2 District", "CORRECTED", "MEDIUM", "Burlington campus = #2; verify"),

    # === Thomaston-Upson fix ===
    "thomaston-upson county school district": ("1305280", "Upson County School District", "CORRECTED", "HIGH", "Thomaston is city within Upson County SD"),
}

# Write corrected CSV
writer = csv.writer(sys.stdout)
writer.writerow([
    'District', 'State', 'NCES District (Given)', 'NCES School (Given)',
    'Matched LEAID', 'Matched DB Name', 'Match Type', 'Confidence', 'Notes'
])

stats = {"corrected": 0, "kept": 0, "nulled": 0}

for row in rows:
    district = row.get('District', '').strip()
    state = row.get('State', '').strip()
    nces_given = row.get('NCES District (Given)', '').strip()
    nces_school = row.get('NCES School (Given)', '').strip()

    if not district or district == '352':
        continue

    key = district.lower().strip()
    # Remove quotes
    key = key.strip('"').strip()

    if key in corrections:
        leaid, db_name, mtype, conf, notes = corrections[key]
        writer.writerow([
            district, state, nces_given, nces_school,
            leaid or '', db_name or '', mtype, conf, notes
        ])
        if leaid:
            stats["corrected"] += 1
        else:
            stats["nulled"] += 1
    else:
        # Keep original match
        writer.writerow([
            district, state, nces_given, nces_school,
            row.get('Matched LEAID', ''),
            row.get('Matched DB Name', ''),
            row.get('Match Type', ''),
            row.get('Confidence', ''),
            row.get('Alt Suggestions', '')
        ])
        stats["kept"] += 1

print(f"\n--- Stats: {stats['corrected']} corrected, {stats['nulled']} set to null, {stats['kept']} kept as-is ---", file=sys.stderr)
