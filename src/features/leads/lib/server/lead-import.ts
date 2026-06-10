import prisma from "@/lib/prisma";
import type { DbClient } from "@/features/shared/lib/service-error";
import { ALL_ACTIVITY_TYPES } from "@/features/activities/types";
import {
  matchByName,
  normalizeSchoolName,
  orgNameSimilarity,
  schoolNameSimilarity,
} from "@/features/shared/lib/district-name-match";
import { abbrevToFips, normalizeState } from "@/lib/states";
import {
  ACTIVE_LEAD_STATUSES,
  LEAD_TYPES,
  pickMostRecentContact,
} from "./lead-service";

/**
 * Bulk import resolution + application for leads and engagement activity.
 *
 * The resolver is the SINGLE code path behind both `?dryRun=1` (preview) and
 * the wet run: the route resolves first, returns the plan when dry-running,
 * and otherwise feeds the same plan to the apply step — so the preview the
 * user approved and the writes that happen cannot drift.
 */

export const MAX_IMPORT_ROWS = 500;

// ---- Normalizers (mirror the ETL: leaid zfill(7), ncessch zfill(12)) -------

export function normalizeLeaid(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return /^\d{1,7}$/.test(raw) ? raw.padStart(7, "0") : raw;
}

export function normalizeNcessch(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return /^\d{1,12}$/.test(raw) ? raw.padStart(12, "0") : raw;
}

export type NcesIdClass =
  | { kind: "leaid"; value: string }
  | { kind: "ncessch"; value: string }
  | { kind: "invalid" };

/**
 * Marketing exports ship ONE mixed "NCES ID" column: 7-digit district LEAIDs,
 * 12-digit school ids, blanks, and junk. Classify by digit count — ≤7 digits
 * is a district leaid (zfill 7), 8–12 digits is a school ncessch (zfill 12),
 * anything else is unusable and must NEVER mint a district stub.
 */
export function classifyNcesId(value: unknown): NcesIdClass | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return { kind: "invalid" };
  if (raw.length <= 7) return { kind: "leaid", value: raw.padStart(7, "0") };
  if (raw.length <= 12) return { kind: "ncessch", value: raw.padStart(12, "0") };
  return { kind: "invalid" };
}

/** School ids must be 12-digit numeric after zfill — anything else is junk. */
function strictNcessch(value: unknown): string | null {
  const norm = normalizeNcessch(value);
  return norm && /^\d{12}$/.test(norm) ? norm : null;
}

/** The row's usable NCES inputs after mixed-column disambiguation. */
interface NcesInputs {
  /** Valid 12-digit school id (explicit column wins over the mixed column). */
  schoolNcessch: string | null;
  /** Valid 7-digit district leaid from the mixed column. */
  leaid: string | null;
  /** The leaid column held something non-numeric / over 12 digits. */
  invalidLeaidInput: boolean;
  /** The explicit school column held something that isn't a 12-digit id. */
  invalidSchoolInput: boolean;
}

function ncesInputs(row: LeadImportRow | ActivityImportRow): NcesInputs {
  const rawSchool = row.schoolNcessch == null ? "" : String(row.schoolNcessch).trim();
  const explicitSchool = rawSchool ? strictNcessch(rawSchool) : null;
  const cls = classifyNcesId(row.leaid);
  // A school-shaped (8–12 digit) value in the mixed column counts as the
  // row's school only when no usable explicit school id was provided.
  const fromLeaidColumn = !explicitSchool && cls?.kind === "ncessch" ? cls.value : null;
  return {
    schoolNcessch: explicitSchool ?? fromLeaidColumn,
    leaid: cls?.kind === "leaid" ? cls.value : null,
    invalidLeaidInput: cls?.kind === "invalid",
    invalidSchoolInput: !!rawSchool && !explicitSchool,
  };
}

/**
 * Marketing "Company Name" cells are often a SCHOOL ("A P Solis Middle
 * School") rather than the district. Heuristic gate for the school-table
 * name fallback — school-ish word present, district-ish word absent.
 */
const SCHOOL_NAME_HINT =
  /\b(school|elementary|middle|high|academy|campus|center|centre|preparatory|prep|kindergarten)\b/i;
const DISTRICT_NAME_HINT =
  /\b(district|isd|usd|cusd|schools|unified|department|board|county office)\b/i;
export function looksLikeSchoolName(name: string): boolean {
  return SCHOOL_NAME_HINT.test(name) && !DISTRICT_NAME_HINT.test(name);
}

/**
 * NCES-id ↔ row-name cross-check threshold. Marketing exports carry a wrong
 * "NCES ID" for ~30% of school rows while the school NAMES are reliable, so
 * an id-resolved row whose school-ish name scores below this bar against the
 * id's school is treated as a conflict.
 *
 * 0.80, deliberately under `matchByName`'s 0.85 fuzzy bar: that bar guards
 * auto-PICKING one of many candidates; this one only validates a single known
 * pair, where the failure mode is a warning, not a silent wrong write. School
 * names are short and noisy, and Dice punishes word drops hard — measured on
 * normalized pairs: same-school variants land just above 0.80 ("Truman High
 * School" vs "Harry S Truman High School" 0.81, "Memorial High School" vs
 * "Memorial Senior High School" 0.84) while different schools sharing a
 * generic suffix land below ("Riverside High School" vs "Lakeside High
 * School" 0.77, "Jefferson Elementary" vs "Jackson Elementary" 0.72).
 *
 * Scored with `schoolNameSimilarity`, which expands NCES abbreviations first
 * — "Manvel High School" vs "MANVEL H S" is the SAME school (1.0), not a
 * false mismatch, while "Clear Creek Elementary" vs "KOSTORYZ EL" still
 * conflicts (~0.51): only the type token matches, not the name.
 */
