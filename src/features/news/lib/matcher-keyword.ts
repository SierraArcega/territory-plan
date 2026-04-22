import { DISTRICT_ACRONYMS, type AcronymEntry } from "./acronyms.generated";
import { ROLE_KEYWORDS } from "./config";
import { normalizeName } from "./dice";

/**
 * Core name = district name with noise words stripped ("Central", "Unified",
 * "School District", etc.). Used to identify candidates for LLM disambiguation,
 * NOT for auto-linking — because noise stripping reduces "York Central School
 * District" to "york", which matches any article mentioning "New York". The
 * LLM decides whether such a core hit is genuinely about the district.
 */
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

/**
 * Two-tier keyword matcher:
 *
 * Tier 1 — auto-confirm (high precision, rules only apply when there is
 * essentially no false-positive risk):
 *   • Acronym + state: "CPS" appears as a word, stateAbbrevs includes "IL"
 *   • Full District.name as literal substring, and state is confirmed
 *
 * Tier 2 — queue for LLM (everything softer):
 *   • Core-name (noise-stripped) match
 *   • Schools/contacts whose parent district was NOT confirmed in Tier 1
 *   • Any other partial signal
 *
 * The LLM (Haiku, `matcher-llm.ts`) looks at the full article title and
 * description and decides which candidates are actually the subject.
 */
export function matchArticleKeyword(input: KeywordInput): KeywordResult {
  const { articleText, stateAbbrevs, districtsByState, schoolsByLeaid, contactsByLeaid } = input;
  const lowerText = articleText.toLowerCase();

  const result: KeywordResult = {
    confirmedDistricts: [],
    confirmedSchools: [],
    confirmedContacts: [],
    ambiguous: [],
  };

  const confirmedLeaids = new Set<string>();
  const queuedLeaids = new Set<string>();

  // Pass A: acronym + state → auto-confirm
  for (const [acronym, entry] of Object.entries(DISTRICT_ACRONYMS) as Array<[string, AcronymEntry]>) {
    const re = new RegExp(`\\b${acronym}\\b`);
    if (re.test(articleText) && stateAbbrevs.includes(entry.state)) {
      if (!confirmedLeaids.has(entry.leaid)) {
        result.confirmedDistricts.push({ leaid: entry.leaid, confidence: "high" });
        confirmedLeaids.add(entry.leaid);
      }
    }
  }

  // Pass B: full literal district name + state → auto-confirm
  for (const state of stateAbbrevs) {
    const candidates = districtsByState.get(state) ?? [];
    for (const c of candidates) {
      if (confirmedLeaids.has(c.leaid)) continue;
      if (lowerText.includes(c.name.toLowerCase())) {
        result.confirmedDistricts.push({ leaid: c.leaid, confidence: "high" });
        confirmedLeaids.add(c.leaid);
      }
    }
  }

  // Pass C: core-name hits → queue for LLM. A core-name match alone is not
  // enough to auto-link (e.g., "York Central SD" core = "york" which always
  // appears in NY-scoped articles via "New York"). Gather all candidates in
  // all mentioned states into one queue entry per core so the LLM sees the
  // full disambiguation context.
  const coreCandidateMap = new Map<string, DistrictCandidate[]>();
  for (const state of stateAbbrevs) {
    const candidates = districtsByState.get(state) ?? [];
    for (const c of candidates) {
      if (confirmedLeaids.has(c.leaid) || queuedLeaids.has(c.leaid)) continue;
      const core = districtCoreName(c.name);
      if (!core) continue;
      if (!lowerText.includes(core)) continue;
      const existing = coreCandidateMap.get(core) ?? [];
      existing.push(c);
      coreCandidateMap.set(core, existing);
      queuedLeaids.add(c.leaid);
    }
  }
  for (const [core, cands] of coreCandidateMap) {
    result.ambiguous.push({
      reason: `core name "${core}" matched in state(s) ${[...new Set(cands.map((c) => c.stateAbbrev))].join(",")} — LLM to disambiguate`,
      districtCandidates: cands,
    });
  }

  // Pass D: schools scoped to confirmed districts — still auto-confirm when
  // the full school name matches exactly.
  for (const leaid of confirmedLeaids) {
    const schools = schoolsByLeaid.get(leaid) ?? [];
    for (const s of schools) {
      if (lowerText.includes(s.schoolName.toLowerCase())) {
        result.confirmedSchools.push({ ncessch: s.ncessch, confidence: "high" });
      }
    }
  }

  // Schools whose parent district is in the LLM queue → queue them too, so
  // the LLM has them as candidates. The LLM confirms both district and schools.
  const queuedSchoolCandidates: SchoolCandidate[] = [];
  for (const leaid of queuedLeaids) {
    const schools = schoolsByLeaid.get(leaid) ?? [];
    for (const s of schools) {
      if (lowerText.includes(s.schoolName.toLowerCase())) {
        queuedSchoolCandidates.push(s);
      }
    }
  }
  if (queuedSchoolCandidates.length > 0 && result.ambiguous.length > 0) {
    result.ambiguous[0].schoolCandidates = queuedSchoolCandidates;
  }

  // Pass E: contacts — auto-confirm only when district is confirmed AND role
  // keyword is present AND contact name matches. Queue remaining for LLM.
  const hasRoleKeyword = ROLE_KEYWORDS.some((k) => lowerText.includes(k));
  for (const leaid of confirmedLeaids) {
    const contacts = contactsByLeaid.get(leaid) ?? [];
    for (const c of contacts) {
      if (!hasRoleKeyword) continue;
      if (lowerText.includes(c.name.toLowerCase())) {
        result.confirmedContacts.push({ contactId: c.id, confidence: "high" });
      }
    }
  }

  const queuedContactCandidates: ContactCandidate[] = [];
  for (const leaid of queuedLeaids) {
    const contacts = contactsByLeaid.get(leaid) ?? [];
    for (const c of contacts) {
      if (lowerText.includes(c.name.toLowerCase())) {
        queuedContactCandidates.push(c);
      }
    }
  }
  if (queuedContactCandidates.length > 0 && result.ambiguous.length > 0) {
    result.ambiguous[0].contactCandidates = queuedContactCandidates;
  }

  return result;
}
