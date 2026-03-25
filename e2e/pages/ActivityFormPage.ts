/**
 * Page Object Model: Activity Form Modal
 *
 * Encapsulates the multi-step activity creation/edit modal.
 * Steps: pick-category -> pick-type -> form
 *
 * Component references:
 *   - ActivityFormModal.tsx — modal with 3-step wizard
 *   - EventTypeFields.tsx — type-specific fields
 *   - CalendarPicker.tsx — date picker
 *   - StatusSelect.tsx — status dropdown
 */

import { type Page, type Locator } from "@playwright/test";

export class ActivityFormPage {
  readonly page: Page;

  // Modal container
  readonly modal: Locator;
  readonly backdrop: Locator;

  // Header
  readonly headerTitle: Locator;
  readonly closeButton: Locator;
  readonly backButton: Locator;

  // Category picker (step 1)
  readonly categoryPicker: Locator;

  // Form fields (step 3)
  readonly titleInput: Locator;
  readonly startDateInput: Locator;
  readonly notesTextarea: Locator;

  // Footer actions
  readonly cancelButton: Locator;
  readonly submitButton: Locator;

  // Error display
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // The modal is the white rounded container inside the fixed backdrop
    this.backdrop = page.locator(".fixed.inset-0.bg-black\\/40");
    this.modal = page.locator(".bg-white.rounded-2xl.shadow-xl");

    // Header
    this.headerTitle = page.locator("h2");
    this.closeButton = this.modal.locator("button").filter({
      has: page.locator('svg path[d="M6 18L18 6M6 6l12 12"]'),
    });
    this.backButton = this.modal.locator("button").filter({
      has: page.locator('svg path[d*="M15 19l-7-7 7-7"]'),
    });

    // Category picker
    this.categoryPicker = page.locator(
      'text="What kind of activity are you creating?"'
    );

    // Form fields
    this.titleInput = page.locator(
      'input[placeholder*="e.g., SC Education Conference"]'
    );
    this.startDateInput = page.locator('input[type="date"]').first();
    this.notesTextarea = page.locator(
      'textarea[placeholder="Add any notes or details..."]'
    );

    // Footer
    this.cancelButton = page.locator('button:has-text("Cancel")');
    this.submitButton = page.locator('button:has-text("Create Activity")');

    // Error
    this.errorMessage = page.locator(".bg-\\[\\#fef1f0\\]");
  }

  /** Check if the modal is open */
  async isOpen(): Promise<boolean> {
    return this.modal.isVisible();
  }

  /** Select an activity category (step 1) */
  async selectCategory(categoryLabel: string) {
    await this.page
      .locator(`button:has-text("${categoryLabel}")`)
      .first()
      .click();
  }

  /** Select an activity type (step 2) */
  async selectType(typeLabel: string) {
    await this.page
      .locator(`button:has-text("${typeLabel}")`)
      .first()
      .click();
  }

  /** Fill the title field */
  async setTitle(title: string) {
    await this.titleInput.fill(title);
  }

  /** Set the start date */
  async setStartDate(dateStr: string) {
    await this.startDateInput.fill(dateStr);
  }

  /** Set notes */
  async setNotes(notes: string) {
    await this.notesTextarea.fill(notes);
  }

  /** Select a plan from the Plans multi-select */
  async linkPlan(planName: string) {
    // Click the Plans multi-select trigger
    const plansSelect = this.page.locator("#activity-plans");
    await plansSelect.click();
    // Search and select
    await this.page
      .locator(`text="${planName}"`)
      .first()
      .click();
  }

  /** Click Save / Create Activity */
  async save() {
    await this.submitButton.click();
  }

  /** Click Cancel */
  async cancel() {
    await this.cancelButton.click();
  }

  /** Close the modal via the X button */
  async close() {
    await this.closeButton.click();
  }

  /** Wait for the modal to close */
  async waitForClose() {
    await this.modal.waitFor({ state: "hidden", timeout: 5_000 });
  }

  /** Wait for the form step to be visible */
  async waitForForm() {
    await this.titleInput.waitFor({ state: "visible", timeout: 5_000 });
  }

  /** Check if the creating spinner is showing */
  async isSubmitting(): Promise<boolean> {
    const creatingText = this.page.locator('button:has-text("Creating...")');
    return creatingText.isVisible();
  }

  /** Full flow: create an activity from scratch */
  async createActivity(options: {
    category: string;
    type: string;
    title: string;
    startDate?: string;
    notes?: string;
  }) {
    await this.selectCategory(options.category);
    await this.selectType(options.type);
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
