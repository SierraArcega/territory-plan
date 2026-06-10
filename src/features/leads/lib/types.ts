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

// ---- Timeline (mirror lib/server/timeline-items.ts) -------------------------

export type TimelineAttribution = "own_contact" | "other_contact" | "district_wide";

export interface LifecycleTimelineItem {
  itemType: "lifecycle";
  id: string;
  kind: string;
  payload: Record<string, unknown> | null;
  actorId: string | null;
  ts: string;
}

export interface EngagementTimelineItem {
  itemType: "engagement";
  id: string;
  type: string;
  title: string;
  notes: string | null;
  outcome: string | null;
  outcomeType: string | null;
  source: string;
  createdByUserId: string | null;
  attribution: TimelineAttribution;
  /** Chip label override (contact name, "School-wide", …). */
  attributionName: string | null;
  ts: string;
}

export type LeadTimelineItem = LifecycleTimelineItem | EngagementTimelineItem;

export interface LeadTimelineResponse {
  items: LeadTimelineItem[];
}

// ---- Record panels (mirror /api/leads/records/* responses) -----------------

export interface RecordLeadSummary {
  id: string;
  status: LeadStatus;
  score: number;
  leadType: string | null;
  unqualifiedReason?: string | null;
  contactName?: string | null;
}

export interface RecordContactSummary {
  id: number;
  name: string;
  title: string | null;
  schoolName?: string | null;
  leadStatus: LeadStatus | null;
  activityCount: number;
}

export interface RecordSchoolSummary {
  ncessch: string;
  name: string;
  level: string | null;
  contactCount: number;
  activityCount: number;
}

export interface ContactRecordResponse {
  contact: LeadContact;
  school: LeadSchool | null;
  district: LeadDistrict | null;
  lead: RecordLeadSummary | null;
  stats: { activities: number; points: number };
  items: EngagementTimelineItem[];
}

export interface SchoolRecordResponse {
  school: { ncessch: string; name: string; level: string | null };
  district: LeadDistrict | null;
  stats: { contacts: number; activities: number; points: number };
  contacts: RecordContactSummary[];
  items: EngagementTimelineItem[];
}

export interface DistrictRecordResponse {
  district: LeadDistrict;
  stats: { schools: number; contacts: number; leads: number; points: number };
  schools: RecordSchoolSummary[];
  contacts: RecordContactSummary[];
  leads: RecordLeadSummary[];
  items: EngagementTimelineItem[];
}

// ---- Record-panel navigation stack ------------------------------------------

export type RecordRef =
  | { type: "contact"; id: number; label: string }
  | { type: "school"; id: string; label: string }
  | { type: "district"; id: string; label: string };
