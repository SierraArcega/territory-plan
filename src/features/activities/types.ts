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
  sponsorships: ["booth_exhibit", "conference_sponsor", "meal_reception", "charity_event"],
  thought_leadership: ["webinar", "speaking_engagement", "professional_development", "course"],
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
  // Sponsorships
  booth_exhibit: "Booth / Exhibit",
  conference_sponsor: "Conference Sponsor",
  meal_reception: "Meal / Reception",
  charity_event: "Charity Event",
  // Thought Leadership
  webinar: "Webinar",
  speaking_engagement: "Speaking Engagement",
  professional_development: "PD Session",
  course: "Course",
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
  // Sponsorships
  booth_exhibit: "🏗️",
  conference_sponsor: "🤝",
  meal_reception: "🍽️",
  charity_event: "❤️",
  // Thought Leadership
  webinar: "🖥️",
  speaking_engagement: "🎙️",
  professional_development: "🎓",
  course: "📚",
};

// Category display labels
export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  events: "Events",
  campaigns: "Campaigns",
  meetings: "Meetings",
  gift_drop: "Gift Drop",
  sponsorships: "Sponsorships",
  thought_leadership: "Thought Leadership",
};

// Category icons (used in the category picker tiles)
export const CATEGORY_ICONS: Record<ActivityCategory, string> = {
  events: "🎤",
  campaigns: "📧",
  meetings: "🤝",
  gift_drop: "🎁",
  sponsorships: "🏆",
  thought_leadership: "💡",
};

// Category descriptions (shown under the tile label)
export const CATEGORY_DESCRIPTIONS: Record<ActivityCategory, string> = {
  events: "Conferences, road trips, dinners, happy hours",
  campaigns: "Email sequences and outreach campaigns",
  meetings: "Calls, check-ins, reviews, and conversations",
  gift_drop: "Send gifts to contacts and champions",
  sponsorships: "Booths, conference sponsors, meals, and charity events",
  thought_leadership: "Webinars, talks, PD sessions, and courses",
};

// Activity status types and config
export const VALID_ACTIVITY_STATUSES = [
  "planned",
  "requested",
  "planning",
  "in_progress",
  "wrapping_up",
  "completed",
  "cancelled",
] as const;
export type ActivityStatus = (typeof VALID_ACTIVITY_STATUSES)[number];

export const ACTIVITY_STATUS_CONFIG: Record<
  ActivityStatus,
  { label: string; color: string; bgColor: string }
> = {
  planned: { label: "Planned", color: "#6EA3BE", bgColor: "#EEF5F8" },
  requested: { label: "Requested", color: "#D4A574", bgColor: "#FDF6F0" },
  planning: { label: "Planning", color: "#A78BCA", bgColor: "#F5F0FA" },
  in_progress: { label: "In Progress", color: "#6EA3BE", bgColor: "#EEF5F8" },
  wrapping_up: { label: "Wrapping Up", color: "#B8A96E", bgColor: "#FAF8F0" },
  completed: { label: "Completed", color: "#8AA891", bgColor: "#EFF5F0" },
  cancelled: { label: "Cancelled", color: "#9CA3AF", bgColor: "#F3F4F6" },
};

// Format a raw status string for display (e.g. "in_progress" → "In Progress")
export function formatStatusLabel(status: string): string {
  const config = ACTIVITY_STATUS_CONFIG[status as ActivityStatus];
  if (config) return config.label;
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Unified status list — all activity types share the same lifecycle statuses
export function getStatusesForType(_type: ActivityType): ActivityStatus[] {
  return [...VALID_ACTIVITY_STATUSES];
}

// ===== Metadata Interfaces (stored as JSON in activity.metadata) =====

export interface ConferenceMetadata {
  websiteUrl?: string;
  timezone?: string;
  address?: string;
  addressLat?: number;
  addressLng?: number;
}

export interface SocialEventMetadata {
  time?: string; // HH:mm format
  address?: string;
  addressLat?: number;
  addressLng?: number;
  inviteUrl?: string;
  googleCalendarUrl?: string;
}

export interface WebinarMetadata {
  platformUrl?: string;
  time?: string;
  topic?: string;
}

export interface SpeakingEngagementMetadata {
  address?: string;
  addressLat?: number;
  addressLng?: number;
  time?: string;
  topic?: string;
}

export interface ProfessionalDevelopmentMetadata {
  address?: string;
  addressLat?: number;
  addressLng?: number;
  time?: string;
  topic?: string;
}

export interface CourseMetadata {
  platformUrl?: string;
  provider?: string;
  topic?: string;
}

export interface SponsorshipMetadata {
  eventName?: string;
  cost?: number;
  address?: string;
  addressLat?: number;
  addressLng?: number;
}

// Road Trip uses no metadata — districts (with visit dates), attendees, and expenses cover it
export type ActivityMetadata =
  | ConferenceMetadata
  | SocialEventMetadata
  | WebinarMetadata
  | SpeakingEngagementMetadata
  | SponsorshipMetadata
  | ProfessionalDevelopmentMetadata
  | CourseMetadata
  | null;

// Default type for each category (used when creating from category tab)
export const DEFAULT_TYPE_FOR_CATEGORY: Record<ActivityCategory, ActivityType> = {
  events: "conference",
  campaigns: "mixmax_campaign",
  meetings: "discovery_call",
  gift_drop: "gift_drop",
  sponsorships: "booth_exhibit",
  thought_leadership: "webinar",
};