export const NCES_NAME_AGREE_THRESHOLD = 0.8;

/** True when a row's school-ish name disagrees with the NCES-resolved school. */
function ncesNameConflicts(rowName: string, ncesSchoolName: string): boolean {
  return schoolNameSimilarity(rowName, ncesSchoolName) < NCES_NAME_AGREE_THRESHOLD;
}

/** Row state ("Texas", "tx") → 2-digit FIPS, or null when unusable. */
function rowStateFips(row: LeadImportRow | ActivityImportRow): string | null {
  return row.state ? abbrevToFips(normalizeState(row.state)) : null;
}

export function normalizeEmail(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim().toLowerCase();
  return raw.includes("@") ? raw : null;
}

// ---- Email-domain → district inference ---------------------------------------
//
// A school-org email domain (killeenisd.org, donnaisd.net) pins the district
// even when the row's org name is ambiguous statewide. Inference is built from
// our own contacts table — which districts do contacts on this domain belong
// to? — and only trusted when the domain is DOMINANT (constants below).
// A domain is never trusted ALONE: the row's name must corroborate it.

/**
 * A domain implies a district only when one leaid holds at least this share
 * of the domain's contacts. Multi-district domains (regional co-ops, vendor
 * domains) split below this bar and imply nothing.
 */
export const DOMAIN_DOMINANCE_RATIO = 0.8;
/**
 * …and that leaid must hold at least this many contacts. A single contact is
 * one typo or one mis-assigned record away from a wrong district.
 */
export const DOMAIN_MIN_CONTACTS = 2;
/** Cap on distinct domains per import batch (rows cap at 500 anyway). */
const MAX_DOMAIN_LOOKUPS = 200;
/** Free-mail domains say nothing about a district — never looked up. */
export const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "rocketmail.com",
  "outlook.com", "hotmail.com", "live.com", "msn.com", "aol.com",
  "icloud.com", "me.com", "mac.com", "comcast.net", "att.net",
  "verizon.net", "sbcglobal.net", "bellsouth.net", "cox.net", "charter.net",
  "protonmail.com", "proton.me", "zoho.com", "mail.com", "gmx.com",
]);

/** Lowercased domain of a normalized email, or null for free-mail/junk. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain && !FREE_MAIL_DOMAINS.has(domain) ? domain : null;
}

/** Port of the prototype's nameFromEmail — last-resort contact name. */
export function nameFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").replace(/[._-]+/g, " ").trim();
  if (!local) return "New contact";
  const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : "");
  const parts = local.split(" ");
  if (parts.length === 1) return cap(parts[0]);
  return `${cap(parts[0])} ${cap(parts[parts.length - 1])}`;
}

// ---- Row shapes -------------------------------------------------------------

export interface LeadImportRow {
  email?: string;
  name?: string;
  first?: string;
  last?: string;
  title?: string;
  phone?: string;
  leaid?: string;
  districtName?: string;
  /** Row's US state ("Texas" or "TX") — enables the name-match fallback. */
  state?: string;
  schoolNcessch?: string;
  leadType?: string;
  sequence?: string;
  marketingOwner?: string;
  assignedBdrId?: string;
  score?: number;
}

export interface ActivityImportRow {
  email?: string;
  /** Prototype engagement kind: email | call | meeting | webinar | form | web | note. */
  kind?: string;
  /** Explicit app activity type — wins over kind when valid. */
  type?: string;
  title?: string;
  text?: string;
  notes?: string;
  occurredAt?: string;
  points?: number;
  leaid?: string;
  districtName?: string;
  /** Row's US state ("Texas" or "TX") — enables the name-match fallback. */
  state?: string;
  schoolNcessch?: string;
}

// Prototype kinds → existing app activity types (never mint new types).
const KIND_TO_TYPE: Record<string, string> = {
  email: "email",
  call: "cold_call",
  meeting: "discovery_call",
  webinar: "webinar",
};
const FALLBACK_ACTIVITY_TYPE = "email";

export function activityTypeForRow(row: ActivityImportRow): string {
  if (row.type && (ALL_ACTIVITY_TYPES as readonly string[]).includes(row.type)) {
    return row.type;
  }
  if (row.kind && KIND_TO_TYPE[row.kind.toLowerCase()]) {
    return KIND_TO_TYPE[row.kind.toLowerCase()];
  }
  return FALLBACK_ACTIVITY_TYPE;
}

// ---- Resolution shapes --------------------------------------------------------

export interface ResolvedContact {
  id: number | null;
  name: string | null;
  email: string | null;
  willCreate: boolean;
}
export interface ResolvedSchool {
  ncessch: string;
  name: string | null;
}
export interface ResolvedDistrict {
  leaid: string;
  name: string | null;
  willCreate: boolean;
}

