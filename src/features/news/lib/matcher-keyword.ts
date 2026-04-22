import { DISTRICT_ACRONYMS, type AcronymEntry } from "./acronyms.generated";
import { ROLE_KEYWORDS, US_STATES } from "./config";
import { normalizeName } from "./dice";

// Tokens that carry no district-distinguishing signal. State names, cardinal
// directions, and grade-level suffixes all appear in news headlines constantly
// ("Illinois schools", "North Elementary", etc.). A school or district name
// whose tokens ALL come from this set is not a reliable auto-confirm target.
const SCHOOL_STOPWORDS = new Set<string>([
  ...US_STATES.map((s) => s.name.toLowerCase()),
  ...US_STATES.map((s) => s.abbrev.toLowerCase()),
  "north", "south", "east", "west", "central", "main", "old", "new", "upper", "lower",
  "high", "middle", "elementary", "junior", "senior", "primary", "secondary",
  "school", "schools", "academy", "district", "elem", "jr", "sr",
  "america", "united", "states",
]);

/** Whether a school name has at least one distinctive token (not in the stoplist). */
export function schoolHasDistinctiveToken(name: string): boolean {
  const tokens = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.some((t) => t.length >= 3 && !SCHOOL_STOPWORDS.has(t));
}

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

/**
 * Whether a district name is distinctive enough that a full-name literal
 * substring match is unambiguous. Single-word names that collide with common
 * place names ("Portland", "York", "Bangor") are NOT distinctive — they'd
 * trigger on any article mentioning that city for unrelated reasons. These
 * go to the LLM regardless of exact-substring match.
 *
 * Distinctive if:
 *   • name has ≥2 words (e.g. "Portland Public Schools"), OR
 *   • contains a school/district suffix keyword ("Unified", "ISD", etc.), OR
 *   • has a number in it ("School District 11")
 */
const DISTRICT_SUFFIX_RE = /\b(unified|independent|consolidated|central|public|schools?|district|academy|isd|usd|county|area|regional|cooperative|charter|community)\b/i;

function isDistinctiveForTier1(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.split(/\s+/).length >= 2) return true;
  if (/\d/.test(trimmed)) return true;
  if (DISTRICT_SUFFIX_RE.test(trimmed)) return true;
  return false;
}

export interface DistrictCandidate {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  cityLocation: string | null;
  countyName: string | null;
  accountName: string | null;
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
  /** Flat schools-by-state index. If omitted, Pass B3 falls back to the per-
   *  district iteration (slow but correct). Prefer passing this for perf. */
  schoolsByState?: Map<string, SchoolCandidate[]>;
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
  const { articleText, stateAbbrevs, districtsByState, schoolsByLeaid, schoolsByState, contactsByLeaid } = input;
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

  // Pass B: full literal district name + state → auto-confirm, but only
  // when the name is distinctive. Non-distinctive names (single-word place
  // names like "Portland", "York") go to Pass C for LLM disambiguation.
  for (const state of stateAbbrevs) {
    const candidates = districtsByState.get(state) ?? [];
    for (const c of candidates) {
      if (confirmedLeaids.has(c.leaid)) continue;
      if (!isDistinctiveForTier1(c.name)) continue;
      if (lowerText.includes(c.name.toLowerCase())) {
        result.confirmedDistricts.push({ leaid: c.leaid, confidence: "high" });
        confirmedLeaids.add(c.leaid);
      }
    }
  }

  // Pass B2: city/county + district-context phrase → auto-confirm.
  // Catches local-news headlines like "Stockton school district passes bond"
  // that don't name the district but name its city. Requires edu context to
  // avoid false-positives on pure geographic mentions.
  //
  // Guard against compound-city traps: "Vernon" should NOT match inside
  // "Mount Vernon"; "York" should NOT match inside "New York";
  // "Washington" should NOT match inside "Fort Washington" / "Lake Washington".
  const DISTRICT_CONTEXT_RE = /\b(school district|school board|superintendent|school system|district's?|public schools?)\b/i;
  const COMPOUND_PREFIX_RE = /(mount|new|north|south|east|west|fort|port|old|upper|lower|lake|point|cape|san|saint|st\.?)$/i;
  if (DISTRICT_CONTEXT_RE.test(articleText)) {
    for (const state of stateAbbrevs) {
      const candidates = districtsByState.get(state) ?? [];
      for (const c of candidates) {
        if (confirmedLeaids.has(c.leaid)) continue;
        const city = c.cityLocation?.toLowerCase();
        if (!city || city.length < 4) continue;
        const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const cityRe = new RegExp(`\\b${escaped}\\b`, "g");
        let match: RegExpExecArray | null;
        let foundStandalone = false;
        while ((match = cityRe.exec(lowerText)) !== null) {
          // Look at up to 10 chars before the match for a compound prefix word
          const start = Math.max(0, match.index - 10);
          const before = lowerText.slice(start, match.index).trim();
          if (!COMPOUND_PREFIX_RE.test(before)) {
            foundStandalone = true;
            break;
          }
        }
        if (!foundStandalone) continue;
        // Only one district per city per state can auto-confirm this way —
        // avoids auto-linking multiple districts in the same city.
        const othersInSameCity = candidates.filter(
          (d) => d.leaid !== c.leaid && d.cityLocation?.toLowerCase() === city
        );
        if (othersInSameCity.length > 0) continue;
        result.confirmedDistricts.push({ leaid: c.leaid, confidence: "high" });
        confirmedLeaids.add(c.leaid);
      }
    }
  }

  // Pass B3: school-first lookup. Many local stories name a school but not
  // its parent district ("Central High School…" rather than "Anywhere Unified
  // SD's Central High"). Scan state-scoped schools for any literal school-
  // name hit; if found, auto-confirm the parent district — but only when the
  // school name has at least one distinctive (non-stopword) token.
  //
  // Uses a flat schoolsByState index when available so this pass is O(articles
  // × mentioned-states × schools-in-state) instead of O(articles × districts
  // × schools-per-district). On the 5994-article corpus that's a ~100×
  // speedup.
  for (const state of stateAbbrevs) {
    const stateSchools = schoolsByState
      ? schoolsByState.get(state) ?? []
      : // Fallback: flatten on the fly (slower but still correct)
        (districtsByState.get(state) ?? []).flatMap(
          (d) => schoolsByLeaid.get(d.leaid) ?? []
        );
    for (const s of stateSchools) {
      if (confirmedLeaids.has(s.leaid)) continue;
      const sn = s.schoolName.toLowerCase();
      if (sn.length < 6) continue;
      const words = sn.split(/\s+/).filter(Boolean).length;
      if (words < 2) continue;
      if (!schoolHasDistinctiveToken(s.schoolName)) continue;
      if (!lowerText.includes(sn)) continue;
      result.confirmedDistricts.push({ leaid: s.leaid, confidence: "high" });
      confirmedLeaids.add(s.leaid);
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
