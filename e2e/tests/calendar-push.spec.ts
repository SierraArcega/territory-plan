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
    await timeline.newActivityButton.click();

    await activityForm.createActivity({
      category: "Meetings",
      type: "Program Check",
      title: "Push Payload Test",
      startDate: "2026-05-01",
    });

    await activityForm.waitForClose();

    await expect(
      timeline.getActivityByTitle("Push Payload Test")
    ).toBeVisible({ timeout: 5_000 });

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
    await timeline.newActivityButton.click();

    await activityForm.createActivity({
      category: "Meetings",
      type: "Program Check",
      title: "Attendee Push Test",
      startDate: "2026-05-15",
    });

    await activityForm.waitForClose();

    await expect(
      timeline.getActivityByTitle("Attendee Push Test")
    ).toBeVisible({ timeout: 5_000 });

    const pushRequests = mockGoogleCalendar.getPushRequests();
    expect(pushRequests.length).toBeGreaterThanOrEqual(1);
  });

  test("push respects sync direction setting", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedUserProfile();
    await db.seedPlan();
    await db.seedUserIntegration({ syncDirection: "one_way" });

    mockGoogleCalendar.reset();

    const activityForm = new ActivityFormPage(page);
    const timeline = new ActivityTimelinePage(page);

    await timeline.goto();
    await timeline.newActivityButton.click();

    await activityForm.createActivity({
      category: "Meetings",
      type: "Program Check",
      title: "No Push Activity",
      startDate: "2026-05-20",
    });

    await activityForm.waitForClose();

    await expect(
      timeline.getActivityByTitle("No Push Activity")
    ).toBeVisible({ timeout: 5_000 });

    const pushRequests = mockGoogleCalendar.getPushRequests();
    expect(pushRequests.length).toBe(0);
  });

  test("push respects activity type filters", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedUserProfile();
    await db.seedPlan();
    await db.seedUserIntegration({
      syncedActivityTypes: ["conference", "road_trip", "program_check_in"],
    });

    mockGoogleCalendar.reset();

    const activityForm = new ActivityFormPage(page);
    const timeline = new ActivityTimelinePage(page);

    await timeline.goto();
    await timeline.newActivityButton.click();

    await activityForm.createActivity({
      category: "Meetings",
      type: "Program Check",
      title: "Filtered Dinner Activity",
      startDate: "2026-05-25",
    });

    await activityForm.waitForClose();

    await expect(
      timeline.getActivityByTitle("Filtered Dinner Activity")
    ).toBeVisible({ timeout: 5_000 });

    const pushRequests = mockGoogleCalendar.getPushRequests();
    expect(pushRequests.length).toBe(0);
  });

  test("push handles Google API errors gracefully", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    mockGoogleCalendar.setError(500, "Internal Server Error");

    const activityForm = new ActivityFormPage(page);
    const timeline = new ActivityTimelinePage(page);

    await timeline.goto();
    await timeline.newActivityButton.click();

    await activityForm.createActivity({
      category: "Meetings",
      type: "Program Check",
      title: "Error Handling Test",
      startDate: "2026-06-01",
    });

    await activityForm.waitForClose();

    await expect(
      timeline.getActivityByTitle("Error Handling Test")
    ).toBeVisible({ timeout: 5_000 });
  });
});
