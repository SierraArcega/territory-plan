/**
 * Page Object Model: Tasks List
 *
 * Tasks are accessible via the left sidebar "Tasks" link.
 * The page shows task rows with checkbox, title, priority, due date.
 * "New Task" or "Create Task" button opens the task form.
 */

import { type Page, type Locator } from "@playwright/test";

export class TaskBoardPage {
  readonly page: Page;

  // Navigation
  readonly tasksNavLink: Locator;
  readonly newTaskButton: Locator;

  // Task form
  readonly taskFormTitle: Locator;
  readonly taskFormSubmit: Locator;

  // Content
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;

    // Left sidebar "Tasks" link
    this.tasksNavLink = page.locator('a:has-text("Tasks"), button:has-text("Tasks")').first();

    // "New Task" or "Create Task" button
    this.newTaskButton = page.locator(
      'button:has-text("New Task"), button:has-text("Create Task"), a:has-text("Create Task")'
    ).first();

    // Task form fields
    this.taskFormTitle = page.locator(
      'input[placeholder*="What needs"], input[placeholder*="task"], input[placeholder*="Task"]'
    ).first();
    this.taskFormSubmit = page.locator('button:has-text("Create Task"), button:has-text("Save")').first();

    // Empty state
    this.emptyState = page.locator('text="No tasks yet"');
  }

  /** Navigate to tasks via sidebar */
  async goto() {
    await this.page.goto("/");
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(2_000);

    // Click "Tasks" in the left sidebar
    await this.tasksNavLink.click();
    await this.page.waitForTimeout(1_000);
  }

  /** Get a specific task by title */
  getTaskByTitle(title: string): Locator {
    return this.page.locator(`text="${title}"`).first();
  }

  /** Check if a task exists */
  async hasTask(title: string): Promise<boolean> {
    return this.getTaskByTitle(title).isVisible();
  }

  /** Click on a task to open detail */
  async clickTask(title: string) {
    await this.getTaskByTitle(title).click();
  }

  /** Open the new task form */
  async openNewTaskForm() {
    await this.newTaskButton.click();
  }

  /** Fill the task form title */
  async setTaskTitle(title: string) {
    await this.taskFormTitle.waitFor({ state: "visible", timeout: 5_000 });
    await this.taskFormTitle.fill(title);
  }

  /** Link a task to an activity */
  async linkToActivity(activityTitle: string) {
    const activitiesSection = this.page.locator('button:has-text("Activities")');
    if (await activitiesSection.isVisible()) {
      await activitiesSection.click();
      await this.page.locator(`label:has-text("${activityTitle}")`).click();
    }
  }

  /** Submit the task form */
  async submitTaskForm() {
    await this.taskFormSubmit.click();
  }

  /** Filter by status */
  async filterByStatus(status: string) {
    await this.page
      .locator(`button:has-text("${status}")`)
      .first()
      .click();
  }

  /** Get column cards (compatibility shim) */
  getColumnCards(statusLabel: string): Locator {
    return this.page.locator(`text="${statusLabel}"`);
  }

  /** Wait for the list to load */
  async waitForBoard() {
    await this.page.waitForTimeout(1_000);
  }
}
