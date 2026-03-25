/**
 * Activity CRUD + Calendar Push — E2E Tests
 *
 * Tests manual activity creation/edit/delete and the push to Google Calendar.
 * 7 tests covering: create, edit, delete, push on create/edit/delete,
 * calendar-synced activities skip push.
 */

import { test, expect } from "../fixtures";
import { ActivityFormPage } from "../pages/ActivityFormPage";
import { ActivityTimelinePage } from "../pages/ActivityTimelinePage";

test.describe("Activity CRUD", () => {
  test("creates a new activity with required fields", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    const activityForm = new ActivityFormPage(page);
    const timeline = new ActivityTimelinePage(page);

    await timeline.goto();

    // Click "+ New Activity" button
    await timeline.newActivityButton.click();

    // Fill the form (modal opens directly — no category/type wizard)
    await activityForm.createActivity({
      category: "Meetings",
      type: "Program Check",
      title: "E2E Created Activity",
      startDate: "2026-04-01",
    });

    await activityForm.waitForClose();

    // The activity should appear in the list
    await expect(
      timeline.getActivityByTitle("E2E Created Activity")
    ).toBeVisible({ timeout: 5_000 });
  });

  test("edits an existing activity", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    const timeline = new ActivityTimelinePage(page);
    await timeline.goto();
    await timeline.waitForLoaded();

    // Click on the existing activity to open edit
    await timeline.getActivityByTitle("E2E Test Activity").click();

    // The edit form should open — look for the title input
    const titleInput = page.locator('input[placeholder*="e.g."]').first();
    await titleInput.waitFor({ state: "visible", timeout: 5_000 });

    // Change the title
    await titleInput.fill("E2E Updated Activity");

    // Save
    await page.locator('button:has-text("Save"), button:has-text("Update")').first().click();

    // Verify the updated title appears
    await expect(
      timeline.getActivityByTitle("E2E Updated Activity")
    ).toBeVisible({ timeout: 5_000 });
  });

  test("deletes an activity", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    const timeline = new ActivityTimelinePage(page);
    await timeline.goto();
    await timeline.waitForLoaded();

    // Register dialog handler BEFORE the action that triggers it
    page.on("dialog", (dialog) => dialog.accept());

    // Click on the activity
    await timeline.getActivityByTitle("E2E Test Activity").click();

    // Look for delete button
    await page.locator('button:has-text("Delete")').first().click();

    // Confirm deletion
    await page
      .locator('button:has-text("Confirm"), button:has-text("Yes")')
      .first()
      .click()
      .catch(() => {});

    // Activity should no longer be visible
    await expect(
      timeline.getActivityByTitle("E2E Test Activity")
    ).toBeHidden({ timeout: 5_000 });
  });

  test("activity with startDate pushes to Google Calendar", async ({
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
      title: "Push Test Activity",
      startDate: "2026-04-15",
    });

    await activityForm.waitForClose();

    await expect(
      timeline.getActivityByTitle("Push Test Activity")
    ).toBeVisible({ timeout: 5_000 });

    // Check that a push request was made to Google Calendar
    const pushRequests = mockGoogleCalendar.getPushRequests();
    expect(pushRequests.length).toBeGreaterThanOrEqual(1);

    const createRequest = pushRequests.find(
      (r) =>
        r.method === "POST" &&
        typeof r.body === "object" &&
        r.body !== null &&
        "summary" in r.body
    );
    expect(createRequest).toBeDefined();
    expect(
      (createRequest!.body as Record<string, unknown>).summary
    ).toBe("Push Test Activity");
  });

  test("editing activity updates Google Calendar event", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedUserProfile();
    await db.seedPlan();
    await db.seedUserIntegration();
    await db.seedActivity({
      googleEventId: "gcal-existing-001",
      title: "Existing Pushed Activity",
    });

    const timeline = new ActivityTimelinePage(page);
    await timeline.goto();
    await timeline.waitForLoaded();

    await timeline.getActivityByTitle("Existing Pushed Activity").click();

    const titleInput = page.locator('input[placeholder*="e.g."]').first();
    await titleInput.waitFor({ state: "visible", timeout: 5_000 });
    await titleInput.fill("Updated Pushed Activity");
    await page.locator('button:has-text("Save"), button:has-text("Update")').first().click();

    await expect(
      timeline.getActivityByTitle("Updated Pushed Activity")
    ).toBeVisible({ timeout: 5_000 });

    const pushRequests = mockGoogleCalendar.getPushRequests();
    const updateRequest = pushRequests.find(
      (r) => r.method === "PUT" || r.method === "PATCH"
    );
    expect(updateRequest).toBeDefined();
  });

  test("deleting activity removes Google Calendar event", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedUserProfile();
    await db.seedPlan();
    await db.seedUserIntegration();
    await db.seedActivity({
      googleEventId: "gcal-to-delete-001",
      title: "Activity To Delete",
    });

    const timeline = new ActivityTimelinePage(page);
    await timeline.goto();
    await timeline.waitForLoaded();

    page.on("dialog", (dialog) => dialog.accept());

    await timeline.getActivityByTitle("Activity To Delete").click();
    await page.locator('button:has-text("Delete")').first().click();

    await expect(
      timeline.getActivityByTitle("Activity To Delete")
    ).toBeHidden({ timeout: 5_000 });

    const deleteRequests = mockGoogleCalendar.getDeleteRequests();
    expect(deleteRequests.length).toBeGreaterThanOrEqual(1);
  });

  test("calendar-synced activities skip push (no duplicate)", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    await db.seedActivity({
      id: "e2e00000-0000-0000-0000-000000000099",
      title: "Synced From Calendar",
      source: "calendar_sync",
      googleEventId: "gcal-synced-001",
    });

    mockGoogleCalendar.reset();

    const timeline = new ActivityTimelinePage(page);
    await timeline.goto();
    await timeline.waitForLoaded();

    await expect(
      timeline.getActivityByTitle("Synced From Calendar")
    ).toBeVisible();

    const pushRequests = mockGoogleCalendar.getPushRequests();
    expect(pushRequests.length).toBe(0);
  });
});
