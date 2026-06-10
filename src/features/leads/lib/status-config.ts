// Stage / type / opportunity-stage configuration for the Leads surface.
// Colors and definition copy are verbatim from the design handoff
// (Docs/design_handoff_leads/design_files/leadsData.js). The prototype's
// stage keys `meeting` / `converted` map to the server statuses
// `meeting_scheduled` / `sales_qualified` (see lib/server/lead-service.ts).

import type { LeadStatus, LeadTypeKey } from "./types";

export interface StatusConfig {
  key: LeadStatus;
  label: string;
  bg: string;
  fg: string;
  dot: string;
  definition: string;
}

export const STATUS_CONFIG: Record<LeadStatus, StatusConfig> = {
  new: {
    key: "new",
    label: "New",
    bg: "#FFF7EC",
    fg: "#9A7B3F",
    dot: "#FFCF70",
    definition:
      "A marketing-qualified lead just handed off from Marketing. Accept it within 2 business days (the SLA) to start working it.",
  },
  working: {
    key: "working",
    label: "Working",
    bg: "#E8F1F5",
    fg: "#4D7285",
    dot: "#6EA3BE",
    definition:
      "Accepted and being actively worked — outreach, calls, and qualification of budget, timeline, and fit are in progress.",
  },
  meeting_scheduled: {
    key: "meeting_scheduled",
    label: "Meeting Scheduled",
    bg: "#EFECFB",
    fg: "#5A4F9E",
    dot: "#7A6FD0",
    definition:
      "A discovery call or demo is booked. A Stage 0 opportunity is created at this point and tied to the account.",
  },
  sales_qualified: {
    key: "sales_qualified",
    label: "Sales Qualified Lead",
    bg: "#EAF8E0",
    fg: "#56792F",
    dot: "#69B34A",
    definition:
      "Qualified for sales. The opportunity advances into the pipeline (Stage 1 · Discovery) and is handed to a rep. The lead leaves the BDR board.",
  },
  unqualified: {
    key: "unqualified",
    label: "Unqualified",
    bg: "#F4F2F8",
    fg: "#9A93B0",
    dot: "#C2BBD4",
    definition:
      "Not a fit right now. Removed from the pipeline — but the engagement history is preserved on the contact and district records.",
  },
};

/**
 * Explicit lifecycle transition table. Forward moves follow the pipeline; the
 * one back-step (meeting fell through) is meeting_scheduled → working.
 * Terminal states (sales_qualified, unqualified) cannot be left. Declared
 * here (client-safe) and imported by lib/server/lead-service.ts — the server
 * validation and the UI's offered choices can't drift.
 */
export const LEAD_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ["working", "unqualified"],
  working: ["meeting_scheduled", "unqualified"],
  meeting_scheduled: ["working", "sales_qualified", "unqualified"],
  sales_qualified: [],
  unqualified: [],
};

export const STATUS_ORDER: readonly LeadStatus[] = [
  "new",
  "working",
  "meeting_scheduled",
  "sales_qualified",
  "unqualified",
];

/** Board column order (all stages, New first). */
export const PIPELINE: readonly LeadStatus[] = STATUS_ORDER;

// ---- Lead type (source / category) ---------------------------------------
// Orthogonal to status: how the lead came in. Extensible — add entries here.

export interface LeadTypeConfig {
  key: LeadTypeKey;
  label: string;
  desc: string;
  dot: string;
  bg: string;
  fg: string;
}

export const LEAD_TYPES: Record<LeadTypeKey, LeadTypeConfig> = {
  mql: {
    key: "mql",
    label: "MQL",
    desc: "Marketing-qualified · crossed the 100-pt score threshold",
    dot: "#7A6FD0",
    bg: "#EFECFB",
    fg: "#5A4F9E",
  },
  inbound: {
    key: "inbound",
    label: "Inbound",
    desc: "Direct inbound — demo request, contact form, referral",
    dot: "#6EA3BE",
    bg: "#E8F1F5",
    fg: "#4D7285",
  },
  conference: {
    key: "conference",
    label: "Conference",
    desc: "Met at an event, conference, or trade show",
    dot: "#C68A2E",
    bg: "#FBF1DD",
    fg: "#8A6420",
  },
  other: {
    key: "other",
    label: "Other",
    desc: "Other source",
    dot: "#A69DC0",
    bg: "#EFEDF5",
    fg: "#6E6390",
  },
};

export const LEAD_TYPE_ORDER: readonly LeadTypeKey[] = [
  "mql",
  "inbound",
  "conference",
  "other",
];

