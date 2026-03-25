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

    // Click "New Activity" button
    await page.locator('button:has-text("New Activity")').first().click();

    // Navigate through the wizard
    await activityForm.createActivity({
      category: "Outreach",
      type: "Program Check-In",
      title: "E2E Created Activity",
      startDate: "2026-04-01",
    });

    // Wait for the modal to close
    await activityForm.waitForClose();

    // The activity should appear in the timeline
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
    const activityItem = timeline.getActivityByTitle("E2E Test Activity");
    await activityItem.click();

    // The edit form should open — look for the title input pre-filled
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.waitFor({ state: "visible", timeout: 5_000 });

    // Change the title
    await titleInput.fill("E2E Updated Activity");

    // Save
    await page.locator('button:has-text("Save")').first().click();

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
    const activityItem = timeline.getActivityByTitle("E2E Test Activity");
    await activityItem.click();

    // Look for delete button in the detail view
    await page.locator('button:has-text("Delete")').first().click();

    // Confirm deletion dialog (may use button or native dialog)
    await page
      .locator('button:has-text("Confirm")')
      .first()
      .click()
      .catch(() => {
        // Native dialog handled above
      });

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
    await page.locator('button:has-text("New Activity")').first().click();

    await activityForm.createActivity({
      category: "Outreach",
      type: "Program Check-In",
      title: "Push Test Activity",
      startDate: "2026-04-15",
    });

    await activityForm.waitForClose();

    // Verify activity was created first
    await expect(
      timeline.getActivityByTitle("Push Test Activity")
    ).toBeVisible({ timeout: 5_000 });

    // Check that a push request was made to Google Calendar
    const pushRequests = mockGoogleCalendar.getPushRequests();
    expect(pushRequests.length).toBeGreaterThanOrEqual(1);

    // Verify the push payload contains the title
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
    // Seed an activity that has a googleEventId (simulating an already-pushed activity)
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

    // Click to edit
    await timeline.getActivityByTitle("Existing Pushed Activity").click();

    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.waitFor({ state: "visible", timeout: 5_000 });
    await titleInput.fill("Updated Pushed Activity");
    await page.locator('button:has-text("Save")').first().click();

    // Wait for the update to complete
    await expect(
      timeline.getActivityByTitle("Updated Pushed Activity")
    ).toBeVisible({ timeout: 5_000 });

    // Should have sent a PATCH/PUT to Google Calendar
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

    // Register dialog handler BEFORE the action
    page.on("dialog", (dialog) => dialog.accept());

    // Click and delete
    await timeline.getActivityByTitle("Activity To Delete").click();
    await page.locator('button:has-text("Delete")').first().click();

    // Wait for the activity to disappear
    await expect(
      timeline.getActivityByTitle("Activity To Delete")
    ).toBeHidden({ timeout: 5_000 });

    // Should have sent a DELETE to Google Calendar
    const deleteRequests = mockGoogleCalendar.getDeleteRequests();
    expect(deleteRequests.length).toBeGreaterThanOrEqual(1);
  });

  test("calendar-synced activities skip push (no duplicate)", async ({
    page,
    db,
    mockGoogleCalendar,
  }) => {
    await db.seedTestData();

    // Create a calendar-synced activity (source = calendar_sync)
    await db.seedActivity({
      id: "e2e00000-0000-0000-0000-000000000099",
      title: "Synced From Calendar",
      source: "calendar_sync",
      googleEventId: "gcal-synced-001",
    });

    // Reset mock tracking before the test
    mockGoogleCalendar.reset();

    const timeline = new ActivityTimelinePage(page);
    await timeline.goto();
    await timeline.waitForLoaded();

    // The synced activity should be visible
    await expect(
      timeline.getActivityByTitle("Synced From Calendar")
    ).toBeVisible();

    // Verify no push requests were made (the app should NOT push back to calendar)
    const pushRequests = mockGoogleCalendar.getPushRequests();
    expect(pushRequests.length).toBe(0);
  });
});
