// src/features/document-generation/lib/prefill.ts
import type { DocType } from "./payload-types";

export interface OpportunityPrefill {
  districtLeaId: string | null;
  districtName: string | null;
  startDate: string | null;
  contractThrough: string | null;
  paymentTerms: string | null;
  minimumPurchaseAmount: number | null;
  maximumBudget: number | null;
  netBookingAmount: number | null;
}
export interface ProfilePrefill {
  fullName: string | null;
  email: string | null;
  jobTitle: string | null;
}

export interface DistrictAddressPrefill {
  streetLocation: string | null;
  cityLocation: string | null;
  stateAbbrev: string | null;
  zipLocation: string | null;
}

export interface PrefillResult {
  docType: DocType;
  districtLeaId: string;
  companyName: string;
  billingAddress: string;
  startDate: string;
  endDate: string;
  payTerms: string;
  minAmt: number | null;
  maxAmt: number | null;
  bookingReference: number | null;
  sender: { first: string; last: string; title: string; email: string };
}

function splitName(full: string | null): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/** Compose a one-line billing address from a district's location fields (skipping blanks). */
export function formatDistrictAddress(d: DistrictAddressPrefill): string {
  const cityStateZip = [d.cityLocation, [d.stateAbbrev, d.zipLocation].filter(Boolean).join(" ").trim()]
    .filter(Boolean)
    .join(", ");
  return [d.streetLocation, cityStateZip].filter(Boolean).join(", ").trim();
}

export function buildPrefill(
  opts: { doc_type: DocType },
  opp: OpportunityPrefill,
  profile: ProfilePrefill,
  district?: DistrictAddressPrefill,
): PrefillResult {
  const name = splitName(profile.fullName);
  return {
    docType: opts.doc_type,
    districtLeaId: opp.districtLeaId ?? "",
    companyName: opp.districtName ?? "",
    billingAddress: district ? formatDistrictAddress(district) : "",
    startDate: opp.startDate ?? "",
    endDate: opp.contractThrough ?? "",
    payTerms: opp.paymentTerms ?? "",
    minAmt: opp.minimumPurchaseAmount,
    maxAmt: opp.maximumBudget,
    bookingReference: opp.netBookingAmount,
    sender: { first: name.first, last: name.last, title: profile.jobTitle ?? "", email: profile.email ?? "" },
  };
}
