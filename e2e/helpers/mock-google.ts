/**
 * Mock Google Calendar API response builders.
 *
 * These produce responses matching the real Google Calendar API v3 format,
 * used by page.route() interceptors in api-mocks.fixture.ts.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MockCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    self?: boolean;
    organizer?: boolean;
  }>;
  status?: string;
  created?: string;
  updated?: string;
  organizer?: { email: string; displayName?: string; self?: boolean };
  htmlLink?: string;
}

// ─── Pre-built test events ───────────────────────────────────────────────────

const NOW = new Date();
const tomorrow = new Date(NOW.getTime() + 86400_000);
const nextWeek = new Date(NOW.getTime() + 7 * 86400_000);

/**
 * Three events with varying confidence levels for smart matching tests:
 * - High: attendee email matches a known contact
 * - Medium: attendee domain matches company domain
 * - Low: unknown external attendees
 */
export const MOCK_EVENTS = {
  highConfidence: buildCalendarEvent({
    id: "gcal-e2e-high-001",
    summary: "Q4 Program Review with Springfield USD",
    start: { dateTime: tomorrow.toISOString() },
    end: { dateTime: new Date(tomorrow.getTime() + 3600_000).toISOString() },
    attendees: [
      { email: "e2e-test@gmail.com", displayName: "E2E Test User", self: true },
      {
        email: "jsmith@springfield.k12.us",
        displayName: "Jane Smith",
        responseStatus: "accepted",
      },
    ],
  }),

  mediumConfidence: buildCalendarEvent({
    id: "gcal-e2e-med-001",
    summary: "Follow-up: Curriculum Discussion",
    start: { dateTime: nextWeek.toISOString() },
    end: { dateTime: new Date(nextWeek.getTime() + 1800_000).toISOString() },
    attendees: [
      { email: "e2e-test@gmail.com", displayName: "E2E Test User", self: true },
      {
        email: "unknown@fullmind.test",
        displayName: "Domain Match User",
        responseStatus: "tentative",
      },
    ],
  }),

  lowConfidence: buildCalendarEvent({
    id: "gcal-e2e-low-001",
    summary: "Coffee with External Partner",
    start: {
      dateTime: new Date(NOW.getTime() + 2 * 86400_000).toISOString(),
    },
    end: {
      dateTime: new Date(NOW.getTime() + 2 * 86400_000 + 3600_000).toISOString(),
    },
    attendees: [
      { email: "e2e-test@gmail.com", displayName: "E2E Test User", self: true },
      {
        email: "random@external.com",
        displayName: "Random Person",
        responseStatus: "needsAction",
      },
    ],
  }),
};

// ─── Builder functions ───────────────────────────────────────────────────────

/** Build a single Google Calendar event response */
export function buildCalendarEvent(
  overrides: Partial<MockCalendarEvent> & { id: string; summary: string }
): MockCalendarEvent {
  const now = new Date().toISOString();
  return {
    status: "confirmed",
    created: now,
    updated: now,
    organizer: { email: "e2e-test@gmail.com", self: true },
    htmlLink: `https://www.google.com/calendar/event?eid=${overrides.id}`,
    start: { dateTime: new Date().toISOString(), timeZone: "America/New_York" },
    end: {
      dateTime: new Date(Date.now() + 3600_000).toISOString(),
      timeZone: "America/New_York",
    },
    attendees: [],
    ...overrides,
  };
}

/** Build a Google Calendar events.list response */
export function buildCalendarEventList(
  events: MockCalendarEvent[]
): Record<string, unknown> {
  return {
    kind: "calendar#events",
    etag: '"e2e-test-etag"',
    summary: "e2e-test@gmail.com",
    updated: new Date().toISOString(),
    timeZone: "America/New_York",
    accessRole: "owner",
    nextSyncToken: "e2e-sync-token-001",
    items: events,
  };
}

/** Build a Google Calendar API error response */
export function buildErrorResponse(
  code: number,
  message: string
): { error: { code: number; message: string; status: string } } {
  const statusMap: Record<number, string> = {
    400: "INVALID_ARGUMENT",
    401: "UNAUTHENTICATED",
    403: "PERMISSION_DENIED",
    404: "NOT_FOUND",
    500: "INTERNAL",
  };

  return {
    error: {
      code,
      message,
      status: statusMap[code] || "UNKNOWN",
    },
  };
}

/** Build a successful event creation/update response */
export function buildEventMutationResponse(
  eventId: string,
  summary: string
): MockCalendarEvent {
  return buildCalendarEvent({
    id: eventId,
    summary,
    status: "confirmed",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  });
}
