// Client side of the bulk upload: CSV header auto-mapping, parsed-row →
// import-row conversion, template CSVs, and the response shapes mirrored from
// lib/server/lead-import.ts (keep in sync).

import { rowsToCsv, type ParsedCsv } from "@/features/shared/lib/csv";

export const MAX_IMPORT_ROWS = 500;

// ---- Server response mirrors (lib/server/lead-import.ts) --------------------

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
}

export interface ActivityRowResolution extends RowResolutionBase {
  /** Active lead that receives the row's points; null = retained on records. */
  leadId: string | null;
  points: number;
}

export interface LeadRowResolution extends RowResolutionBase {
  assignedBdrId: string | null;
  leadType: string | null;
}

export interface ActivityImportPlan {
  dryRun: true;
  rows: ActivityRowResolution[];
  summary: { total: number; toActiveLeads: number; retained: number; failed: number };
}

export interface LeadImportPlan {
  dryRun: true;
  rows: LeadRowResolution[];
  summary: {
    total: number;
    toCreate: number;
    newContacts: number;
    newDistricts: number;
    failed: number;
  };
}

export interface ImportResult {
  succeeded: number[];
  failed: Array<{ index: number; reason: string }>;
  warnings: Array<{ index: number; warning: string }>;
  summary: { imported: number; toActiveLeads?: number; retained?: number };
}

// ---- Import row inputs (mirror the server's row shapes) ----------------------

export interface LeadImportRowInput {
  email?: string;
  name?: string;
  first?: string;
  last?: string;
  title?: string;
  phone?: string;
  leaid?: string;
  districtName?: string;
  schoolNcessch?: string;
  leadType?: string;
  sequence?: string;
  marketingOwner?: string;
  assignedBdrId?: string;
  score?: number;
}

export interface ActivityImportRowInput {
  email?: string;
  kind?: string;
  title?: string;
  notes?: string;
  occurredAt?: string;
  points?: number;
  leaid?: string;
  districtName?: string;
  schoolNcessch?: string;
  first?: string;
  last?: string;
}

// ---- Header auto-mapping ------------------------------------------------------

export interface FieldDef {
  /** Import-row key the column feeds. */
  key: string;
  /** Display + template header. */
  label: string;
  /** Accepted header spellings (normalized). */
  aliases: string[];
  required?: boolean;
}

export const LEAD_FIELD_DEFS: FieldDef[] = [
  { key: "email", label: "Email", aliases: ["email", "lead email", "email address"], required: true },
  { key: "first", label: "First Name", aliases: ["first name", "first"] },
  { key: "last", label: "Last Name", aliases: ["last name", "last"] },
  { key: "name", label: "Full Name", aliases: ["full name", "name", "contact name"] },
  { key: "title", label: "Title", aliases: ["title", "job title"] },
  { key: "phone", label: "Phone", aliases: ["phone", "phone number"] },
  {
    key: "leaid",
    label: "District NCES ID",
    aliases: ["district nces id", "district nces", "nces id", "leaid", "nces"],
  },
  {
    key: "districtName",
    label: "District Name",
    aliases: ["district name", "district", "school district", "organization", "org"],
  },
  {
    key: "schoolNcessch",
    label: "School NCES",
    aliases: ["school nces", "school nces id", "school ncessch"],
  },
  { key: "leadType", label: "Lead Type", aliases: ["lead type", "type"] },
  { key: "sequence", label: "Sequence", aliases: ["sequence", "outreach sequence"] },
  { key: "marketingOwner", label: "Marketing Owner", aliases: ["marketing owner"] },
  { key: "score", label: "Engagement Score", aliases: ["engagement score", "score", "points"] },
];

export const ACTIVITY_FIELD_DEFS: FieldDef[] = [
  { key: "email", label: "Lead Email", aliases: ["lead email", "email", "email address"], required: true },
  { key: "first", label: "First Name", aliases: ["first name", "first"] },
  { key: "last", label: "Last Name", aliases: ["last name", "last"] },
  { key: "kind", label: "Activity Type", aliases: ["activity type", "kind", "type"], required: true },
  {
    key: "title",
    label: "Subject / Detail",
    aliases: ["subject detail", "subject", "detail", "text", "title"],
  },
  { key: "notes", label: "Notes", aliases: ["notes"] },
  { key: "occurredAt", label: "Date", aliases: ["date", "occurred at"], required: true },
  { key: "points", label: "Points", aliases: ["points", "pts"] },
  {
    key: "schoolNcessch",
    label: "School NCES",
    aliases: ["school nces", "school nces id", "school ncessch"],
  },
  {
    key: "leaid",
    label: "District NCES ID",
    aliases: ["district nces id", "district nces", "nces id", "leaid", "nces"],
  },
  {
    key: "districtName",
    label: "School / District",
    aliases: ["school district", "district name", "district", "organization", "org"],
  },
];

/** Lowercase, collapse every non-alphanumeric run to one space. */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface HeaderMapping {
  /** field key → CSV header it maps from. */
  byField: Record<string, string>;
  /** [csv header, field label] pairs in field order (the mapping list UI). */
  mapped: Array<{ header: string; field: FieldDef }>;
  /** Headers no field claims (ignored on import). */
  unmapped: string[];
  /** Required field labels with no matching header. */
  missingRequired: string[];
}

