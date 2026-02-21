// Outcome type definitions — category-specific outcomes for activity completion
// When a rep marks an activity as completed, they can tag what resulted from it.
// Outcomes are grouped by activity category (meetings, outreach, events) since
// different activity types produce different kinds of results.

import type { ActivityCategory } from "./types";

// All possible outcome types across all categories
export type OutcomeType =
  // Meeting outcomes
  | "positive_progress"
  | "neutral"
  | "negative"
  | "follow_up_needed"
  // Outreach outcomes
  | "response_received"
  | "meeting_booked"
  | "no_response"
  // Event outcomes
  | "contacts_made"
  | "meetings_scheduled"
  | "pipeline_generated";

// Configuration for each outcome type: label, icon, colors, and whether it triggers auto-task
export interface OutcomeConfig {
  label: string;
  description: string;
  icon: string;
  color: string;      // text/icon color
  bgColor: string;    // background for badges
  autoTask?: "follow_up" | "prep";  // triggers auto-task creation if set
}

export const OUTCOME_CONFIGS: Record<OutcomeType, OutcomeConfig> = {
  // Meeting outcomes
  positive_progress: {
    label: "Moved Forward",
    description: "Demo requested, proposal sent, or contract discussion",
    icon: "🚀",
    color: "#8AA891",
    bgColor: "#EFF5F0",
  },
  neutral: {
    label: "Good Chat",
    description: "Good conversation, no concrete next step yet",
    icon: "💬",
    color: "#6EA3BE",
    bgColor: "#EEF5F8",
  },
  negative: {
    label: "Went Cold",
    description: "Not a fit or lost interest",
    icon: "❄️",
    color: "#9CA3AF",
    bgColor: "#F3F4F6",
  },
  follow_up_needed: {
    label: "Follow Up",
    description: "Need to reconnect — creates a follow-up task",
    icon: "📌",
    color: "#F37167",
    bgColor: "#FEF2F1",
    autoTask: "follow_up",
  },

  // Outreach outcomes
  response_received: {
    label: "Got Reply",
    description: "Received a response",
    icon: "✉️",
    color: "#8AA891",
    bgColor: "#EFF5F0",
  },
  meeting_booked: {
    label: "Meeting Booked",
    description: "Scheduled a follow-up meeting — creates a prep task",
    icon: "📅",
    color: "#403770",
    bgColor: "#EEEAF5",
    autoTask: "prep",
  },
  no_response: {
    label: "No Reply",
    description: "No response yet",
    icon: "🔇",
    color: "#9CA3AF",
    bgColor: "#F3F4F6",
  },

  // Event outcomes
  contacts_made: {
    label: "New Contacts",
    description: "Met new people worth following up with",
    icon: "🤝",
    color: "#403770",
    bgColor: "#EEEAF5",
  },
  meetings_scheduled: {
    label: "Meetings Set",
    description: "Booked follow-up meetings from this event",
    icon: "📅",
    color: "#8AA891",
    bgColor: "#EFF5F0",
  },
  pipeline_generated: {
    label: "Pipeline Found",
    description: "Identified new opportunities",
    icon: "💰",
    color: "#F37167",
    bgColor: "#FEF2F1",
  },
};

// Which outcomes are available for each activity category
export const OUTCOMES_BY_CATEGORY: Record<ActivityCategory, OutcomeType[]> = {
  meetings: ["positive_progress", "neutral", "negative", "follow_up_needed"],
  outreach: ["response_received", "meeting_booked", "no_response"],
  events: ["contacts_made", "meetings_scheduled", "pipeline_generated"],
};

// Get the outcome config for a given type, with a fallback for unknown types
export function getOutcomeConfig(outcomeType: string): OutcomeConfig | null {
  return OUTCOME_CONFIGS[outcomeType as OutcomeType] || null;
}
