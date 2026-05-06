import Decimal from "decimal.js";
import { abbrevToFips } from "@/lib/states";
import type { HigherGovOpportunity } from "./types";

/** The shape passed to `prisma.rfp.upsert({ create })` (minus leaid, which sync.ts attaches). */
export interface NormalizedRfp {
  externalId: string;
  versionKey: string;
  title: string;
  solicitationNumber: string | null;
  oppType: string | null;
  description: string | null;
  aiSummary: string | null;

  agencyKey: number;
  agencyName: string;
  agencyPath: string | null;

  stateAbbrev: string | null;
  stateFips: string | null;
  popCity: string | null;
  popZip: string | null;

  naicsCode: string | null;
  pscCode: string | null;
  setAside: string | null;

  valueLow: Decimal | null;
  valueHigh: Decimal | null;

  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;

  postedDate: Date | null;
  dueDate: Date | null;
  capturedDate: Date;

  highergovUrl: string | null;
  sourceUrl: string | null;

  higherGovSourceType: string | null;

  rawPayload: HigherGovOpportunity;
}

function emptyToNull(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  return s.length === 0 ? null : s;
}

function parseDecimal(s: string | null | undefined): Decimal | null {
  if (!s) return null;
  try {
    return new Decimal(s);
  } catch {
    return null;
  }
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  // HigherGov returns "YYYY-MM-DD" — interpret as UTC midnight.
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeOpportunity(raw: HigherGovOpportunity): NormalizedRfp {
  const stateAbbrev = emptyToNull(raw.pop_state);
  const stateFips = stateAbbrev ? abbrevToFips(stateAbbrev) : null;

  const captured = parseDate(raw.captured_date);
  if (!captured) throw new Error(`Invalid captured_date "${raw.captured_date}" for opp_key=${raw.opp_key}`);

  return {
    externalId: raw.opp_key,
    versionKey: raw.version_key,
    title: raw.title,
    solicitationNumber: emptyToNull(raw.source_id),
    oppType: raw.opp_type?.description ?? null,
    description: emptyToNull(raw.description_text),
    aiSummary: emptyToNull(raw.ai_summary),

    agencyKey: raw.agency.agency_key,
    agencyName: raw.agency.agency_name,
    agencyPath: emptyToNull(raw.agency.path),

    stateAbbrev,
    stateFips,
    popCity: emptyToNull(raw.pop_city),
    popZip: emptyToNull(raw.pop_zip),

    naicsCode: raw.naics_code?.naics_code ?? null,
    pscCode: raw.psc_code?.psc_code ?? null,
    setAside: emptyToNull(raw.set_aside),

    valueLow: parseDecimal(raw.val_est_low),
    valueHigh: parseDecimal(raw.val_est_high),

    primaryContactName: raw.primary_contact_email?.contact_name ?? null,
    primaryContactEmail: raw.primary_contact_email?.contact_email ?? null,
    primaryContactPhone: raw.primary_contact_email?.contact_phone ?? null,

    postedDate: parseDate(raw.posted_date),
    dueDate: parseDate(raw.due_date),
    capturedDate: captured,

    highergovUrl: emptyToNull(raw.path),
    sourceUrl: emptyToNull(raw.source_path),

    higherGovSourceType: emptyToNull(raw.source_type),

    rawPayload: raw,
  };
}