interface RowResolutionBase {
  index: number;
  ok: boolean;
  error: string | null;
  warnings: string[];
  contact: ResolvedContact | null;
  school: ResolvedSchool | null;
  district: ResolvedDistrict | null;
  /** District resolved from the school's NCES id. */
  viaNces: boolean;
  /** District resolved by name + state match. */
  viaName: boolean;
}

export interface ActivityRowResolution extends RowResolutionBase {
  /** Active lead that receives the row's points; null = retained on records. */
  leadId: string | null;
  points: number;
}

export interface LeadRowResolution extends RowResolutionBase {
  /** Assigned BDR after validation (falls back to the importer). */
  assignedBdrId: string | null;
  leadType: string | null;
}

// ---- Shared lookup context -----------------------------------------------------

interface ContactLite {
  id: number;
  name: string;
  email: string | null;
  leaid: string;
  schoolNcessch: string | null;
  createdAt: Date;
  lastEnrichedAt: Date | null;
}

interface ResolutionContext {
  contactsByEmail: Map<string, ContactLite[]>;
  schoolsByNcessch: Map<string, { ncessch: string; schoolName: string; leaid: string }>;
  districtsByLeaid: Map<string, { leaid: string; name: string }>;
  /** Name-fallback candidates, keyed by state FIPS (only prefetched states). */
  districtsByStateFips: Map<string, Array<{ leaid: string; name: string }>>;
  schoolsByStateFips: Map<string, Array<{ ncessch: string; schoolName: string; leaid: string }>>;
  /** Email domain → the leaid that DOMINATES that domain's contacts. */
  districtByEmailDomain: Map<string, string>;
  /** Schools of the domain-implied districts, keyed by leaid (batched prefetch). */
  schoolsByLeaid: Map<string, Array<{ ncessch: string; schoolName: string; leaid: string }>>;
  activeLeadByContactId: Map<number, string>;
  validUserIds: Set<string>;
}

