"""Tests for sync.district_resolver."""
from sync.district_resolver import normalize_district_name


def test_normalize_strips_common_suffixes():
    assert normalize_district_name("Richland County School District 1") == \
           normalize_district_name("Richland School District 1")


def test_normalize_distinguishes_yuba_from_woodville():
    yuba = normalize_district_name("Yuba City Unified School District")
    woodville = normalize_district_name("Woodville Elementary School District")
    assert yuba != woodville


def test_normalize_handles_none():
    assert normalize_district_name(None) == ""
    assert normalize_district_name("") == ""


def test_normalize_matches_postgres_output():
    """Verify parity with the Postgres normalize_district_name() function.
    These expected values come from actually running the Postgres function
    during the Task 2/3 backfill dry-run."""
    assert normalize_district_name("Richland County School District 1") == "richland1"
    assert normalize_district_name("Richland School District 1") == "richland1"
    assert normalize_district_name("Yuba City Unified School District") == "yuba"
    assert normalize_district_name("Woodville Elementary School District") == "woodville"
    assert normalize_district_name("Onamia Public School District") == "onamia"