/** Lead-type config lookup with an "other" fallback for unknown values. */
export function leadTypeConfig(key: string | null | undefined): LeadTypeConfig {
  return (key && LEAD_TYPES[key as LeadTypeKey]) || LEAD_TYPES.other;
}

export const UNQUAL_REASONS = [
  "No Response",
  "No Longer With District/School",
  "Not Interested in Virtual Instruction",
  "Does Not Fit ICP",
] as const;

export const SEQUENCES = [
  "Superintendent — Special Ed",
  "Curriculum Director — Virtual",
  "Principal — Staffing Gap",
  "General BDR Sequence",
] as const;

// Meetings-category outcome pills — labels/keys from outcome-types.ts, colors
// plum-tuned per the design handoff (leadsData.js OUTCOME_PILLS). Shared by
// the Outcome modal (picker) and the activity timeline (readout).
export const OUTCOME_PILLS = [
  { key: "positive_progress", label: "Moved Forward", icon: "🚀", color: "#56792F", bg: "#EFF5F0" },
  { key: "neutral", label: "Good Chat", icon: "💬", color: "#4D7285", bg: "#EEF5F8" },
  { key: "negative", label: "Went Cold", icon: "❄️", color: "#8A80A8", bg: "#F3F2F6" },
  { key: "follow_up_needed", label: "Follow Up", icon: "📌", color: "#C25A52", bg: "#FEF2F1" },
] as const;

/**
 * Lifecycle copy written by the server when a Sales Qualified transition
 * advances the Stage 0 opp. Declared here (client-safe) and imported by
 * lib/server/lead-service.ts so the toast and the lead_event can't drift.
 */
export const OPP_ADVANCED_MESSAGE = "Opportunity advanced to Stage 1 · Discovery";

/** Product lines offered on a new Stage 0 opportunity (verbatim from leadsData.js). */
export const OPP_PRODUCTS = [
  "Virtual Instruction",
  "Special Education Services",
  "Tutoring & Intervention",
  "Credit Recovery",
] as const;

// ---- Opportunity stages ----------------------------------------------------
// Entering "Meeting Scheduled" creates a Stage 0 opportunity (the lead-to-opp
// handoff). Stage 0 is the earliest pipeline stage; the opp advances from here.

export interface OppStageConfig {
  key: string;
  n: number;
  label: string;
  prob: number;
  dot: string;
  bg: string;
  fg: string;
  definition: string;
}

export const OPP_STAGES: readonly OppStageConfig[] = [
  {
    key: "meeting_scheduled",
    n: 0,
    label: "Meeting Scheduled",
    prob: 10,
    dot: "#7A6FD0",
    bg: "#EFECFB",
    fg: "#5A4F9E",
    definition:
      "Earliest pipeline stage — a meeting is booked but discovery hasn’t started. Created automatically when a lead reaches Meeting Scheduled.",
  },
  {
    key: "discovery",
    n: 1,
    label: "Discovery",
    prob: 25,
    dot: "#6EA3BE",
    bg: "#E8F1F5",
    fg: "#4D7285",
    definition:
      "Needs, budget, and timeline are being qualified with the account. Where a Sales Qualified Lead lands once handed to a rep.",
  },
  {
    key: "proposal",
    n: 2,
    label: "Proposal",
    prob: 50,
    dot: "#FFCF70",
    bg: "#FFF7EC",
    fg: "#9A7B3F",
    definition: "A formal proposal or quote is in front of the buyer.",
  },
  {
    key: "negotiation",
    n: 3,
    label: "Negotiation",
    prob: 75,
    dot: "#F37167",
    bg: "#FEF2F1",
    fg: "#C25A52",
    definition: "Terms, pricing, and contract details are being finalized.",
  },
  {
    key: "closed_won",
    n: 4,
    label: "Closed Won",
    prob: 100,
    dot: "#69B34A",
    bg: "#EAF8E0",
    fg: "#56792F",
    definition: "Deal signed and booked as revenue.",
  },
];

/**
 * Resolve a real opportunity stage string ("0 - Meeting Booked",
 * "1 - Discovery", …) to its display config by the leading stage number.
 * Returns null for closed/unnumbered stages — render the raw string then.
 */
export function oppStageFromString(
  stage: string | null | undefined,
): OppStageConfig | null {
  const m = stage?.match(/^(\d+)/);
  if (!m) return null;
  return OPP_STAGES.find((s) => s.n === Number(m[1])) ?? null;
}

/** Compact money formatting for opp pills: $75K / $4.5K / $800. */
export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1000) return "$" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "K";
  return "$" + n;
}
