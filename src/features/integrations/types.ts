export type IntegrationService = "gmail" | "google_calendar" | "slack";

export type IntegrationStatus = "connected" | "expired" | "disconnected" | "error";

export interface IntegrationConnection {
  id: string;
  service: IntegrationService;
  accountEmail: string | null;
  accountName: string | null;
  status: IntegrationStatus;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  metadata: Record<string, unknown> | null;
  connectedAt: string;
}

// All supported services with display metadata
export const INTEGRATION_SERVICES: Record<IntegrationService, {
  label: string;
  description: string;
  color: string;
  icon: string; // short letter(s) for avatar
  isOAuth: boolean;
}> = {
  gmail: {
    label: "Gmail",
    description: "Sync emails and send messages to district contacts",
    color: "#EA4335",
    icon: "G",
    isOAuth: true,
  },
  google_calendar: {
    label: "Google Calendar",
    description: "Sync meetings and schedule events",
    color: "#4285F4",
    icon: "C",
    isOAuth: true,
  },
  slack: {
    label: "Slack",
    description: "Read channels, send messages, and get notifications",
    color: "#4A154B",
    icon: "S",
    isOAuth: true,
  },
};
