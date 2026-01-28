"""Currency parsing utilities."""

import math
from typing import Union


def parse_currency(value: Union[str, float, int, None]) -> float:
    """
    Parse a currency string like "$1,234.56" into a float.

    Handles:
    - Dollar signs
    - Commas as thousand separators
    - Negative values (both -$X and ($X) formats)
    - Empty/null values
    - Already numeric values

    Returns 0.0 for invalid/empty values.
    """
    if value is None:
        return 0.0

    if isinstance(value, (int, float)):
        if math.isnan(value):
            return 0.0
        return float(value)

    if not isinstance(value, str):
        return 0.0

    # Strip whitespace
    value = value.strip()

    if not value:
        return 0.0

    # Handle parentheses for negative (accounting format)
    is_negative = False
    if value.startswith('(') and value.endswith(')'):
        is_negative = True
        value = value[1:-1]
    elif value.startswith('-'):
        is_negative = True
        value = value[1:]

    # Remove currency symbols and thousand separators
    value = value.replace('$', '').replace(',', '').strip()

    if not value:
        return 0.0

    try:
        result = float(value)
        return -result if is_negative else result
    except ValueError:
        return 0.0


def parse_int(value: Union[str, float, int, None]) -> int:
    """
    Parse a string or numeric value to an integer.

    Handles comma-separated numbers like "1,234".
    Returns 0 for invalid/empty values.
    """
    if value is None:
        return 0

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        if math.isnan(value):
            return 0
        return int(value)

    if not isinstance(value, str):
        return 0

    # Strip and remove commas
    value = value.strip().replace(',', '')

    if not value:
        return 0

    try:
        # Handle decimal strings by truncating
        return int(float(value))
    except ValueError:
        return 0
