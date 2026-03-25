/**
 * Page Object Model: Task Kanban Board
 *
 * Encapsulates the task kanban board with 4 columns (To Do, In Progress,
 * Blocked, Done), quick-add, and task detail modal.
 *
 * Component references:
 *   - KanbanBoard.tsx — 4-column layout with drag-and-drop
 *   - TaskCard.tsx — individual task cards with priority, due date, chips
 *   - QuickAddTask.tsx — inline task creation at bottom of columns
 *   - TaskFormModal.tsx — full task creation form with linking
 *   - TaskDetailModal.tsx — task detail view
 */

import { type Page, type Locator } from "@playwright/test";

export class TaskBoardPage {
  readonly page: Page;

  // Board
  readonly board: Locator;

  // Task form modal
  readonly taskFormModal: Locator;
  readonly taskFormTitle: Locator;
  readonly taskFormSubmit: Locator;
  readonly taskFormCancel: Locator;

  constructor(page: Page) {
    this.page = page;

    // The kanban board is the flex container with columns
    this.board = page.locator(".flex.gap-4.overflow-x-auto");

    // TaskFormModal
    this.taskFormModal = page.locator('h2:has-text("New Task")').locator("..").locator("..");
    this.taskFormTitle = page.locator(
      'input[placeholder="What needs to be done?"]'
    );
    this.taskFormSubmit = page.locator('button:has-text("Create Task")');
    this.taskFormCancel = page.locator(
      'button:has-text("Cancel")'
    );
  }

  /** Navigate to the tasks page */
  async goto() {
    await this.page.goto("/tasks");
    await this.page.waitForLoadState("domcontentloaded");
  }

  /** Get the kanban column by status label */
  getColumn(statusLabel: string): Locator {
    return this.page.locator(
      `.flex-shrink-0.w-72:has-text("${statusLabel}")`
    );
  }

  /** Get all task cards in a specific column */
  getColumnCards(statusLabel: string): Locator {
    const column = this.getColumn(statusLabel);
    return column.locator(
      ".bg-white.rounded-lg.border.border-gray-200.p-3"
    );
  }

  /** Get a specific task card by title */
  getTaskByTitle(title: string): Locator {
    return this.page.locator(
      `.bg-white.rounded-lg.border.border-gray-200.p-3:has-text("${title}")`
    );
  }

  /** Check if a task with the given title exists on the board */
  async hasTask(title: string): Promise<boolean> {
    return this.getTaskByTitle(title).isVisible();
  }

  /** Click on a task card to open its detail */
  async clickTask(title: string) {
    await this.getTaskByTitle(title).click();
  }

  /** Create a task via quick-add in a specific column */
  async quickAddTask(title: string, columnLabel: string = "To Do") {
    const column = this.getColumn(columnLabel);
    // Click "Add a task..." button
    await column.locator('button:has-text("Add a task")').click();
    // Fill the input and press Enter
    const input = column.locator(
      'input[placeholder*="Task title"]'
    );
    await input.fill(title);
    await input.press("Enter");
  }

  /** Open the full task creation form */
  async openNewTaskForm() {
    // Look for a "New Task" button or similar CTA
    await this.page.locator('button:has-text("New Task")').click();
  }

  /** Fill the task form title */
  async setTaskTitle(title: string) {
    await this.taskFormTitle.fill(title);
  }

  /** Link a task to an activity in the task form modal */
  async linkToActivity(activityTitle: string) {
    // Open the Activities section in the link panel
    const activitiesSection = this.page.locator(
      'button:has-text("Activities")'
    );
    await activitiesSection.click();
    // Click the activity checkbox
    await this.page
      .locator(`label:has-text("${activityTitle}")`)
      .click();
  }

  /** Link a task to a plan in the task form modal */
  async linkToPlan(planName: string) {
    const plansSection = this.page.locator('button:has-text("Plans")');
    await plansSection.click();
    await this.page.locator(`label:has-text("${planName}")`).click();
  }

  /** Submit the task form */
  async submitTaskForm() {
    await this.taskFormSubmit.click();
  }

  /** Cancel the task form */
  async cancelTaskForm() {
    await this.taskFormCancel.click();
  }

  /** Get linked activity chips from a task card */
  async getLinkedActivities(taskTitle: string): Promise<string[]> {
    const card = this.getTaskByTitle(taskTitle);
    // Activity chips are rendered with bg-[#F37167] (coral color)
    const chips = card.locator(
      'span[style*="background-color: rgb(243, 113, 103)"]'
    );
    const count = await chips.count();
    const labels: string[] = [];
    for (let i = 0; i < count; i++) {
      labels.push(await chips.nth(i).innerText());
    }
    return labels;
  }

  /** Wait for the board to load */
  async waitForBoard() {
    await this.board.waitFor({ state: "visible", timeout: 10_000 });
  }

  /** Get the count shown in a column header */
  async getColumnCount(statusLabel: string): Promise<number> {
    const column = this.getColumn(statusLabel);
    const countText = await column
      .locator(".text-xs.font-medium.text-gray-400")
      .innerText();
    return parseInt(countText, 10) || 0;
  }
}
