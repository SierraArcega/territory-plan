import { DISTRICT_ACRONYMS, type AcronymEntry } from "./acronyms.generated";
import { ROLE_KEYWORDS } from "./config";
import { normalizeName } from "./dice";

// Core name of a district after stripping noise words ("Central", "Unified",
// "School District", etc). We match against this so an article that mentions
// "New Hartford School Board" hits the "New Hartford Central School District"
// district row. Names that normalize to <4 chars or a single short token
// (e.g. "PS 1") are skipped to avoid false-positives.
const MIN_CORE_LENGTH = 4;

function districtCoreName(name: string): string | null {
  const core = normalizeName(name);
  if (core.length < MIN_CORE_LENGTH) return null;
  return core;
}

export interface DistrictCandidate {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
}

export interface SchoolCandidate {
  ncessch: string;
  leaid: string;
  schoolName: string;
}

export interface ContactCandidate {
  id: number;
  leaid: string;
  name: string;
  title: string | null;
}

export interface Confirmed {
  leaid?: string;
  ncessch?: string;
  contactId?: number;
  confidence: "high";
}

export interface Ambiguous {
  reason: string;
  districtCandidates?: DistrictCandidate[];
  schoolCandidates?: SchoolCandidate[];
  contactCandidates?: ContactCandidate[];
}

export interface KeywordResult {
  confirmedDistricts: Array<{ leaid: string; confidence: "high" }>;
  confirmedSchools: Array<{ ncessch: string; confidence: "high" }>;
  confirmedContacts: Array<{ contactId: number; confidence: "high" }>;
  ambiguous: Ambiguous[];
}

export interface KeywordInput {
  articleText: string;
  stateAbbrevs: string[];
  districtsByState: Map<string, DistrictCandidate[]>;
  schoolsByLeaid: Map<string, SchoolCandidate[]>;
  contactsByLeaid: Map<string, ContactCandidate[]>;
}

export function matchArticleKeyword(input: KeywordInput): KeywordResult {
  const { articleText, stateAbbrevs, districtsByState, schoolsByLeaid, contactsByLeaid } = input;
  const text = articleText;
  const lowerText = text.toLowerCase();

  const result: KeywordResult = {
    confirmedDistricts: [],
    confirmedSchools: [],
    confirmedContacts: [],
    ambiguous: [],
  };

  const matchedLeaids = new Set<string>();

  // Pass A: acronym matches (CPS, LAUSD …)
  for (const [acronym, entry] of Object.entries(DISTRICT_ACRONYMS) as Array<[string, AcronymEntry]>) {
    const re = new RegExp(`\\b${acronym}\\b`);
    if (re.test(text) && stateAbbrevs.includes(entry.state)) {
      if (!matchedLeaids.has(entry.leaid)) {
        result.confirmedDistricts.push({ leaid: entry.leaid, confidence: "high" });
        matchedLeaids.add(entry.leaid);
      }
    }
  }

  // Pass B: district name matches (state-scoped), using the noise-stripped
  // core name so "New Hartford School Board" hits "New Hartford Central School
  // District". Falls back to the full name when the core-name is too short.
  const normText = normalizeName(lowerText);
  for (const state of stateAbbrevs) {
    const candidates = districtsByState.get(state) ?? [];
    for (const c of candidates) {
      if (matchedLeaids.has(c.leaid)) continue;
      const core = districtCoreName(c.name);
      if (!core) continue;

      const coreHit = normText.includes(core);
      const fullHit = lowerText.includes(c.name.toLowerCase());
      if (!coreHit && !fullHit) continue;

      // Ambiguity check: same core name present in another state's district set?
      const dupeStates: string[] = [];
      for (const [s, list] of districtsByState.entries()) {
        if (s === state) continue;
        if (list.some((d) => districtCoreName(d.name) === core)) dupeStates.push(s);
      }
      if (dupeStates.length > 0 && !dupeStates.every((s) => stateAbbrevs.includes(s))) {
        // Another state also has this core name but that state isn't mentioned —
        // still a clean match on this state. If all dupeStates are co-mentioned,
        // we can't disambiguate; queue it.
        result.confirmedDistricts.push({ leaid: c.leaid, confidence: "high" });
        matchedLeaids.add(c.leaid);
        continue;
      }
      if (dupeStates.length > 0) {
        result.ambiguous.push({
          reason: `district core name "${core}" present in states ${[state, ...dupeStates].join(", ")}, all co-mentioned`,
          districtCandidates: [
            c,
            ...dupeStates.flatMap((s) =>
              (districtsByState.get(s) ?? []).filter((d) => districtCoreName(d.name) === core)
            ),
          ],
        });
        continue;
      }

      result.confirmedDistricts.push({ leaid: c.leaid, confidence: "high" });
      matchedLeaids.add(c.leaid);
    }
  }

  // Pass C: schools — scoped to matched districts
  for (const leaid of matchedLeaids) {
    const schools = schoolsByLeaid.get(leaid) ?? [];
    for (const s of schools) {
      if (lowerText.includes(s.schoolName.toLowerCase())) {
        result.confirmedSchools.push({ ncessch: s.ncessch, confidence: "high" });
      }
    }
  }

  // Pass D: contacts — scoped to matched districts, require role-keyword co-occurrence
  const hasRoleKeyword = ROLE_KEYWORDS.some((k) => lowerText.includes(k));
  for (const leaid of matchedLeaids) {
    const contacts = contactsByLeaid.get(leaid) ?? [];
    for (const c of contacts) {
      if (!hasRoleKeyword) continue;
      if (lowerText.includes(c.name.toLowerCase())) {
        result.confirmedContacts.push({ contactId: c.id, confidence: "high" });
      }
    }
  }

  return result;
}
