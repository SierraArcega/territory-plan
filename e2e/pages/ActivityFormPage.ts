/**
 * Page Object Model: Activity Form Modal
 *
 * The activity form is a modal dialog with:
 * - Title input (placeholder: "e.g. SC Education Conference")
 * - Date picker
 * - Status dropdown (Planned, etc.)
 * - Plans and States multi-selects
 * - Notes textarea
 * - Cancel / Create Activity buttons
 * - Right side tabs: Tasks, Expenses, Related Activities, Files
 */

import { type Page, type Locator } from "@playwright/test";

export class ActivityFormPage {
  readonly page: Page;

  // Modal
  readonly modal: Locator;

  // Form fields
  readonly titleInput: Locator;
  readonly notesTextarea: Locator;

  // Footer actions
  readonly cancelButton: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // The modal dialog
    this.modal = page.locator('[role="dialog"], .fixed.inset-0').first();

    // Form fields — title input has distinctive placeholder
    this.titleInput = page.locator(
      'input[placeholder*="e.g."], input[placeholder*="SC Education"]'
    ).first();

    this.notesTextarea = page.locator(
      'textarea[placeholder*="notes"], textarea[placeholder*="details"]'
    ).first();

    // Footer buttons
    this.cancelButton = page.locator('button:has-text("Cancel")').first();
    this.submitButton = page.locator('button:has-text("Create Activity")').first();
  }

  /** Fill the title field */
  async setTitle(title: string) {
    await this.titleInput.waitFor({ state: "visible", timeout: 5_000 });
    await this.titleInput.fill(title);
  }

  /** Set the start date via the date input */
  async setStartDate(dateStr: string) {
    const dateInput = this.page.locator('input[type="date"]').first();
    if (await dateInput.isVisible()) {
      await dateInput.fill(dateStr);
    }
  }

  /** Set notes */
  async setNotes(notes: string) {
    if (await this.notesTextarea.isVisible()) {
      await this.notesTextarea.fill(notes);
    }
  }

  /** Click Save / Create Activity */
  async save() {
    await this.submitButton.click();
  }

  /** Click Cancel */
  async cancel() {
    await this.cancelButton.click();
  }

  /** Wait for the form to be visible */
  async waitForForm() {
    await this.titleInput.waitFor({ state: "visible", timeout: 5_000 });
  }

  /** Wait for the modal to close */
  async waitForClose() {
    await this.submitButton.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }

  /** Select category card (step 1): Events, Campaigns, Meetings, Gift Drop, Thought Leadership */
  async selectCategory(categoryLabel: string) {
    // Category cards are clickable divs/buttons with the category name as heading text
    // Wait for the category picker to be visible
    await this.page.locator('text=/What kind of activity/').waitFor({ state: "visible", timeout: 5_000 });
    // Click the card that contains this category name
    await this.page
      .locator(`button:has-text("${categoryLabel}"), [role="button"]:has-text("${categoryLabel}"), div[class*="cursor-pointer"]:has-text("${categoryLabel}")`)
      .first()
      .click();
  }

  /** Select activity type card (step 2) */
  async selectType(typeLabel: string) {
    // Wait for type picker to load
    await this.page.locator('text=/What type of/').waitFor({ state: "visible", timeout: 5_000 });
    await this.page
      .locator(`button:has-text("${typeLabel}")`)
      .first()
      .click();
  }

  /** Full flow: pick category → pick type → fill form → submit */
  async createActivity(options: {
    category?: string;
    type?: string;
    title: string;
    startDate?: string;
    notes?: string;
  }) {
    // Step 1: pick category (if provided)
    if (options.category) {
      await this.selectCategory(options.category);
    }
    // Step 2: pick type (if provided)
    if (options.type) {
      await this.selectType(options.type);
    }
    // Step 3: fill form
    await this.waitForForm();
    await this.setTitle(options.title);
    if (options.startDate) {
      await this.setStartDate(options.startDate);
    }
    if (options.notes) {
      await this.setNotes(options.notes);
    }
    await this.save();
  }
}