async function buildContext(
  rows: Array<LeadImportRow | ActivityImportRow>,
  db: DbClient,
): Promise<ResolutionContext> {
  const emails = [
    ...new Set(rows.map((r) => normalizeEmail(r.email)).filter((e): e is string => !!e)),
  ];
  // Disambiguated NCES inputs per row (the leaid column may carry school ids).
  const ncesByRow = rows.map(ncesInputs);
  const ncesschs = [
    ...new Set(ncesByRow.map((n) => n.schoolNcessch).filter((n): n is string => !!n)),
  ];
  const bdrIds = [
    ...new Set(
      rows
        .map((r) => ("assignedBdrId" in r ? r.assignedBdrId : undefined))
        .filter((id): id is string => !!id),
    ),
  ];

  const contacts: ContactLite[] = emails.length
    ? await db.contact.findMany({
        where: { email: { in: emails, mode: "insensitive" } },
        select: {
          id: true,
          name: true,
          email: true,
          leaid: true,
          schoolNcessch: true,
          createdAt: true,
          lastEnrichedAt: true,
        },
      })
    : [];
  const contactsByEmail = new Map<string, ContactLite[]>();
  for (const c of contacts) {
    const key = c.email?.trim().toLowerCase();
    if (!key) continue;
    const list = contactsByEmail.get(key) ?? [];
    list.push(c);
    contactsByEmail.set(key, list);
  }

  const schools = ncesschs.length
    ? await db.school.findMany({
        where: { ncessch: { in: ncesschs } },
        select: { ncessch: true, schoolName: true, leaid: true },
      })
    : [];
  const schoolsByNcessch = new Map(schools.map((s) => [s.ncessch, s]));

  const leaids = new Set<string>();
  for (const n of ncesByRow) {
    if (n.leaid) leaids.add(n.leaid);
  }
  for (const s of schools) leaids.add(s.leaid);
  for (const c of contacts) leaids.add(c.leaid);

  const districts = leaids.size
    ? await db.district.findMany({
        where: { leaid: { in: [...leaids] } },
        select: { leaid: true, name: true },
      })
    : [];
  const districtsByLeaid = new Map(districts.map((d) => [d.leaid, d]));

  // Name-fallback prefetch: rows with no usable NCES resolution but a
  // district-name + state get that state's districts loaded for in-memory
  // matching — and its schools too when the name looks like a school.
  // Rows that DO resolve via a school NCES id but carry a school-ish name
  // that disagrees with that school also get the state loaded, so the
  // resolver's NCES↔name cross-check can attempt the name override.
  // The same rows (name disambiguation needed) also feed the email-domain →
  // district inference — collected here, resolved in ONE grouped query below.
  const districtFips = new Set<string>();
  const schoolFips = new Set<string>();
  const domainCandidates = new Set<string>();
  rows.forEach((row, i) => {
    const name = row.districtName?.trim();
    if (!name) return;
    const email = normalizeEmail(row.email);
    if (email && contactsByEmail.has(email)) return; // existing contacts keep their district
    const domain = email ? emailDomain(email) : null;
    const addDomain = () => {
      if (domain && domainCandidates.size < MAX_DOMAIN_LOOKUPS) domainCandidates.add(domain);
    };
    const n = ncesByRow[i];
    const ncesSchool = n.schoolNcessch ? schoolsByNcessch.get(n.schoolNcessch) : undefined;
    if (ncesSchool) {
      // Resolves via the school id — prefetch only when the cross-check will
      // actually fire (school-ish name that disagrees with the id's school).
      if (!looksLikeSchoolName(name)) return;
      if (!ncesNameConflicts(name, ncesSchool.schoolName)) return;
      addDomain(); // domain-scoped override works even without a state
      const fips = rowStateFips(row);
      if (!fips) return;
      districtFips.add(fips); // override path names the school's district
      schoolFips.add(fips);
      return;
    }
    if (n.leaid) return; // resolves (or stubs) by district id
    addDomain(); // domain + name corroboration works even without a state
    const fips = rowStateFips(row);
    if (!fips) return;
    districtFips.add(fips);
    if (looksLikeSchoolName(name)) schoolFips.add(fips);
  });

  const districtsByStateFips = new Map<string, Array<{ leaid: string; name: string }>>();
  if (districtFips.size > 0) {
    const stateDistricts = await db.district.findMany({
      where: { stateFips: { in: [...districtFips] } },
      select: { leaid: true, name: true, stateFips: true },
    });
    for (const d of stateDistricts) {
      const list = districtsByStateFips.get(d.stateFips) ?? [];
      list.push({ leaid: d.leaid, name: d.name });
      districtsByStateFips.set(d.stateFips, list);
    }
  }
  const schoolsByStateFips = new Map<
    string,
    Array<{ ncessch: string; schoolName: string; leaid: string }>
  >();
  if (schoolFips.size > 0) {
    const stateSchools = await db.school.findMany({
      where: { stateFips: { in: [...schoolFips] } },
      select: { ncessch: true, schoolName: true, leaid: true, stateFips: true },
    });
    for (const s of stateSchools) {
      if (!s.stateFips) continue;
      const list = schoolsByStateFips.get(s.stateFips) ?? [];
      list.push({ ncessch: s.ncessch, schoolName: s.schoolName, leaid: s.leaid });
      schoolsByStateFips.set(s.stateFips, list);
    }
  }

  // Email-domain → district inference: ONE grouped query over contacts for
  // all candidate domains, then in-memory dominance. A domain implies a
  // district only when one leaid holds ≥ DOMAIN_DOMINANCE_RATIO of the
  // domain's contacts AND ≥ DOMAIN_MIN_CONTACTS contacts.
  const districtByEmailDomain = new Map<string, string>();
  if (domainCandidates.size > 0) {
    const domainContacts = await db.contact.findMany({
      where: {
        OR: [...domainCandidates].map((d) => ({
          email: { endsWith: `@${d}`, mode: "insensitive" as const },
        })),
      },
      select: { email: true, leaid: true },
    });
    const leaidCountsByDomain = new Map<string, Map<string, number>>();
    for (const c of domainContacts) {
      const domain = c.email ? emailDomain(c.email) : null;
      if (!domain || !domainCandidates.has(domain)) continue;
      const counts = leaidCountsByDomain.get(domain) ?? new Map<string, number>();
      counts.set(c.leaid, (counts.get(c.leaid) ?? 0) + 1);
      leaidCountsByDomain.set(domain, counts);
    }
    for (const [domain, counts] of leaidCountsByDomain) {
      let total = 0;
      let topLeaid: string | null = null;
      let topCount = 0;
      for (const [leaid, count] of counts) {
        total += count;
        if (count > topCount) {
          topLeaid = leaid;
          topCount = count;
        }
      }
      if (topLeaid && topCount >= DOMAIN_MIN_CONTACTS && topCount / total >= DOMAIN_DOMINANCE_RATIO) {
        districtByEmailDomain.set(domain, topLeaid);
      }
    }
  }

  // Implied districts' schools join the batched prefetch (still no per-row
  // queries) so the resolver can match names WITHIN an implied district —
  // including for rows whose state was missing from the stateFips prefetch.
  const schoolsByLeaid = new Map<
    string,
    Array<{ ncessch: string; schoolName: string; leaid: string }>
  >();
  const impliedLeaids = [...new Set(districtByEmailDomain.values())];
  if (impliedLeaids.length > 0) {
    const impliedSchools = await db.school.findMany({
      where: { leaid: { in: impliedLeaids } },
      select: { ncessch: true, schoolName: true, leaid: true },
    });
    for (const s of impliedSchools) {
      const list = schoolsByLeaid.get(s.leaid) ?? [];
      list.push(s);
      schoolsByLeaid.set(s.leaid, list);
    }
    // Implied districts always exist (contacts.leaid is a FK) but may not be
    // in districtsByLeaid yet — fetch the missing ones for their names.
    const missing = impliedLeaids.filter((l) => !districtsByLeaid.has(l));
    if (missing.length > 0) {
      const impliedDistricts = await db.district.findMany({
        where: { leaid: { in: missing } },
        select: { leaid: true, name: true },
      });
      for (const d of impliedDistricts) districtsByLeaid.set(d.leaid, d);
    }
  }

  const contactIds = contacts.map((c) => c.id);
  const activeLeads = contactIds.length
    ? await db.lead.findMany({
        where: { contactId: { in: contactIds }, status: { in: [...ACTIVE_LEAD_STATUSES] } },
        select: { id: true, contactId: true },
      })
    : [];
  const activeLeadByContactId = new Map(activeLeads.map((l) => [l.contactId, l.id]));

  const users = bdrIds.length
    ? await db.userProfile.findMany({
        where: { id: { in: bdrIds } },
        select: { id: true },
      })
    : [];

  return {
    contactsByEmail,
    schoolsByNcessch,
    districtsByLeaid,
    districtsByStateFips,
    schoolsByStateFips,
    districtByEmailDomain,
    schoolsByLeaid,
    activeLeadByContactId,
    validUserIds: new Set(users.map((u) => u.id)),
  };
}

