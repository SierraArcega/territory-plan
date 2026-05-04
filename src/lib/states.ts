// Canonical US state utilities — single source of truth for state normalization.
// Import from here instead of defining local US_STATES arrays.

const STATE_NAME_TO_ABBREV: Record<string, string> = {
  ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR",
  CALIFORNIA: "CA", COLORADO: "CO", CONNECTICUT: "CT", DELAWARE: "DE",
  "DISTRICT OF COLUMBIA": "DC", FLORIDA: "FL", GEORGIA: "GA", HAWAII: "HI",
  IDAHO: "ID", ILLINOIS: "IL", INDIANA: "IN", IOWA: "IA", KANSAS: "KS",
  KENTUCKY: "KY", LOUISIANA: "LA", MAINE: "ME", MARYLAND: "MD",
  MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN", MISSISSIPPI: "MS",
  MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV",
  "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM",
  "NEW YORK": "NY", "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND",
  OHIO: "OH", OKLAHOMA: "OK", OREGON: "OR", PENNSYLVANIA: "PA",
  "PUERTO RICO": "PR", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD", TENNESSEE: "TN", TEXAS: "TX", UTAH: "UT",
  VERMONT: "VT", VIRGINIA: "VA", WASHINGTON: "WA", "WEST VIRGINIA": "WV",
  WISCONSIN: "WI", WYOMING: "WY",
};

export const STATE_ABBREV_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAME_TO_ABBREV).map(([name, abbrev]) => [
    abbrev,
    name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bOf\b/g, "of"),
  ])
);

/** All valid 2-letter state abbreviations (includes DC + PR). */
export const US_STATES: string[] = Object.values(STATE_NAME_TO_ABBREV).sort();

const VALID_ABBREVS = new Set(US_STATES);

/**
 * Normalize any state input to a 2-letter abbreviation.
 * Handles full names, abbreviations, mixed case, and whitespace.
 * Returns null if unrecognizable.
 */
export function normalizeState(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  if (trimmed.length === 2 && VALID_ABBREVS.has(trimmed)) return trimmed;
  return STATE_NAME_TO_ABBREV[trimmed] ?? null;
}

/** Check if a string is (or normalizes to) a valid US state. */
export function isValidState(raw: string): boolean {
  return normalizeState(raw) !== null;
}

/** Display name for an abbreviation (e.g. "PA" → "Pennsylvania"). */
export function stateDisplayName(abbrev: string): string {
  return STATE_ABBREV_TO_NAME[abbrev.toUpperCase()] ?? abbrev;
}
