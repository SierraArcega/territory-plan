// Client-side lead types — mirror serializeLead() in lib/server/lead-service.ts
// (the JSON shape shared by every lead-returning route). Keep in sync.

export const LEAD_STATUSES = [
  "new",
  "working",
  "meeting_scheduled",
  "sales_qualified",
  "unqualified",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type LeadTypeKey = "mql" | "inbound" | "conference" | "other";

export interface LeadContact {
  id: number;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
}

export interface LeadSchool {
  ncessch: string;
  name: string | null;
}

export interface LeadDistrict {
  leaid: string;
  name: string;
  city: string | null;
  stateAbbrev: string | null;
}

export interface LeadBdr {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface LeadOpportunity {
  id: string;
  name: string | null;
  stage: string | null;
  amount: number | null;
  closeDate: string | null;
}

export interface Lead {
  id: string;
  status: LeadStatus;
  score: number;
  leadType: string | null;
  sequence: string | null;
  marketingOwner: string | null;
  unqualifiedReason: string | null;
  meetingAt: string | null;
  assignedAt: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contact: LeadContact | null;
  school: LeadSchool | null;
  district: LeadDistrict | null;
  assignedBdr: LeadBdr | null;
  opportunity: LeadOpportunity | null;
}

export interface LeadsResponse {
  leads: Lead[];
  total: number;
}