// ---- Core per-row resolution (shared by both datasets) ---------------------------

interface RecordResolution {
  error: string | null;
  warnings: string[];
  existingContact: ContactLite | null;
  contact: ResolvedContact | null;
  school: ResolvedSchool | null;
  district: ResolvedDistrict | null;
  viaNces: boolean;
  viaName: boolean;
}

/**
 * Unambiguous school-by-name + state match (exact/normalized only — fuzzy is
 * off because school names are only trustworthy on those tiers) → the school
 * plus its district via the school's leaid FK. Shared by the no-id name
 * fallback and the NCES↔name cross-check. Null = no/ambiguous match.
 */
function resolveSchoolByName(
  name: string,
  fips: string,
  ctx: ResolutionContext,
): { district: ResolvedDistrict; school: ResolvedSchool } | null {
  const schools = ctx.schoolsByStateFips.get(fips) ?? [];
  const sm = matchByName(
    name,
    schools.map((s) => ({ ...s, name: s.schoolName })),
    { fuzzy: false, normalize: normalizeSchoolName },
  );
  if (sm.kind !== "match") return null;
  // The school's FK guarantees its district exists — never a stub.
  const district =
    ctx.districtsByLeaid.get(sm.candidate.leaid) ??
    (ctx.districtsByStateFips.get(fips) ?? []).find((d) => d.leaid === sm.candidate.leaid);
  return {
    district: { leaid: sm.candidate.leaid, name: district?.name ?? null, willCreate: false },
    school: { ncessch: sm.candidate.ncessch, name: sm.candidate.schoolName },
  };
}

/**
 * School-by-name WITHIN one (email-domain-implied) district. Unlike the
 * statewide matcher, the fuzzy tier (unique ≥ 0.85) is ON — the candidate
 * pool is one district's schools, so a unique high Dice score is safe.
 */
function resolveSchoolInDistrict(
  name: string,
  leaid: string,
  ctx: ResolutionContext,
): { district: ResolvedDistrict; school: ResolvedSchool } | null {
  const schools = ctx.schoolsByLeaid.get(leaid) ?? [];
  const sm = matchByName(
    name,
    schools.map((s) => ({ ...s, name: s.schoolName })),
    { normalize: normalizeSchoolName },
  );
  if (sm.kind !== "match") return null;
  const district = ctx.districtsByLeaid.get(leaid);
  return {
    district: { leaid, name: district?.name ?? null, willCreate: false },
    school: { ncessch: sm.candidate.ncessch, name: sm.candidate.schoolName },
  };
}

/** The dominant district for the row's email domain, or null. */
function domainImpliedLeaid(email: string, ctx: ResolutionContext): string | null {
  const domain = emailDomain(email);
  return (domain && ctx.districtByEmailDomain.get(domain)) || null;
}

/**
 * Email-domain inference for rows with no usable NCES id. The domain alone is
 * NEVER trusted — a dominant domain with an unrelated row name is most often
 * a vendor, a co-op address, or stale contact data. The row's name must
 * corroborate the implied district by matching one of its schools (tiered,
 * incl. unique fuzzy — tiny pool) or the district itself (≥ matchByName's
 * 0.85 auto-pick bar, since this DRIVES an assignment rather than validating
 * one). No corroboration → null, and the caller keeps today's statewide path.
 */
function resolveByEmailDomain(
  row: LeadImportRow | ActivityImportRow,
  email: string,
  ctx: ResolutionContext,
): { district: ResolvedDistrict; school: ResolvedSchool | null } | null {
  const name = row.districtName?.trim();
  if (!name) return null;
  const leaid = domainImpliedLeaid(email, ctx);
  if (!leaid) return null;
  const bySchool = resolveSchoolInDistrict(name, leaid, ctx);
  if (bySchool) return bySchool;
  const district = ctx.districtsByLeaid.get(leaid);
  if (district && orgNameSimilarity(name, district.name) >= 0.85) {
    return {
      district: { leaid, name: district.name, willCreate: false },
      school: null,
    };
  }
  return null;
}

/**
 * Name + state fallback for rows with no usable NCES resolution. District
 * names match against the state's districts (tiered, incl. fuzzy); names
 * that look like a school also try an exact/normalized school match → the
 * school's district. Multiple district hits = "ambiguous" (never guess);
 * multiple school hits = skipped.
 */
function resolveDistrictByName(
  row: LeadImportRow | ActivityImportRow,
  ctx: ResolutionContext,
): { district: ResolvedDistrict; school: ResolvedSchool | null } | "ambiguous" | null {
  const name = row.districtName?.trim();
  if (!name) return null;
  const fips = rowStateFips(row);
  if (!fips) return null;

  const districts = ctx.districtsByStateFips.get(fips) ?? [];
  const dm = matchByName(name, districts);
  if (dm.kind === "ambiguous") return "ambiguous";
  if (dm.kind === "match") {
    return {
      district: { leaid: dm.candidate.leaid, name: dm.candidate.name, willCreate: false },
      school: null,
    };
  }

  if (!looksLikeSchoolName(name)) return null;
  return resolveSchoolByName(name, fips, ctx);
}

