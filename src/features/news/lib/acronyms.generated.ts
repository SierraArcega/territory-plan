// District acronym map.
// Generate with: `npx tsx scripts/generate-acronym-map.ts`
// Hand-curated seed: top-coverage districts known to appear in news by acronym.
// LEAIDs must be verified against the districts table by the generator;
// the starter list below is intentionally short to avoid bad matches.

export interface AcronymEntry {
  leaid: string;
  state: string;
  fullName: string;
}

export const DISTRICT_ACRONYMS: Record<string, AcronymEntry> = {
  CPS: { leaid: "1709930", state: "IL", fullName: "Chicago Public Schools" },
  LAUSD: { leaid: "0622710", state: "CA", fullName: "Los Angeles Unified School District" },
  NYCDOE: { leaid: "3620580", state: "NY", fullName: "New York City Department of Education" },
  HISD: { leaid: "4823640", state: "TX", fullName: "Houston Independent School District" },
};
