"""LEAID normalization utilities."""

import math
from typing import Union, Optional


def normalize_leaid(value: Union[str, float, int, None]) -> Optional[str]:
    """
    Normalize a LEAID to a 7-character string with leading zeros.

    NCES LEAID format:
    - 7 characters total
    - First 2 digits: State FIPS code
    - Last 5 digits: District ID within state

    Examples:
    - 4500690 -> "4500690"
    - 604020 -> "0604020" (California district)
    - 4500690.0 -> "4500690"
    - "4500690" -> "4500690"

    Returns None if:
    - Value is None, NaN, or empty
    - Value cannot be converted to a valid LEAID
    - Value is longer than 7 digits
    """
    if value is None:
        return None

    # Handle NaN floats
    if isinstance(value, float):
        if math.isnan(value):
            return None
        # Convert float to int to string
        value = str(int(value))
    elif isinstance(value, int):
        value = str(value)
    elif isinstance(value, str):
        value = value.strip()
        # Handle empty strings
        if not value:
            return None
        # Remove any decimal portion from string representation
        if '.' in value:
            try:
                value = str(int(float(value)))
            except ValueError:
                return None
    else:
        return None

    # Validate: should be numeric only
    if not value.isdigit():
        return None

    # Should be at most 7 digits
    if len(value) > 7:
        return None

    # Zero-pad to 7 characters
    return value.zfill(7)


# State FIPS to abbreviation mapping
STATE_FIPS_TO_ABBREV = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
    "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
    "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
    "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
    "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
    "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
    "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
    "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
    "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
    "56": "WY", "60": "AS", "66": "GU", "69": "MP", "72": "PR",
    "78": "VI",
}

STATE_ABBREV_TO_FIPS = {v: k for k, v in STATE_FIPS_TO_ABBREV.items()}


def get_state_fips(leaid: str) -> str:
    """Extract state FIPS code from a normalized LEAID."""
    return leaid[:2]


def get_state_abbrev(leaid: str) -> Optional[str]:
    """Get state abbreviation from a normalized LEAID."""
    fips = get_state_fips(leaid)
    return STATE_FIPS_TO_ABBREV.get(fips)


def state_abbrev_to_fips(abbrev: str) -> Optional[str]:
    """Convert state abbreviation to FIPS code."""
    return STATE_ABBREV_TO_FIPS.get(abbrev.upper())
