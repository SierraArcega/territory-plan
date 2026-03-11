---
name: education-data-api
description: Access the Urban Institute Education Data Portal API for K-12 and higher education data. Use when querying US education statistics including school enrollment, demographics, finances, test scores, graduation rates, college admissions, tuition, and financial aid. Data sources include CCD (Common Core of Data), CRDC (Civil Rights Data Collection), IPEDS (Integrated Postsecondary Education Data System), SAIPE (Small Area Income and Poverty Estimates), EDFacts, and College Scorecard.
---

# Urban Institute Education Data Portal API

The Education Data Portal provides free access to education data covering K-12 schools, school districts, and colleges/universities across the United States.

## Base URL

```
https://educationdata.urban.org/api/v1/
```

All responses are returned in JSON format.

## Endpoint Structure

```
https://educationdata.urban.org/api/v1/{topic}/{source}/{endpoint}/{year}/[specifiers]/[?filters]
```

### Topics

| Topic | Description |
|-------|-------------|
| `schools` | Individual K-12 school data |
| `school-districts` | School district (LEA) data |
| `college-university` | Higher education institution data |

### Data Sources

| Source | Topic | Description |
|--------|-------|-------------|
| `ccd` | schools, school-districts | Common Core of Data - directory, enrollment, finance |
| `crdc` | schools | Civil Rights Data Collection - discipline, enrollment by demographics |
| `ipeds` | college-university | Integrated Postsecondary Education Data System |
| `saipe` | school-districts | Small Area Income and Poverty Estimates |
| `edfacts` | schools, school-districts | State assessment results, graduation rates |
| `scorecard` | college-university | College Scorecard data |

## Common Endpoints

### Schools (K-12)

```python
# School directory
/api/v1/schools/ccd/directory/{year}/

# Enrollment by grade
/api/v1/schools/ccd/enrollment/{year}/{grade}/
# grade options: grade-pk, grade-k, grade-1 through grade-12, grade-13, grade-99 (total)

# Enrollment by grade and race
/api/v1/schools/ccd/enrollment/{year}/{grade}/race/

# Enrollment by grade and sex
/api/v1/schools/ccd/enrollment/{year}/{grade}/sex/

# Enrollment by grade, race, and sex
/api/v1/schools/ccd/enrollment/{year}/{grade}/race/sex/

# CRDC enrollment by race and sex
/api/v1/schools/crdc/enrollment/{year}/race/sex/

# Discipline data
/api/v1/schools/crdc/discipline/{year}/disability/sex/
```

### School Districts

```python
# District directory
/api/v1/school-districts/ccd/directory/{year}/

# District enrollment
/api/v1/school-districts/ccd/enrollment/{year}/{grade}/

# District finance
/api/v1/school-districts/ccd/finance/{year}/

# Poverty estimates
/api/v1/school-districts/saipe/{year}/

# Assessment results
/api/v1/school-districts/edfacts/assessments/{year}/{grade_edfacts}/

# Graduation rates
/api/v1/school-districts/edfacts/grad-rates/{year}/
```

### Colleges/Universities

```python
# Directory
/api/v1/college-university/ipeds/directory/{year}/

# Institutional characteristics
/api/v1/college-university/ipeds/institutional-characteristics/{year}/

# Admissions
/api/v1/college-university/ipeds/admissions-enrollment/{year}/
/api/v1/college-university/ipeds/admissions-requirements/{year}/

# Tuition
/api/v1/college-university/ipeds/academic-year-tuition/{year}/

# Enrollment
/api/v1/college-university/ipeds/fall-enrollment/{year}/{level_of_study}/race/sex/
# level_of_study: undergraduate, graduate, first-professional

# Financial aid
/api/v1/college-university/ipeds/sfa-grants-and-net-price/{year}/

# Finance
/api/v1/college-university/ipeds/finance/{year}/

# Retention
/api/v1/college-university/ipeds/fall-retention/{year}/
```

## Filters

Add filters as query parameters. Use `&` for multiple filters.

```python
# Single filter
?fips=11

# Multiple filters
?charter=1&fips=11

# Multiple values for same filter (comma-separated)
?fips=17,55
```

### Common Filter Variables

| Variable | Description |
|----------|-------------|
| `fips` | State FIPS code (e.g., 6=California, 11=DC, 17=Illinois) |
| `leaid` | District ID |
| `ncessch` | School ID |
| `unitid` | College/university ID |
| `year` | Academic year |
| `charter` | Charter school (0=No, 1=Yes) |
| `school_level` | 1=Primary, 2=Middle, 3=High, 4=Other |
| `race` | Race/ethnicity code |
| `sex` | 1=Male, 2=Female, 99=Total |

## Summary Endpoints

For aggregated statistics without downloading raw data:

