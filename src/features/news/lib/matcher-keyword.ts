import { DISTRICT_ACRONYMS, type AcronymEntry } from "./acronyms.generated";
import { ROLE_KEYWORDS } from "./config";

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

  // Pass B: full district name matches (state-scoped)
  for (const state of stateAbbrevs) {
    const candidates = districtsByState.get(state) ?? [];
    for (const c of candidates) {
      if (matchedLeaids.has(c.leaid)) continue;
      const cname = c.name.toLowerCase();
      if (!lowerText.includes(cname)) continue;

      // Ambiguity check: is this same name also in districtsByState for another state?
      const dupeStates: string[] = [];
      for (const [s, list] of districtsByState.entries()) {
        if (s === state) continue;
        if (list.some((d) => d.name.toLowerCase() === cname)) dupeStates.push(s);
      }
      if (dupeStates.length > 0 && !stateAbbrevs.some((s) => dupeStates.includes(s) === false)) {
        // Multiple states have same name and article mentions all of them — ambiguous
        result.ambiguous.push({
          reason: `district name "${c.name}" ambiguous across states ${[state, ...dupeStates].join(", ")}`,
          districtCandidates: [
            c,
            ...dupeStates.flatMap(
              (s) => (districtsByState.get(s) ?? []).filter((d) => d.name.toLowerCase() === cname)
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