/**
 * Prototype `resolveRow` semantics, ported + hardened for marketing exports:
 *  - email matches the contact (no unique constraint → most recent wins,
 *    with a duplicate warning);
 *  - an existing contact keeps its school + district;
 *  - a new contact with a school NCES (explicit column, or an 8–12 digit
 *    value in the mixed "NCES ID" column) resolves the DISTRICT from the
 *    school's leaid (viaNces) — schools and districts are separate records;
 *  - a ≤7-digit value in the mixed column is the district leaid, creating a
 *    district stub if missing (the way the schools ETL does) — stubs are
 *    ONLY ever planned for a valid 7-digit numeric leaid;
 *  - rows with no usable id first try the email-domain inference (dominant
 *    domain + corroborating name → viaName + `domain_inferred_district`),
 *    then fall back to a name + state district match (viaName); ambiguous
 *    matches fail with `ambiguous_district`;
 *  - an unresolvable school degrades gracefully (warning, falls through).
 */
function resolveRecords(
  row: LeadImportRow | ActivityImportRow,
  ctx: ResolutionContext,
): RecordResolution {
  const warnings: string[] = [];
  const fail = (
    error: string,
    school: ResolvedSchool | null = null,
  ): RecordResolution => ({
    error,
    warnings,
    existingContact: null,
    contact: null,
    school,
    district: null,
    viaNces: false,
    viaName: false,
  });

  const email = normalizeEmail(row.email);
  if (!email) return fail("invalid_email");

  const matches = ctx.contactsByEmail.get(email) ?? [];
  if (matches.length > 1) warnings.push("duplicate_email");
  const existingContact = pickMostRecentContact(matches);

  let school: ResolvedSchool | null = null;
  let district: ResolvedDistrict | null = null;
  let viaNces = false;
  let viaName = false;

  if (existingContact) {
    // Existing contacts keep their school + district.
    const d = ctx.districtsByLeaid.get(existingContact.leaid);
    district = {
      leaid: existingContact.leaid,
      name: d?.name ?? null,
      willCreate: false,
    };
    if (existingContact.schoolNcessch) {
      const s = ctx.schoolsByNcessch.get(existingContact.schoolNcessch);
      school = { ncessch: existingContact.schoolNcessch, name: s?.schoolName ?? null };
    }
  } else {
    const nces = ncesInputs(row);
    if (nces.invalidSchoolInput) warnings.push("invalid_school_nces");
    if (nces.invalidLeaidInput) warnings.push("invalid_nces_id");

    if (nces.schoolNcessch) {
      const s = ctx.schoolsByNcessch.get(nces.schoolNcessch);
      if (s) {
        // District resolved FROM the school's NCES id. The school row's FK
        // guarantees its district exists.
        viaNces = true;
        school = { ncessch: s.ncessch, name: s.schoolName };
        const d = ctx.districtsByLeaid.get(s.leaid);
        district = { leaid: s.leaid, name: d?.name ?? null, willCreate: !d };

        // Cross-check: marketing "NCES ID" columns are wrong ~30% of the
        // time while the school NAMES are reliable. When the row's name is
        // school-ish and disagrees with the id's school, trust the name: an
        // unambiguous school-by-name match overrides the id (viaName +
        // nces_name_conflict); otherwise keep the id but flag the row for a
        // human (nces_name_mismatch). The email-domain-implied district is
        // searched FIRST — its tiny pool disambiguates names that are
        // ambiguous statewide (and works even when the row has no state).
        const rowOrgName = row.districtName?.trim();
        if (
          rowOrgName &&
          looksLikeSchoolName(rowOrgName) &&
          ncesNameConflicts(rowOrgName, s.schoolName)
        ) {
          const impliedLeaid = domainImpliedLeaid(email, ctx);
          const fips = rowStateFips(row);
          const byName =
            (impliedLeaid ? resolveSchoolInDistrict(rowOrgName, impliedLeaid, ctx) : null) ??
            (fips ? resolveSchoolByName(rowOrgName, fips, ctx) : null);
          if (byName) {
            viaNces = false;
            viaName = true;
            school = byName.school;
            district = byName.district;
            warnings.push("nces_name_conflict");
          } else {
            warnings.push("nces_name_mismatch");
          }
        }
      } else {
        // Degrade gracefully — keep the row, drop the school link.
        warnings.push("school_not_found");
      }
    }
    if (!district && nces.leaid) {
      // nces.leaid is guaranteed 7-digit numeric — the only shape allowed
      // to plan a district stub.
      const d = ctx.districtsByLeaid.get(nces.leaid);
      district = d
        ? { leaid: nces.leaid, name: d.name, willCreate: false }
        : { leaid: nces.leaid, name: row.districtName?.trim() || null, willCreate: true };
    }
    if (!district) {
      // Email-domain inference runs BEFORE the statewide name match: a
      // dominant domain + corroborating name pins the district even when the
      // name is ambiguous statewide (or the row has no usable state).
      const byDomain = resolveByEmailDomain(row, email, ctx);
      if (byDomain) {
        viaName = true;
        district = byDomain.district;
        if (!school && byDomain.school) school = byDomain.school;
        warnings.push("domain_inferred_district");
      }
    }
    if (!district) {
      const byName = resolveDistrictByName(row, ctx);
      if (byName === "ambiguous") return fail("ambiguous_district", school);
      if (byName) {
        viaName = true;
        district = byName.district;
        if (!school && byName.school) school = byName.school;
      }
    }
    if (!district) return fail("unresolved_district", school);
  }

  const first = "first" in row ? row.first : undefined;
  const last = "last" in row ? row.last : undefined;
  const rowName =
    ("name" in row ? row.name?.trim() : undefined) ||
    [first?.trim(), last?.trim()].filter(Boolean).join(" ") ||
    null;
  const contact: ResolvedContact = existingContact
    ? { id: existingContact.id, name: existingContact.name, email, willCreate: false }
    : { id: null, name: rowName ?? nameFromEmail(email), email, willCreate: true };

  return { error: null, warnings, existingContact, contact, school, district, viaNces, viaName };
}