```
/api/v1/{topic}/{source}/{endpoint}/summaries?var={var}&stat={stat}&by={by}
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `var` | Variable to summarize (must be numeric) |
| `stat` | Statistic: sum, count, avg, min, max, variance, stddev, median |
| `by` | Group by variable(s), comma-separated |

### Example

```python
# Sum enrollment by state
/api/v1/schools/ccd/enrollment/summaries?var=enrollment&stat=sum&by=fips

# Sum enrollment by state and race, filtered
/api/v1/schools/ccd/enrollment/summaries?var=enrollment&stat=sum&by=fips,race&fips=17,55&year=2020
```

## Pagination

API returns max 10,000 records per page. Response includes:
- `count`: Total records
- `next`: URL for next page (null if last page)
- `previous`: URL for previous page
- `results`: Array of data records

### Handling Pagination in Python

```python
import requests

url = "https://educationdata.urban.org/api/v1/schools/ccd/directory/2020/"
data = []

while url:
    response = requests.get(url).json()
    data.extend(response["results"])
    url = response["next"]
```

## CSV Downloads

For large datasets, download full CSV files directly:

```python
# CSV URL pattern
https://educationdata.urban.org/csv/{source}/{filename}.csv

# Example: All CCD directory data
https://educationdata.urban.org/csv/ccd/schools_ccd_directory.csv
```

## Metadata Endpoints

```python
# List all endpoints
https://educationdata.urban.org/api/v1/api-endpoints/

# Get endpoint by ID
https://educationdata.urban.org/api/v1/api-endpoints/?endpoint_id=24

# List variables for an endpoint
https://educationdata.urban.org/api/v1/api-endpoint-varlist/?endpoint_id=24

# List all variables
https://educationdata.urban.org/api/v1/api-variables/

# List download files
https://educationdata.urban.org/api/v1/api-downloads/?endpoint_id=24
```

## Python Examples

### Basic Request

```python
import requests

url = "https://educationdata.urban.org/api/v1/schools/ccd/directory/2020/"
response = requests.get(url).json()
schools = response["results"]
```

### With Filters

```python
import requests

url = "https://educationdata.urban.org/api/v1/schools/ccd/enrollment/2020/grade-8/"
params = {"fips": "6", "charter": "1"}  # California charter schools
response = requests.get(url, params=params).json()
```

### Summary Statistics

```python
import requests

url = "https://educationdata.urban.org/api/v1/schools/ccd/enrollment/summaries"
params = {
    "stat": "sum",
    "var": "enrollment", 
    "by": "fips,race",
    "fips": "17,55",
    "year": "2018,2019,2020"
}
response = requests.get(url, params=params).json()
```

### Get Latest Year for Endpoint

```python
import requests

def get_latest_year(endpoint_id):
    url = "https://educationdata.urban.org/api/v1/api-endpoints/"
    response = requests.get(url, params={"endpoint_id": endpoint_id}).json()
    years = response["results"][0]["years_available"]
    return years[-4:]  # Last 4 characters = most recent year

# Endpoint IDs: 24=schools/ccd/directory, 1=college-university/ipeds/directory
latest = get_latest_year(24)
```

### Full Pagination Example

```python
import requests
import pandas as pd

def fetch_all_pages(base_url, params=None):
    """Fetch all pages from paginated API endpoint."""
    data = []
    url = base_url
    
    while url:
        response = requests.get(url, params=params).json()
        data.extend(response["results"])
        url = response.get("next")
        params = None  # params only needed for first request
    
    return pd.DataFrame(data)

# Usage
df = fetch_all_pages(
    "https://educationdata.urban.org/api/v1/schools/ccd/directory/2020/",
    params={"fips": "11"}  # DC only
)
```

## State FIPS Codes Reference

| Code | State | Code | State |
|------|-------|------|-------|
| 1 | Alabama | 28 | Mississippi |
| 2 | Alaska | 29 | Missouri |
| 4 | Arizona | 30 | Montana |
| 5 | Arkansas | 31 | Nebraska |
| 6 | California | 32 | Nevada |
| 8 | Colorado | 33 | New Hampshire |
| 9 | Connecticut | 34 | New Jersey |
| 10 | Delaware | 35 | New Mexico |
| 11 | DC | 36 | New York |
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

## Data Citation

When using this data, cite as:
```
[Dataset names], Education Data Portal (Version X.X), Urban Institute, 
accessed [Date], https://educationdata.urban.org/documentation/, 
made available under the ODC Attribution License.
```

## Additional Resources

- Documentation: https://educationdata.urban.org/documentation/
- FAQ Guide: https://urbaninstitute.github.io/education-data-faqs/
- R Package: https://github.com/UrbanInstitute/education-data-package-r
- Stata Package: https://github.com/UrbanInstitute/education-data-package-stata
