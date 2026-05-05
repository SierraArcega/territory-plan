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

/**
 * USPS abbreviation -> 2-digit Census/NCES state FIPS code.
 * Covers 50 states + DC + Puerto Rico. Same scope as US_STATES.
 */
export const USPS_TO_FIPS: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
  DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17",
  IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24",
  MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31",
  NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38",
  OH: "39", OK: "40", OR: "41", PA: "42", PR: "72", RI: "44", SC: "45",
  SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53",
  WV: "54", WI: "55", WY: "56",
};

/** Inverse of USPS_TO_FIPS. */
export const FIPS_TO_USPS: Record<string, string> = Object.fromEntries(
  Object.entries(USPS_TO_FIPS).map(([usps, fips]) => [fips, usps])
);

/** Returns FIPS or null. Case-insensitive on input. */
export function abbrevToFips(abbrev: string | null | undefined): string | null {
  if (!abbrev || typeof abbrev !== "string") return null;
  return USPS_TO_FIPS[abbrev.toUpperCase()] ?? null;
}

/** Returns USPS or null. */
export function fipsToAbbrev(fips: string | null | undefined): string | null {
  if (!fips || typeof fips !== "string") return null;
  return FIPS_TO_USPS[fips] ?? null;
}
