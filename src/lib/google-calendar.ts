// Google Calendar API client wrapper
// Handles OAuth token management, event fetching, and event creation/updates
// Used by the calendar sync engine and push routes

import { google } from "googleapis";

// OAuth2 client setup — reuses the same Google Cloud project as Supabase login,
// but with additional calendar scopes for reading/writing events
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CALENDAR_CLIENT_ID,
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  // Callback URL is set dynamically per-request in getAuthUrl()
);

// Scopes needed for calendar sync:
// - calendar.readonly: read events to pull into the app
// - calendar.events: create/update events for push sync
// - userinfo.email: needed to fetch the connected account's email address
const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

// ===== OAuth Helpers =====

// Build the Google OAuth consent URL for calendar access
// The rep clicks this to grant the app permission to read/write their calendar
export function getAuthUrl(redirectUri: string, state?: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: "offline", // "offline" gives us a refresh_token for background syncs
    scope: CALENDAR_SCOPES,
    prompt: "consent", // Always show consent screen so we get a refresh token
    redirect_uri: redirectUri,
    state: state || "", // Pass-through state for CSRF protection
  });
}

// Exchange the OAuth authorization code for access + refresh tokens
// Called once during the callback after the rep approves calendar access
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
}> {
  const { tokens } = await oauth2Client.getToken({ code, redirect_uri: redirectUri });

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Failed to get tokens from Google — missing access or refresh token");
  }

  // Try to get the user's email — this is for display purposes only,
  // so we fall back gracefully if it fails (e.g., scope issues)
  let email = "";
  try {
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();
    email = userInfo.email || "";
  } catch (userInfoErr) {
    // Non-fatal — the email is nice-to-have for display, not required for sync
    console.warn("Could not fetch user info (email will be empty):", userInfoErr);
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date || Date.now() + 3600 * 1000),
    email,
  };
}

// Refresh an expired access token using the stored refresh token
// Returns the new access token and its expiration time
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Failed to refresh Google access token");
  }

  return {
    accessToken: credentials.access_token,
    expiresAt: new Date(credentials.expiry_date || Date.now() + 3600 * 1000),
  };
}

// ===== Calendar Event Types =====

export interface GoogleCalendarEvent {
  id: string;
  summary: string; // event title
  description: string | null;
  start: { dateTime: string; date?: string };
  end: { dateTime: string; date?: string };
  location: string | null;
  status: string; // "confirmed", "tentative", "cancelled"
  attendees: Array<{
    email: string;
    displayName?: string;
    responseStatus: string; // "needsAction", "declined", "tentative", "accepted"
    self?: boolean;
  }>;
}

export interface CalendarEventAttendee {
  email: string;
  name: string | null;
  responseStatus: string;
}

// ===== Event Fetching =====

// Pull events from the user's primary Google Calendar within a date range
// Filters out all-day events (no dateTime) and cancelled events
export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<GoogleCalendarEvent[]> {
  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  // Paginate through all events in the date range
  do {
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true, // Expand recurring events into individual instances
      orderBy: "startTime",
      maxResults: 250,
      pageToken,
    });

    const items = response.data.items || [];
    for (const item of items) {
      // Skip all-day events (they have .date instead of .dateTime) and cancelled events
      if (!item.start?.dateTime || !item.end?.dateTime) continue;
      if (item.status === "cancelled") continue;

      events.push({
        id: item.id!,
        summary: item.summary || "(No title)",
        description: item.description || null,
        start: { dateTime: item.start.dateTime },
        end: { dateTime: item.end.dateTime },
        location: item.location || null,
        status: item.status || "confirmed",
        attendees: (item.attendees || []).map((a) => ({
          email: a.email!,
          displayName: a.displayName || undefined,
          responseStatus: a.responseStatus || "needsAction",
          self: a.self || undefined,
        })),
      });
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return events;
}

// Filter attendees to only external people (not from the rep's company domain)
// This is the key heuristic: if someone outside the org is on the invite, it's likely a sales meeting
export function filterExternalAttendees(
  attendees: GoogleCalendarEvent["attendees"],
  companyDomain: string
): CalendarEventAttendee[] {
  return attendees
    .filter((a) => {
      // Skip the calendar owner (self)
      if (a.self) return false;
      // Skip internal attendees (same email domain as company)
      const domain = a.email.split("@")[1]?.toLowerCase();
      return domain !== companyDomain.toLowerCase();
    })
    .map((a) => ({
      email: a.email,
      name: a.displayName || null,
      responseStatus: a.responseStatus,
    }));
}

// ===== Event Push (Create/Update/Delete) =====

// Create a new Google Calendar event from an activity
// Used when a rep creates an activity in the app and wants it on their calendar
export async function createCalendarEvent(
  accessToken: string,
  event: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    attendeeEmails?: string[];
  }
): Promise<string> {
  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: event.title,
      description: event.description,
      start: { dateTime: event.startTime.toISOString() },
      end: { dateTime: event.endTime.toISOString() },
      location: event.location,
      attendees: event.attendeeEmails?.map((email) => ({ email })),
    },
  });

  return response.data.id!;
}

// Update an existing Google Calendar event (e.g., when activity details change)
export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  updates: {
    title?: string;
    description?: string;
    startTime?: Date;
    endTime?: Date;
    location?: string;
    attendeeEmails?: string[];
  }
): Promise<void> {
  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const requestBody: Record<string, unknown> = {};
  if (updates.title) requestBody.summary = updates.title;
  if (updates.description !== undefined) requestBody.description = updates.description;
  if (updates.startTime) requestBody.start = { dateTime: updates.startTime.toISOString() };
  if (updates.endTime) requestBody.end = { dateTime: updates.endTime.toISOString() };
  if (updates.location !== undefined) requestBody.location = updates.location;
  if (updates.attendeeEmails) {
    requestBody.attendees = updates.attendeeEmails.map((email) => ({ email }));
  }

  await calendar.events.patch({
    calendarId: "primary",
    eventId,
    requestBody,
  });
}

// Delete a Google Calendar event (e.g., when an activity is deleted)
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  await calendar.events.delete({
    calendarId: "primary",
    eventId,
  });
}

// ===== Token Helpers =====

// Check if a token is expired or about to expire (within 5 minutes)
// Used before API calls to decide if we need to refresh first
export function isTokenExpired(expiresAt: Date): boolean {
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return expiresAt <= fiveMinutesFromNow;
}

// Get a valid access token, refreshing if needed
// This is the main entry point for getting a token before any Google API call
export async function getValidAccessToken(connection: {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}): Promise<{ accessToken: string; expiresAt: Date } | null> {
  if (!isTokenExpired(connection.tokenExpiresAt)) {
    return {
      accessToken: connection.accessToken,
      expiresAt: connection.tokenExpiresAt,
    };
  }

  // Token is expired — refresh it
  try {
    return await refreshAccessToken(connection.refreshToken);
  } catch {
    // Refresh failed — the user may have revoked access
    return null;
  }
}
