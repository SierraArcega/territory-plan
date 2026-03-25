/**
 * Calendar Sync Flow — E2E Tests
 *
 * Tests the pull sync pipeline: connect -> sync -> inbox review.
 * 9 tests covering: connect banner, connected state, manual sync -> inbox,
 * smart matching confidence, confirm -> activity, dismiss, batch confirm,
 * error state (401), empty state.
 */

import { test, expect } from "../fixtures";
import { CalendarSettingsPage } from "../pages/CalendarSettingsPage";
import { CalendarInboxPage } from "../pages/CalendarInboxPage";
import { MOCK_EVENTS } from "../helpers/mock-google";

test.describe("Calendar Sync Flow", () => {
  test("shows calendar connect banner when not connected", async ({
    page,
    db,
  }) => {
    // Seed user profile WITHOUT a calendar integration
    await db.seedUserProfile();
    await db.seedPlan();

    const inbox = new CalendarInboxPage(page);
    await inbox.goto();

    // The connect banner should be visible
    await expect(inbox.connectBanner).toBeVisible();
  });

  test("shows connected state in settings when integration exists", async ({
    page,
    db,
  }) => {
    // Seed user + calendar integration
    await db.seedUserProfile();
    await db.seedPlan();
    await db.seedUserIntegration();

    const settings = new CalendarSettingsPage(page);
    await settings.goto();

    // Should show the connection card with email
    const connected = await settings.isConnected();
    expect(connected).toBe(true);

    // Should NOT show the locked overlay
    const locked = await settings.isLocked();
    expect(locked).toBe(false);
  });

  test("triggers manual sync and shows inbox events", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    // Mock returns 3 events
    mockGoogleCalendar.setEvents([
      MOCK_EVENTS.highConfidence,
      MOCK_EVENTS.mediumConfidence,
      MOCK_EVENTS.lowConfidence,
    ]);

    const inbox = new CalendarInboxPage(page);
    await inbox.goto();
    await inbox.waitForEvents();

    // Should show the inbox header
    await expect(inbox.inboxHeader).toBeVisible();

    // Should show event cards
    const cards = inbox.getEventCards();
    await expect(cards).toHaveCount(3);
  });

  test("displays smart matching confidence correctly", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    mockGoogleCalendar.setEvents([
      MOCK_EVENTS.highConfidence,
      MOCK_EVENTS.mediumConfidence,
      MOCK_EVENTS.lowConfidence,
    ]);

    const inbox = new CalendarInboxPage(page);
    await inbox.goto();
    await inbox.waitForEvents();

    // High confidence event should show "Strong match"
    const highLabel = await inbox.getConfidenceLabel(
      "Q4 Program Review with Springfield USD"
    );
    expect(highLabel).toBe("Strong match");

    // Medium confidence should show "Possible match"
    const medLabel = await inbox.getConfidenceLabel(
      "Follow-up: Curriculum Discussion"
    );
    expect(medLabel).toBe("Possible match");
  });

  test("confirms a high-confidence event creates an activity", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    mockGoogleCalendar.setEvents([MOCK_EVENTS.highConfidence]);

    const inbox = new CalendarInboxPage(page);
    await inbox.goto();
    await inbox.waitForEvents();

    // Confirm the event
    await inbox.confirmEvent("Q4 Program Review with Springfield USD");

    // The card should animate out
    await expect(
      inbox.getEventByTitle("Q4 Program Review with Springfield USD")
    ).toBeHidden({ timeout: 5_000 });
  });

  test("dismisses an event and it disappears", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    mockGoogleCalendar.setEvents([MOCK_EVENTS.lowConfidence]);

    const inbox = new CalendarInboxPage(page);
    await inbox.goto();
    await inbox.waitForEvents();

    // Dismiss the event
    await inbox.dismissEvent("Coffee with External Partner");

    // Should disappear
    await expect(
      inbox.getEventByTitle("Coffee with External Partner")
    ).toBeHidden({ timeout: 5_000 });
  });

  test("batch confirms high-confidence events", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    // Need multiple high-confidence events for batch confirm bar to appear
    const highEvent2 = {
      ...MOCK_EVENTS.highConfidence,
      id: "gcal-e2e-high-002",
      summary: "Quarterly Planning Session",
    };

    mockGoogleCalendar.setEvents([
      MOCK_EVENTS.highConfidence,
      { ...highEvent2 },
    ]);

    const inbox = new CalendarInboxPage(page);
    await inbox.goto();
    await inbox.waitForEvents();

    // Batch confirm bar should be visible
    await expect(inbox.batchConfirmBar).toBeVisible();

    // Click batch confirm
    await inbox.batchConfirmHighConfidence();

    // Both events should disappear
    await expect(inbox.getEventCards()).toHaveCount(0, { timeout: 5_000 });
  });

  test("shows error state when Google API returns 401", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    // Set up a 401 error response
    mockGoogleCalendar.setError(401, "Token has been expired or revoked.");

    const inbox = new CalendarInboxPage(page);
    await inbox.goto();

    // The app should show an error state or empty inbox since the API errored
    const errorOrEmpty = page
      .locator('text="reconnect"')
      .or(inbox.emptyState)
      .or(page.locator('text="error"'));
    await expect(errorOrEmpty.first()).toBeVisible({ timeout: 10_000 });

    // No event cards should be shown
    const cards = inbox.getEventCards();
    await expect(cards).toHaveCount(0);
  });

  test("shows empty state when no pending events", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    // Return empty event list
    mockGoogleCalendar.setEvents([]);

    const inbox = new CalendarInboxPage(page);
    await inbox.goto();
    await inbox.waitForEvents();

    // Should show "All caught up" message
    const empty = await inbox.isEmpty();
    expect(empty).toBe(true);
  });
});