// ---- Activity dataset --------------------------------------------------------------

export async function resolveActivityRows(
  rows: ActivityImportRow[],
  db: DbClient = prisma,
): Promise<ActivityRowResolution[]> {
  const ctx = await buildContext(rows, db);
  return rows.map((row, index) => {
    const base = resolveRecords(row, ctx);
    const pointsRaw = Number(row.points ?? 0);
    const points = Number.isInteger(pointsRaw) ? pointsRaw : 0;
    const leadId =
      base.existingContact != null
        ? ctx.activeLeadByContactId.get(base.existingContact.id) ?? null
        : null;
    return {
      index,
      ok: base.error === null,
      error: base.error,
      warnings: base.warnings,
      contact: base.contact,
      school: base.school,
      district: base.district,
      viaNces: base.viaNces,
      viaName: base.viaName,
      leadId,
      points,
    };
  });
}

export function summarizeActivityResolutions(resolutions: ActivityRowResolution[]) {
  const ok = resolutions.filter((r) => r.ok);
  return {
    total: resolutions.length,
    toActiveLeads: ok.filter((r) => r.leadId !== null).length,
    retained: ok.filter((r) => r.leadId === null).length,
    failed: resolutions.length - ok.length,
  };
}

export interface ImportFailure {
  index: number;
  reason: string;
}

/**
 * Surfaced for unexpected per-row write errors instead of the raw error
 * message (Prisma internals are not for end users); the real error is logged
 * server-side. Structured resolver codes (invalid_email, …) pass through.
 */
export const GENERIC_ROW_FAILURE = "Could not import this row";
export interface ImportWarning {
  index: number;
  warning: string;
}

function collectWarnings(resolutions: RowResolutionBase[]): ImportWarning[] {
  return resolutions.flatMap((r) => r.warnings.map((warning) => ({ index: r.index, warning })));
}

/** Create the district stub the way the schools ETL does (leaid[:2] = state fips). */
async function ensureDistrictStub(
  district: ResolvedDistrict,
  createdLeaids: Set<string>,
  db: DbClient,
) {
  if (!district.willCreate || createdLeaids.has(district.leaid)) return;
  // Hard guard: a stub may only ever be minted with a normalized 7-digit
  // numeric leaid. Resolution never plans anything else — this backstop
  // fails the row instead of writing a junk district record.
  if (!/^\d{7}$/.test(district.leaid)) {
    throw new Error(
      `Refusing to create a district stub for non-7-digit leaid "${district.leaid}"`,
    );
  }
  await db.district.create({
    data: {
      leaid: district.leaid,
      name: district.name ?? `District ${district.leaid}`,
      stateFips: district.leaid.slice(0, 2),
    },
  });
  createdLeaids.add(district.leaid);
}

async function ensureContact(
  resolution: RowResolutionBase,
  row: { title?: string; phone?: string },
  createdContactsByEmail: Map<string, number>,
  db: DbClient,
): Promise<number> {
  const contact = resolution.contact!;
  if (contact.id != null) return contact.id;
  const emailKey = contact.email!;
  const cached = createdContactsByEmail.get(emailKey);
  if (cached != null) return cached;
  const created = await db.contact.create({
    data: {
      leaid: resolution.district!.leaid,
      name: contact.name!,
      email: contact.email,
      title: row.title?.trim() || null,
      phone: row.phone?.trim() || null,
      schoolNcessch: resolution.school?.ncessch ?? null,
    },
    select: { id: true },
  });
  createdContactsByEmail.set(emailKey, created.id);
  return created.id;
}

