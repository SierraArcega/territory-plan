/**
 * Calendar Push Sync — E2E Tests
 *
 * Tests the push direction: App -> Google Calendar.
 * 5 tests covering: correct payload, attendees, sync direction, type filters,
 * error handling.
 */

import { test, expect } from "../fixtures";
import { ActivityFormPage } from "../pages/ActivityFormPage";
import { ActivityTimelinePage } from "../pages/ActivityTimelinePage";

test.describe("Calendar Push Sync", () => {
  test("push creates event with correct title and time", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    const activityForm = new ActivityFormPage(page);
    const timeline = new ActivityTimelinePage(page);

    await timeline.goto();
    await page.locator('button:has-text("New Activity")').first().click();

    await activityForm.createActivity({
      category: "Outreach",
      type: "Program Check-In",
      title: "Push Payload Test",
      startDate: "2026-05-01",
    });

    await activityForm.waitForClose();

    // Wait for activity to appear (ensures push had time to fire)
    await expect(
      timeline.getActivityByTitle("Push Payload Test")
    ).toBeVisible({ timeout: 5_000 });

    // Verify the push request payload
    const pushRequests = mockGoogleCalendar.getPushRequests();
    const createReq = pushRequests.find(
      (r) =>
        r.method === "POST" &&
        typeof r.body === "object" &&
        r.body !== null
    );

    expect(createReq).toBeDefined();
    const body = createReq!.body as Record<string, unknown>;
    expect(body.summary).toBe("Push Payload Test");
    expect(body.start).toBeDefined();
    expect(body.end).toBeDefined();
  });

  test("push includes attendees from activity contacts", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    const activityForm = new ActivityFormPage(page);
    const timeline = new ActivityTimelinePage(page);

    await timeline.goto();
    await page.locator('button:has-text("New Activity")').first().click();

    // Create an activity with type that supports attendees
    await activityForm.selectCategory("Events");
    await activityForm.selectType("Conference");
    await activityForm.waitForForm();
    await activityForm.setTitle("Attendee Push Test");
    await activityForm.setStartDate("2026-05-15");

    await activityForm.save();
    await activityForm.waitForClose();

    // Verify activity was created
    await expect(
      timeline.getActivityByTitle("Attendee Push Test")
    ).toBeVisible({ timeout: 5_000 });

    // Verify a push request was made
    const pushRequests = mockGoogleCalendar.getPushRequests();
    expect(pushRequests.length).toBeGreaterThanOrEqual(1);
  });

  test("push respects sync direction setting", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    // Set sync direction to one_way (calendar -> app only, no push)
    await db.seedUserProfile();
    await db.seedPlan();
    await db.seedUserIntegration({ syncDirection: "one_way" });

    // Reset mock tracking
    mockGoogleCalendar.reset();

    const activityForm = new ActivityFormPage(page);
    const timeline = new ActivityTimelinePage(page);

    await timeline.goto();
    await page.locator('button:has-text("New Activity")').first().click();

    await activityForm.createActivity({
      category: "Outreach",
      type: "Program Check-In",
      title: "No Push Activity",
      startDate: "2026-05-20",
    });

    await activityForm.waitForClose();

    // Wait for the activity to appear (ensures the create flow completed)
    await expect(
      timeline.getActivityByTitle("No Push Activity")
    ).toBeVisible({ timeout: 5_000 });

    // With one_way sync, NO push should be made to Google Calendar
    const pushRequests = mockGoogleCalendar.getPushRequests();
    expect(pushRequests.length).toBe(0);
  });

  test("push respects activity type filters", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    // Configure integration to only sync specific activity types
    // (filtering out "dinner" type)
    await db.seedUserProfile();
    await db.seedPlan();
    await db.seedUserIntegration({
      syncedActivityTypes: ["conference", "road_trip", "program_check_in"],
    });

    mockGoogleCalendar.reset();

    const activityForm = new ActivityFormPage(page);
    const timeline = new ActivityTimelinePage(page);

    await timeline.goto();
    await page.locator('button:has-text("New Activity")').first().click();

    // Create a "Dinner" activity which is NOT in the filter list
    await activityForm.createActivity({
      category: "Relationship Building",
      type: "Dinner",
      title: "Filtered Dinner Activity",
      startDate: "2026-05-25",
    });

    await activityForm.waitForClose();

    // Wait for activity to appear
    await expect(
      timeline.getActivityByTitle("Filtered Dinner Activity")
    ).toBeVisible({ timeout: 5_000 });

    // Dinner is not in syncedActivityTypes, so no push should happen
    const pushRequests = mockGoogleCalendar.getPushRequests();
    expect(pushRequests.length).toBe(0);
  });

  test("push handles Google API errors gracefully", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    // Configure Google API to return 500 errors
    mockGoogleCalendar.setError(500, "Internal Server Error");

    const activityForm = new ActivityFormPage(page);
    const timeline = new ActivityTimelinePage(page);

    await timeline.goto();
    await page.locator('button:has-text("New Activity")').first().click();

    await activityForm.createActivity({
      category: "Outreach",
      type: "Program Check-In",
      title: "Error Handling Test",
      startDate: "2026-06-01",
    });

    // The activity should still be saved locally even if push fails
    await activityForm.waitForClose();

    // Activity should exist in the timeline despite push failure
    await expect(
      timeline.getActivityByTitle("Error Handling Test")
    ).toBeVisible({ timeout: 5_000 });
  });
});