/** Auto-map CSV headers onto import fields by normalized alias matching. */
export function buildHeaderMapping(headers: string[], defs: FieldDef[]): HeaderMapping {
  const byField: Record<string, string> = {};
  const claimed = new Set<string>();
  for (const def of defs) {
    // Aliases are listed best-first — an exact label beats a loose synonym
    // (e.g. "Lead Type" claims leadType even when a "Type" column exists).
    let match: string | undefined;
    for (const alias of def.aliases) {
      match = headers.find((h) => !claimed.has(h) && normalizeHeader(h) === alias);
      if (match) break;
    }
    if (match) {
      byField[def.key] = match;
      claimed.add(match);
    }
  }
  return {
    byField,
    mapped: defs
      .filter((d) => byField[d.key] !== undefined)
      .map((d) => ({ header: byField[d.key], field: d })),
    unmapped: headers.filter((h) => !claimed.has(h)),
    missingRequired: defs
      .filter((d) => d.required && byField[d.key] === undefined)
      .map((d) => d.label),
  };
}

// ---- Parsed CSV → import rows ---------------------------------------------------

const cell = (
  row: Record<string, string>,
  mapping: HeaderMapping,
  key: string,
): string | undefined => {
  const header = mapping.byField[key];
  const value = header !== undefined ? row[header] : undefined;
  return value || undefined;
};

export function toLeadImportRows(
  parsed: ParsedCsv,
  mapping: HeaderMapping,
  assignedBdrId: string | undefined,
): LeadImportRowInput[] {
  return parsed.rows.map((r) => {
    const scoreCell = cell(r, mapping, "score");
    const scoreRaw = scoreCell !== undefined ? Number(scoreCell) : NaN;
    return {
      email: cell(r, mapping, "email"),
      name: cell(r, mapping, "name"),
      first: cell(r, mapping, "first"),
      last: cell(r, mapping, "last"),
      title: cell(r, mapping, "title"),
      phone: cell(r, mapping, "phone"),
      leaid: cell(r, mapping, "leaid"),
      districtName: cell(r, mapping, "districtName"),
      schoolNcessch: cell(r, mapping, "schoolNcessch"),
      leadType: cell(r, mapping, "leadType")?.toLowerCase(),
      // Rows enroll in the General BDR sequence unless the file says otherwise.
      sequence: cell(r, mapping, "sequence") ?? "General BDR Sequence",
      marketingOwner: cell(r, mapping, "marketingOwner"),
      assignedBdrId,
      score: Number.isFinite(scoreRaw) && scoreRaw >= 0 ? Math.round(scoreRaw) : undefined,
    };
  });
}

export function toActivityImportRows(
  parsed: ParsedCsv,
  mapping: HeaderMapping,
): ActivityImportRowInput[] {
  return parsed.rows.map((r) => {
    const pointsCell = cell(r, mapping, "points");
    const pointsRaw = pointsCell !== undefined ? Number(pointsCell) : NaN;
    return {
      email: cell(r, mapping, "email"),
      kind: cell(r, mapping, "kind")?.toLowerCase(),
      title: cell(r, mapping, "title"),
      notes: cell(r, mapping, "notes"),
      occurredAt: cell(r, mapping, "occurredAt"),
      points: Number.isFinite(pointsRaw) ? Math.round(pointsRaw) : undefined,
      leaid: cell(r, mapping, "leaid"),
      districtName: cell(r, mapping, "districtName"),
      schoolNcessch: cell(r, mapping, "schoolNcessch"),
      first: cell(r, mapping, "first"),
      last: cell(r, mapping, "last"),
    };
  });
}

// ---- Templates ---------------------------------------------------------------------

export function leadTemplateCsv(): string {
  return rowsToCsv(
    LEAD_FIELD_DEFS.map((d) => d.label),
    [
      {
        Email: "kwhitfield@mvusd51.org",
        "First Name": "Karen",
        "Last Name": "Whitfield",
        "Full Name": "",
        Title: "Director of Special Education",
        Phone: "(970) 555-0142",
        "District NCES ID": "0802940",
        "District Name": "Mesa Valley USD 51",
        "School NCES": "",
        "Lead Type": "mql",
        Sequence: "Superintendent — Special Ed",
        "Marketing Owner": "Jules Okafor",
        "Engagement Score": "138",
      },
    ],
  );
}

export function activityTemplateCsv(): string {
  return rowsToCsv(
    ACTIVITY_FIELD_DEFS.map((d) => d.label),
    [
      {
        "Lead Email": "kwhitfield@mvusd51.org",
        "First Name": "Karen",
        "Last Name": "Whitfield",
        "Activity Type": "webinar",
        "Subject / Detail": "Attended “IEP staffing in 2026” webinar",
        Notes: "",
        Date: "2026-05-29",
        Points: "40",
        "School NCES": "",
        "District NCES ID": "0802940",
        "School / District": "Mesa Valley USD 51",
      },
    ],
  );
}

// ---- Error copy ---------------------------------------------------------------------

/** Human copy for resolver/import failure codes shown in the preview rows. */
export const IMPORT_ERROR_COPY: Record<string, string> = {
  invalid_email: "Missing or invalid email",
  unresolved_district: "No district — add a District NCES ID or School NCES",
  duplicate_in_batch: "Duplicate email in this file",
  contact_has_active_lead: "Contact already has an active lead",
};

export function importErrorCopy(code: string): string {
  return IMPORT_ERROR_COPY[code] ?? code;
}
