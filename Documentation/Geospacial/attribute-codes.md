# Complete Attribute Reference

## Full Record Layout

| Field | Length | Type | Description |
|-------|--------|------|-------------|
| STATEFP | 2 | String | State FIPS code |
| ELSDLEA | 5 | String | Elementary district LEA code (last 5 digits of GEOID) |
| SCSDLEA | 5 | String | Secondary district LEA code (last 5 digits of GEOID) |
| UNSDLEA | 5 | String | Unified district LEA code (last 5 digits of GEOID) |
| SDADMLEA | 5 | String | Administrative district LEA code (Vermont only) |
| GEOID | 7 | String | State FIPS + LEA code. Matches NCES LEAID except for pseudo-districts |
| NAME | 100 | String | District name |
| LSAD | 2 | String | Legal/statistical area description (always 00) |
| LOGRADE | 2 | String | Lowest grade: PK, KG, 01-12 |
| HIGRADE | 2 | String | Highest grade: 01-12 |
| MTFCC | 5 | String | MAF/TIGER Feature Class Code |
| SDTYP | 1 | String | Special district type code |
| FUNCSTAT | 1 | String | Functional status |
| ALAND | 14 | Number | Land area in square meters |
| AWATER | 14 | Number | Water area in square meters |
| INTPTLAT | 11 | String | Internal point latitude |
| INTPTLON | 12 | String | Internal point longitude |
| GEO_YEAR | 4 | String | TIGER vintage year |
| SCHOOLYEAR | 9 | String | Academic year (e.g., 2023-2024) |

## MTFCC Codes (District Type)

| Code | Description |
|------|-------------|
| G5400 | Elementary School District |
| G5410 | Secondary School District |
| G5420 | Unified School District |
| G5430 | Administrative School District |

## SDTYP Codes (Special District Type)

| Code | Description |
|------|-------------|
| A | Pseudo district (not a real legal entity) |
| B | Department of Defense (DoD) district |
| C | Interstate district (crosses state lines) |
| D | Bureau of Indian Affairs (BIA) district |
| E | Same name as another district in state |
| (blank) | Regular district |

## FUNCSTAT Codes (Functional Status)

| Code | Description |
|------|-------------|
| E | Active government providing special-purpose functions |
| F | Fictitious entity (fills Census geographic hierarchy) |

## State FIPS Codes

| Code | State | Code | State |
|------|-------|------|-------|
| 01 | Alabama | 28 | Mississippi |
| 02 | Alaska | 29 | Missouri |
| 04 | Arizona | 30 | Montana |
| 05 | Arkansas | 31 | Nebraska |
| 06 | California | 32 | Nevada |
| 08 | Colorado | 33 | New Hampshire |
| 09 | Connecticut | 34 | New Jersey |
| 10 | Delaware | 35 | New Mexico |
| 11 | District of Columbia | 36 | New York |
| 12 | Florida | 37 | North Carolina |
| 13 | Georgia | 38 | North Dakota |
| 15 | Hawaii | 39 | Ohio |
| 16 | Idaho | 40 | Oklahoma |
| 17 | Illinois | 41 | Oregon |
| 18 | Indiana | 42 | Pennsylvania |
| 19 | Iowa | 44 | Rhode Island |
| 20 | Kansas | 45 | South Carolina |
| 21 | Kentucky | 46 | South Dakota |
| 22 | Louisiana | 47 | Tennessee |
| 23 | Maine | 48 | Texas |
| 24 | Maryland | 49 | Utah |
| 25 | Massachusetts | 50 | Vermont |
| 26 | Michigan | 51 | Virginia |
| 27 | Minnesota | 53 | Washington |
| 54 | West Virginia | 55 | Wisconsin |
| 56 | Wyoming | 72 | Puerto Rico |

## Geographic Coverage Notes

- **Island Areas included:** American Samoa, Guam, Commonwealth of Northern Mariana Islands, U.S. Virgin Islands
- **Territorial sea:** Original TIGER includes 3-mile maritime buffer; EDGE composite clips to shoreline
- **Code 99997:** Assigned to water/land where no school district is defined by the state
