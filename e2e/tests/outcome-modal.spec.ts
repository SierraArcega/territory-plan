/**
 * Outcome Modal Enhancement — E2E Tests
 *
 * Tests the enhanced "What happened?" outcome modal with star rating,
 * outcome pills, notes, opportunity linking, and multi-task creation.
 *
 * The outcome modal is triggered two ways:
 *   1. Changing an activity's status to "completed" in the ActivitiesTable
 *   2. Clicking "Add next steps" on a completed activity in the Feed tab
 *
 * These tests use approach #2 (Feed tab) because it requires less navigation
 * and more reliably surfaces the modal.
 *
 * 5 test cases covering: save gating, outcome + note, opp linking, multi-task, skip.
 */

import { test, expect } from "../fixtures";
import { OutcomeModalPage } from "../pages/OutcomeModalPage";

/**
 * Helper: seed a completed activity and open the outcome modal via the Feed tab.
 * Returns the OutcomeModalPage page object.
 */
async function openOutcomeModal(
  page: import("@playwright/test").Page,
  db: Parameters<Parameters<typeof test>[1]>[0]["db"]
): Promise<OutcomeModalPage> {
  // Seed a completed activity (no outcomeType so "Add next steps" shows)
  await db.seedUserProfile();
  await db.seedPlan();
  await db.seedUserIntegration();
  await db.seedActivity({
    title: "E2E Completed Activity",
    status: "completed",
  });

  // Navigate to the home page (Feed tab)
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  // Wait for the feed to load, then click "Add next steps" on the completed activity
  const nextStepsButton = page
    .locator('button:has-text("Add next steps")')
    .first();
  await nextStepsButton.waitFor({ state: "visible", timeout: 10_000 });
  await nextStepsButton.click();

  const outcomeModal = new OutcomeModalPage(page);
  await outcomeModal.waitForVisible();
  return outcomeModal;
}

test.describe("Outcome Modal Enhancement", () => {
  test("save is disabled until star rating is set", async ({ page, db }) => {
    const outcomeModal = await openOutcomeModal(page, db);

    // Save should be disabled initially (no rating)
    expect(await outcomeModal.isSaveDisabled()).toBe(true);

    // Set rating to 4 stars
    await outcomeModal.setRating(4);

    // Now save should be enabled
    expect(await outcomeModal.isSaveDisabled()).toBe(false);
  });

  test("can select outcome pill and add note", async ({ page, db }) => {
    const outcomeModal = await openOutcomeModal(page, db);

    // Set required star rating
    await outcomeModal.setRating(3);

    // Select an outcome pill — use a generic label that appears for the activity category
    // OutcomeModal shows pills based on the activity's category (program_check_in = "engagement")
    // Try to click the first outcome pill button in the "How did it go?" section
    const outcomePills = page
      .locator(".flex.flex-wrap.gap-2")
      .first()
      .locator("button");
    const firstPillText = await outcomePills.first().textContent();
    if (firstPillText) {
      await outcomePills.first().click();
    }

    // Add a note
    await outcomeModal.addNote("Great meeting with district leaders");

    // Verify textarea has the note text
    await expect(page.locator("textarea")).toHaveValue(
      "Great meeting with district leaders"
    );

    // Save
    await outcomeModal.save();

    // Verify modal closes
    await expect(outcomeModal.modal).toBeHidden({ timeout: 5_000 });
  });

  test("can search and link an opportunity", async ({ page, db }) => {
    // Seed opportunity before opening the modal
    await db.seedOpportunity();
    const outcomeModal = await openOutcomeModal(page, db);

    // Set required star rating
    await outcomeModal.setRating(5);

    // Search for the test opportunity
    await outcomeModal.searchOpportunity("E2E Test");

    // Wait for search results dropdown
    await expect(
      page.getByText("E2E Test Opportunity").first()
    ).toBeVisible({ timeout: 5_000 });

    // Select the opportunity
    await outcomeModal.selectOpportunity("E2E Test Opportunity");

    // Preview card should show with the opportunity name
    await expect(outcomeModal.getOppPreview()).toBeVisible({ timeout: 3_000 });
    await expect(
      outcomeModal.getOppPreview().getByText("E2E Test Opportunity")
    ).toBeVisible();

    // Save and verify modal closes
    await outcomeModal.save();
    await expect(outcomeModal.modal).toBeHidden({ timeout: 5_000 });
  });

  test("can create multiple tasks with different priorities", async ({
    page,
    db,
  }) => {
    const outcomeModal = await openOutcomeModal(page, db);

    // Set required star rating
    await outcomeModal.setRating(4);

    // First task row should already exist (pre-populated with follow-up title)
    const taskRows = outcomeModal.getTaskRows();
    await expect(taskRows.first()).toBeVisible({ timeout: 3_000 });
    const initialCount = await taskRows.count();
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Add a second task
    await outcomeModal.clickAddAnotherTask();
    await expect(taskRows).toHaveCount(initialCount + 1);

    // Fill in the new task with a title and priority
    await outcomeModal.addTask({
      title: "Send proposal to district",
      priority: "Med",
    });

    // Verify the task title was filled in
    const lastTaskInput = taskRows.last().locator('input[type="text"]');
    await expect(lastTaskInput).toHaveValue("Send proposal to district");

    // Save and verify modal closes
    await outcomeModal.save();
    await expect(outcomeModal.modal).toBeHidden({ timeout: 5_000 });
  });

  test("skip closes modal without saving", async ({ page, db }) => {
    const outcomeModal = await openOutcomeModal(page, db);

    // Skip without setting any fields
    await outcomeModal.skip();

    // Modal should close
    await expect(outcomeModal.modal).toBeHidden({ timeout: 5_000 });
  });
});
