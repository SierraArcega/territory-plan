"""District name normalization and mismatch detection.

Used by compute.build_opportunity_record() to catch bug (a) and bug (b)
at sync time — see Docs/superpowers/plans/2026-04-13-opp-district-linking-fixes.md.

Must produce byte-identical output to the Postgres normalize_district_name()
function in prisma/migrations/manual/2026-04-13_normalize_district_name_fn.sql.
Python parity notes:
  1. Postgres POSIX \\s is ASCII-only. We use re.ASCII so Python's \\s
     behaves the same way.
  2. Keep multi-word phrases (e.g. 'unified school district') listed BEFORE
     their component words in the alternation. Python re uses leftmost-first
     matching; the ordering below ensures multi-word phrases win.
"""
import re
from typing import Optional

# Word list empirically derived from districts.name and opportunities.district_name.
# Extend if a legitimate match is rejected during future review.
_SUFFIX_PATTERN = re.compile(
    r"\s*(unified school district|independent school district|"
    r"consolidated school district|public school district|school district|"
    r"schools|school|district|unified|public|elementary|junior|senior|"
    r"high|middle|central|city|county|independent|charter|community|"
    r"academy)\s*",
    re.IGNORECASE | re.ASCII,
)
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def normalize_district_name(name: Optional[str]) -> str:
    """Return a canonical form of a district name for fuzzy equality.

    Must stay in sync with the normalize_district_name() Postgres function.
    """
    if not name:
        return ""
    stripped = _SUFFIX_PATTERN.sub(" ", name.lower())
    return _NON_ALNUM.sub("", stripped)
