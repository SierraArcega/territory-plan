// Activity type definitions and category mappings

export const ACTIVITY_CATEGORIES = {
  events: ["conference", "road_trip", "trade_show", "school_visit_day"],
  outreach: ["email_campaign", "phone_call", "linkedin_message"],
  meetings: ["sales_meeting", "demo", "proposal_review"],
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
  trade_show: "Trade Show",
  school_visit_day: "School Visit Day",
  // Outreach
  email_campaign: "Email Campaign",
  phone_call: "Phone Call",
  linkedin_message: "LinkedIn Message",
  // Meetings
  sales_meeting: "Sales Meeting",
  demo: "Demo",
  proposal_review: "Proposal Review",
};

// Icons for each activity type (emoji for simplicity)
export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  // Events
  conference: "🎤",
  road_trip: "🚗",
  trade_show: "🎪",
  school_visit_day: "🏫",
  // Outreach
  email_campaign: "📧",
  phone_call: "📞",
  linkedin_message: "💼",
  // Meetings
  sales_meeting: "🤝",
  demo: "🖥️",
  proposal_review: "📋",
};

// Category display labels
export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  events: "Events",
  outreach: "Outreach",
  meetings: "Meetings",
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
  outreach: "email_campaign",
  meetings: "sales_meeting",
};