export async function applyActivityImport(
  rows: ActivityImportRow[],
  resolutions: ActivityRowResolution[],
  userId: string,
  db: DbClient = prisma,
) {
  const succeeded: number[] = [];
  const failed: ImportFailure[] = [];
  let toActiveLeads = 0;
  let retained = 0;
  const createdLeaids = new Set<string>();
  const createdContactsByEmail = new Map<string, number>();

  for (const resolution of resolutions) {
    if (!resolution.ok) {
      failed.push({ index: resolution.index, reason: resolution.error! });
      continue;
    }
    const row = rows[resolution.index];
    try {
      await ensureDistrictStub(resolution.district!, createdLeaids, db);
      const contactId = await ensureContact(resolution, {}, createdContactsByEmail, db);

      const type = activityTypeForRow(row);
      const occurredAt =
        row.occurredAt && !Number.isNaN(new Date(row.occurredAt).getTime())
          ? new Date(row.occurredAt)
          : new Date();
      await db.activity.create({
        data: {
          type,
          title: row.title?.trim() || row.text?.trim() || "Imported engagement",
          notes: row.notes?.trim() || null,
          startDate: occurredAt,
          status: "completed",
          createdByUserId: userId,
          // Mirror logEngagement: record the points the row carried so the
          // timeline can render "+N pts" (lead score remains the total).
          ...(resolution.points !== 0
            ? { metadata: { leadPoints: resolution.points } }
            : {}),
          contacts: { create: [{ contactId }] },
          districts: { create: [{ districtLeaid: resolution.district!.leaid }] },
          ...(resolution.school
            ? { schools: { create: [{ ncessch: resolution.school.ncessch }] } }
            : {}),
        },
      });

      if (resolution.leadId) {
        if (resolution.points !== 0) {
          await db.lead.update({
            where: { id: resolution.leadId },
            data: { score: { increment: resolution.points } },
          });
        }
        toActiveLeads += 1;
      } else {
        retained += 1;
      }
      succeeded.push(resolution.index);
    } catch (error) {
      console.error(`Activity import: row ${resolution.index} failed:`, error);
      failed.push({ index: resolution.index, reason: GENERIC_ROW_FAILURE });
    }
  }

  return {
    succeeded,
    failed,
    warnings: collectWarnings(resolutions.filter((r) => r.ok)),
    summary: { imported: succeeded.length, toActiveLeads, retained },
  };
}

// ---- Leads dataset ----------------------------------------------------------------

export async function resolveLeadRows(
  rows: LeadImportRow[],
  userId: string,
  db: DbClient = prisma,
): Promise<LeadRowResolution[]> {
  const ctx = await buildContext(rows, db);
  const seenEmails = new Set<string>();
  return rows.map((row, index) => {
    const base = resolveRecords(row, ctx);
    const warnings = [...base.warnings];
    let error = base.error;

    const email = normalizeEmail(row.email);
    if (!error && email) {
      if (seenEmails.has(email)) {
        error = "duplicate_in_batch";
      }
      seenEmails.add(email);
    }
    if (!error && base.existingContact) {
      const activeLead = ctx.activeLeadByContactId.get(base.existingContact.id);
      if (activeLead) error = "contact_has_active_lead";
    }

    let leadType: string | null = row.leadType?.trim() || null;
    if (leadType && !(LEAD_TYPES as readonly string[]).includes(leadType)) {
      warnings.push("invalid_lead_type");
      leadType = null;
    }

    let assignedBdrId: string | null = userId;
    if (row.assignedBdrId) {
      if (ctx.validUserIds.has(row.assignedBdrId)) {
        assignedBdrId = row.assignedBdrId;
      } else {
        warnings.push("invalid_bdr");
      }
    }

    return {
      index,
      ok: error === null,
      error,
      warnings,
      contact: base.contact,
      school: base.school,
      district: base.district,
      viaNces: base.viaNces,
      viaName: base.viaName,
      assignedBdrId,
      leadType,
    };
  });
}

export function summarizeLeadResolutions(resolutions: LeadRowResolution[]) {
  const ok = resolutions.filter((r) => r.ok);
  return {
    total: resolutions.length,
    toCreate: ok.length,
    newContacts: ok.filter((r) => r.contact?.willCreate).length,
    newDistricts: ok.filter((r) => r.district?.willCreate).length,
    failed: resolutions.length - ok.length,
  };
}

export async function applyLeadImport(
  rows: LeadImportRow[],
  resolutions: LeadRowResolution[],
  userId: string,
  db: DbClient = prisma,
) {
  const succeeded: number[] = [];
  const failed: ImportFailure[] = [];
  const createdLeaids = new Set<string>();
  const createdContactsByEmail = new Map<string, number>();

  for (const resolution of resolutions) {
    if (!resolution.ok) {
      failed.push({ index: resolution.index, reason: resolution.error! });
      continue;
    }
    const row = rows[resolution.index];
    try {
      await ensureDistrictStub(resolution.district!, createdLeaids, db);
      const contactId = await ensureContact(
        resolution,
        { title: row.title, phone: row.phone },
        createdContactsByEmail,
        db,
      );

      const scoreRaw = Number(row.score ?? 0);
      const lead = await db.lead.create({
        data: {
          contactId,
          schoolNcessch: resolution.school?.ncessch ?? null,
          leaid: resolution.district!.leaid,
          leadType: resolution.leadType,
          sequence: row.sequence?.trim() || null,
          marketingOwner: row.marketingOwner?.trim() || null,
          assignedBdrId: resolution.assignedBdrId,
          score: Number.isInteger(scoreRaw) && scoreRaw >= 0 ? scoreRaw : 0,
        },
        select: { id: true },
      });
      await db.leadEvent.create({
        data: {
          leadId: lead.id,
          kind: "created",
          actorId: userId,
          payload: { assignedBdrId: resolution.assignedBdrId, source: "import" },
        },
      });
      succeeded.push(resolution.index);
    } catch (error) {
      console.error(`Lead import: row ${resolution.index} failed:`, error);
      failed.push({ index: resolution.index, reason: GENERIC_ROW_FAILURE });
    }
  }

  return {
    succeeded,
    failed,
    warnings: collectWarnings(resolutions.filter((r) => r.ok)),
    summary: { imported: succeeded.length },
  };
}
