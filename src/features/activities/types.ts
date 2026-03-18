// Activity type definitions and category mappings

export const ACTIVITY_CATEGORIES = {
  events: [
    "conference",
    "road_trip",
    "dinner",
    "happy_hour",
    "school_site_visit",
    "fun_and_games",
  ],
  campaigns: ["mixmax_campaign"],
  meetings: [
    "discovery_call",
    "program_check_in",
    "proposal_review",
    "renewal_conversation",
  ],
  gift_drop: ["gift_drop"],
} as const;

export type ActivityCategory = keyof typeof ACTIVITY_CATEGORIES;
export type ActivityType = (typeof ACTIVITY_CATEGORIES)[ActivityCategory][number];

// Flat list of all activity types
export const ALL_ACTIVITY_TYPES = Object.values(ACTIVITY_CATEGORIES).flat() as ActivityType[];

// Get category for a given type
export function getCategoryForType(type: ActivityType): ActivityCategory {
  for (const [category, types] of Object.entries(ACTIVITY_CATEGORIES)) {
    if ((types as readonly string[]).includes(type)) {
      return category as ActivityCategory;
    }
  }
  return "events"; // fallback
}

// Display labels for activity types
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  // Events
  conference: "Conference",
  road_trip: "Road Trip",
  dinner: "Dinner",
  happy_hour: "Happy Hour",
  school_site_visit: "School Site Visit",
  fun_and_games: "Fun + Games",
  // Campaigns
  mixmax_campaign: "Mixmax Campaign",
  // Meetings
  discovery_call: "Discovery Call",
  program_check_in: "Program Check-In",
  proposal_review: "Proposal Review",
  renewal_conversation: "Renewal Conversation",
  // Gift Drop
  gift_drop: "Gift Drop",
};

// Icons for each activity type (emoji for simplicity)
export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  // Events
  conference: "🎤",
  road_trip: "🚗",
  dinner: "🍽️",
  happy_hour: "🍻",
  school_site_visit: "🏫",
  fun_and_games: "🎯",
  // Campaigns
  mixmax_campaign: "📧",
  // Meetings
  discovery_call: "🔍",
  program_check_in: "📋",
  proposal_review: "📝",
  renewal_conversation: "🔄",
  // Gift Drop
  gift_drop: "🎁",
};

// Category display labels
export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  events: "Events",
  campaigns: "Campaigns",
  meetings: "Meetings",
  gift_drop: "Gift Drop",
};

// Category icons (used in the category picker tiles)
export const CATEGORY_ICONS: Record<ActivityCategory, string> = {
  events: "🎤",
  campaigns: "📧",
  meetings: "🤝",
  gift_drop: "🎁",
};

// Category descriptions (shown under the tile label)
export const CATEGORY_DESCRIPTIONS: Record<ActivityCategory, string> = {
  events: "Conferences, road trips, dinners, happy hours",
  campaigns: "Email sequences and outreach campaigns",
  meetings: "Calls, check-ins, reviews, and conversations",
  gift_drop: "Send gifts to contacts and champions",
};

// Activity status types and config
export const VALID_ACTIVITY_STATUSES = ["planned", "completed", "cancelled"] as const;
export type ActivityStatus = (typeof VALID_ACTIVITY_STATUSES)[number];

export const ACTIVITY_STATUS_CONFIG: Record<
  ActivityStatus,
  { label: string; color: string; bgColor: string }
> = {
  planned: { label: "Planned", color: "#6EA3BE", bgColor: "#EEF5F8" },
  completed: { label: "Completed", color: "#8AA891", bgColor: "#EFF5F0" },
  cancelled: { label: "Cancelled", color: "#9CA3AF", bgColor: "#F3F4F6" },
};

// Default type for each category (used when creating from category tab)
export const DEFAULT_TYPE_FOR_CATEGORY: Record<ActivityCategory, ActivityType> = {
  events: "conference",
  campaigns: "mixmax_campaign",
  meetings: "discovery_call",
  gift_drop: "gift_drop",
};
