import type { Lead } from "@/features/leads/lib/types";

export const NOW = new Date("2026-06-02T10:30:00");

export function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    status: "working",
    score: 124,
    leadType: "mql",
    sequence: "Superintendent — Special Ed",
    marketingOwner: "Jules Okafor",
    unqualifiedReason: null,
    meetingAt: null,
    assignedAt: new Date("2026-06-01T10:00:00").toISOString(),
    acceptedAt: new Date("2026-06-01T14:00:00").toISOString(),
    createdAt: new Date("2026-05-22T09:00:00").toISOString(),
    updatedAt: new Date("2026-06-01T09:00:00").toISOString(),
    contact: {
      id: 11,
      name: "Karen Whitfield",
      title: "Director of Special Education",
      email: "kwhitfield@mesa.org",
      phone: "(970) 555-0142",
    },
    school: null,
    district: {
      leaid: "0802940",
      name: "Mesa Valley USD 51",
      city: "Grand Junction",
      stateAbbrev: "CO",
    },
    assignedBdr: { id: "u1", fullName: "Alex Rivera", avatarUrl: null },
    opportunity: null,
    ...overrides,
  };
}
