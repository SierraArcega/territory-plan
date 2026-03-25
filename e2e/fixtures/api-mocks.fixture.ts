/**
 * API mock fixture — intercepts Google Calendar API requests via page.route().
 *
 * Provides a `mockGoogleCalendar` fixture that:
 *   - Intercepts all requests to googleapis.com/calendar/*
 *   - Returns configurable mock responses
 *   - Tracks intercepted requests for assertions (e.g., "verify push was called")
 */

import { test as base, type Page, type Route } from "@playwright/test";
import {
  buildCalendarEventList,
  buildErrorResponse,
  buildEventMutationResponse,
  MOCK_EVENTS,
  type MockCalendarEvent,
} from "../helpers/mock-google";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InterceptedRequest {
  method: string;
  url: string;
  body: unknown;
  timestamp: number;
}

export interface GoogleCalendarMock {
  /** All intercepted Google Calendar API requests */
  requests: InterceptedRequest[];

  /** Configure which events to return from events.list */
  setEvents: (events: MockCalendarEvent[]) => void;

  /** Configure an error response for the next request */
  setError: (code: number, message: string) => void;

  /** Clear the error so subsequent requests succeed */
  clearError: () => void;

  /** Get requests filtered by method */
  getRequests: (method: string) => InterceptedRequest[];

  /** Get POST/PUT requests (push operations) */
  getPushRequests: () => InterceptedRequest[];

  /** Get DELETE requests */
  getDeleteRequests: () => InterceptedRequest[];

  /** Reset all state */
  reset: () => void;
}

// ─── Fixture ─────────────────────────────────────────────────────────────────

export const test = base.extend<{ mockGoogleCalendar: GoogleCalendarMock }>({
  mockGoogleCalendar: async ({ page }, use) => {
    const state = {
      events: [
        MOCK_EVENTS.highConfidence,
        MOCK_EVENTS.mediumConfidence,
        MOCK_EVENTS.lowConfidence,
      ] as MockCalendarEvent[],
      error: null as { code: number; message: string } | null,
      requests: [] as InterceptedRequest[],
    };

    // Intercept all Google Calendar API calls
    await page.route("**/googleapis.com/calendar/**", async (route: Route) => {
      const request = route.request();
      const method = request.method();
      const url = request.url();

      let body: unknown = null;
      try {
        body = request.postDataJSON();
      } catch {
        body = request.postData();
      }

      // Track the request
      state.requests.push({
        method,
        url,
        body,
        timestamp: Date.now(),
      });

      // If an error is configured, return it
      if (state.error) {
        await route.fulfill({
          status: state.error.code,
          contentType: "application/json",
          body: JSON.stringify(
            buildErrorResponse(state.error.code, state.error.message)
          ),
        });
        return;
      }

      // Route based on method and URL pattern
      if (method === "GET" && url.includes("/events")) {
        // events.list
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildCalendarEventList(state.events)),
        });
      } else if (method === "POST" && url.includes("/events")) {
        // events.insert
        const summary =
          typeof body === "object" && body !== null && "summary" in body
            ? String((body as Record<string, unknown>).summary)
            : "New Event";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            buildEventMutationResponse(`gcal-created-${Date.now()}`, summary)
          ),
        });
      } else if (
        (method === "PUT" || method === "PATCH") &&
        url.includes("/events/")
      ) {
        // events.update / events.patch
        const eventId = url.split("/events/").pop()?.split("?")[0] || "unknown";
        const summary =
          typeof body === "object" && body !== null && "summary" in body
            ? String((body as Record<string, unknown>).summary)
            : "Updated Event";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            buildEventMutationResponse(eventId, summary)
          ),
        });
      } else if (method === "DELETE" && url.includes("/events/")) {
        // events.delete
        await route.fulfill({ status: 204, body: "" });
      } else {
        // Unhandled — pass through (or return 404)
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify(
            buildErrorResponse(404, "E2E mock: unhandled route")
          ),
        });
      }
    });

    // Also intercept our own app's calendar API routes that call Google internally
    // This lets us verify what the app sends to its own backend
    await page.route("**/api/calendar/sync", async (route: Route) => {
      state.requests.push({
        method: route.request().method(),
        url: route.request().url(),
        body: null,
        timestamp: Date.now(),
      });
      // Let it pass through to the real server
      await route.fallback();
    });

    const mock: GoogleCalendarMock = {
      requests: state.requests,

      setEvents: (events) => {
        state.events = events;
      },

      setError: (code, message) => {
        state.error = { code, message };
      },

      clearError: () => {
        state.error = null;
      },

      getRequests: (method) =>
        state.requests.filter((r) => r.method === method),

      getPushRequests: () =>
        state.requests.filter(
          (r) =>
            (r.method === "POST" || r.method === "PUT" || r.method === "PATCH") &&
            r.url.includes("googleapis.com/calendar")
        ),

      getDeleteRequests: () =>
        state.requests.filter(
          (r) =>
            r.method === "DELETE" &&
            r.url.includes("googleapis.com/calendar")
        ),

      reset: () => {
        state.events = [
          MOCK_EVENTS.highConfidence,
          MOCK_EVENTS.mediumConfidence,
          MOCK_EVENTS.lowConfidence,
        ];
        state.error = null;
        state.requests.length = 0;
      },
    };

    await use(mock);
  },
});

export { expect } from "@playwright/test";
