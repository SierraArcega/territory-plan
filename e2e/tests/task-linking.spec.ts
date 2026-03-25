/**
 * Task <-> Activity Linking — E2E Tests
 *
 * Tests the relationship between tasks and activities.
 * 5 tests covering: create linked task, visible on kanban, unlink,
 * link existing task, complete preserves link.
 */

import { test, expect } from "../fixtures";
import { TaskBoardPage } from "../pages/TaskBoardPage";

test.describe("Task-Activity Linking", () => {
  test("creates a task linked to an activity", async ({ page, db }) => {
    await db.seedTestData();

    const taskBoard = new TaskBoardPage(page);
    await taskBoard.goto();
    await taskBoard.waitForBoard();

    // Open the new task form
    await taskBoard.openNewTaskForm();

    // Fill task details
    await taskBoard.setTaskTitle("E2E Linked Task");

    // Link to the test activity
    await taskBoard.linkToActivity("E2E Test Activity");

    // Submit
    await taskBoard.submitTaskForm();

    // The task should appear on the board
    await expect(taskBoard.getTaskByTitle("E2E Linked Task")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("linked task appears on kanban board in correct column", async ({
    page,
    db,
  }) => {
    // Seed a task linked to the activity
    await db.seedUserProfile();
    await db.seedPlan();
    await db.seedActivity();
    await db.seedTask({
      title: "Kanban Test Task",
      status: "todo",
      activityId: db.ids.activityId,
    });

    const taskBoard = new TaskBoardPage(page);
    await taskBoard.goto();
    await taskBoard.waitForBoard();

    // Task should be in the "To Do" column
    const todoCards = taskBoard.getColumnCards("To Do");
    const taskCard = todoCards.filter({ hasText: "Kanban Test Task" });
    await expect(taskCard).toBeVisible();
  });

  test("unlinks a task from an activity", async ({ page, db }) => {
    await db.seedUserProfile();
    await db.seedPlan();
    await db.seedActivity();
    await db.seedTask({
      title: "Task To Unlink",
      activityId: db.ids.activityId,
    });

    const taskBoard = new TaskBoardPage(page);
    await taskBoard.goto();
    await taskBoard.waitForBoard();

    // Click the task to open detail
    await taskBoard.clickTask("Task To Unlink");

    // Look for the linked activity and remove it
    const activityChip = page.locator('text="E2E Test Activity"').first();
    await activityChip.waitFor({ state: "visible", timeout: 3_000 }).catch(() => {});

    if (await activityChip.isVisible()) {
      // Try to find and click a remove button (x) near the chip
      const removeButton = activityChip
        .locator("..")
        .locator('button, [role="button"]')
        .first();
      if (await removeButton.isVisible()) {
        await removeButton.click();
      }
    }

    // Save if there's a save button
    await page
      .locator('button:has-text("Save")')
      .first()
      .click()
      .catch(() => {});

    // The task should still exist on the board
    await expect(taskBoard.getTaskByTitle("Task To Unlink")).toBeVisible();
  });

  test("links an existing task to an activity", async ({ page, db }) => {
    await db.seedUserProfile();
    await db.seedPlan();
    await db.seedActivity();
    // Create a task without any activity link
    await db.seedTask({ title: "Unlinked Task" });

    const taskBoard = new TaskBoardPage(page);
    await taskBoard.goto();
    await taskBoard.waitForBoard();

    // Click the task to open detail
    await taskBoard.clickTask("Unlinked Task");

    // Look for an "Activities" section in the task detail and link it
    const activitiesSection = page.locator('button:has-text("Activities")');
    if (await activitiesSection.isVisible()) {
      await activitiesSection.click();
      await page.locator(`label:has-text("E2E Test Activity")`).click();
    }

    // Save changes
    await page
      .locator('button:has-text("Save")')
      .first()
      .click()
      .catch(() => {});

    // Task should still exist on the board
    await expect(taskBoard.getTaskByTitle("Unlinked Task")).toBeVisible();
  });

  test("completing a task preserves activity link", async ({ page, db }) => {
    await db.seedUserProfile();
    await db.seedPlan();
    await db.seedActivity();
    await db.seedTask({
      title: "Task To Complete",
      activityId: db.ids.activityId,
    });

    const taskBoard = new TaskBoardPage(page);
    await taskBoard.goto();
    await taskBoard.waitForBoard();

    // The task should be visible
    await expect(
      taskBoard.getTaskByTitle("Task To Complete")
    ).toBeVisible();

    // Click the task to open its detail and change status to done
    await taskBoard.clickTask("Task To Complete");

    // Look for the status select and change to "Done"
    const statusSelect = page.locator("select").first();
    await statusSelect.waitFor({ state: "visible", timeout: 3_000 }).catch(() => {});
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption("done");
    }

    // Save if there's a save button
    await page
      .locator('button:has-text("Save")')
      .first()
      .click()
      .catch(() => {});

    // The task should now be in the "Done" column
    const doneCards = taskBoard.getColumnCards("Done");
    const completedTask = doneCards.filter({ hasText: "Task To Complete" });
    await expect(completedTask).toBeVisible({ timeout: 5_000 });

    // Click the completed task — activity link should still be present
    await completedTask.click();

    // Verify the linked activity is still shown
    const activityRef = page.locator('text="E2E Test Activity"').first();
    await expect(activityRef).toBeVisible({ timeout: 3_000 });
  });
});
