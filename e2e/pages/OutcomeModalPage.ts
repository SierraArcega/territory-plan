/**
 * Page Object Model: Outcome Modal
 *
 * Encapsulates the enhanced "What happened?" outcome modal that appears
 * after marking an activity as "completed". Contains star rating, outcome pills,
 * notes, opportunity search, calendar attendees, and follow-up tasks.
 *
 * Component references:
 *   - OutcomeModal.tsx — main modal container
 *   - StarRating.tsx — interactive 1-5 star rating (role="radiogroup")
 *   - OpportunitySearch.tsx — typeahead search with preview card
 *   - CalendarAttendeesSection.tsx — attendee import from Google Calendar
 *   - TaskRowList.tsx — inline multi-task creation
 */

import { type Page, type Locator } from "@playwright/test";

export class OutcomeModalPage {
  readonly page: Page;

  /** The modal card container (the white card in the fixed overlay) */
  readonly modal: Locator;
  /** "Save & Close" button in the footer */
  readonly saveButton: Locator;
  /** "Skip" button in the footer */
  readonly skipButton: Locator;
  /** Star rating radiogroup container */
  readonly starRating: Locator;
  /** Toggle to expand the notes textarea */
  readonly noteToggle: Locator;
  /** Opportunity search text input */
  readonly oppSearchInput: Locator;

  constructor(page: Page) {
    this.page = page;

    // The modal is the white card inside the fixed overlay — identified by its shape classes
    this.modal = page.locator(".rounded-2xl.shadow-xl");
    this.saveButton = page.getByRole("button", { name: /Save & Close/i });
    this.skipButton = page.getByText("Skip");
    this.starRating = page.locator('[role="radiogroup"]');
    this.noteToggle = page.getByText("+ Add notes or details");
    this.oppSearchInput = page.getByPlaceholder(
      /Search by opportunity name or ID/i
    );
  }

  /** Wait for the outcome modal to be visible */
  async waitForVisible() {
    await this.modal.waitFor({ state: "visible", timeout: 5_000 });
  }

  /** Set the star rating (1-5) by clicking the corresponding star button */
  async setRating(stars: number) {
    const label =
      stars === 1 ? "Rate 1 star" : `Rate ${stars} stars`;
    await this.page.getByRole("radio", { name: label }).click();
  }

  /** Click an outcome pill button by its label text */
  async selectOutcome(label: string) {
    // Outcome pills are buttons inside the "How did it go?" section
    // Use getByRole to be specific — pills are buttons with the outcome label
    await this.page.getByRole("button", { name: label, exact: false }).click();
  }

  /** Expand the note textarea and type text into it */
  async addNote(text: string) {
    await this.noteToggle.click();
    const textarea = this.page.locator("textarea");
    await textarea.waitFor({ state: "visible", timeout: 2_000 });
    await textarea.fill(text);
  }

  /** Type a query into the opportunity search input */
  async searchOpportunity(query: string) {
    await this.oppSearchInput.fill(query);
    // Wait for debounce (300ms) + network
    await this.page.waitForTimeout(500);
  }

  /** Select an opportunity from the dropdown results by name */
  async selectOpportunity(name: string) {
    await this.page.getByText(name, { exact: false }).first().click();
  }

  /** Get the opportunity preview card (shown after selecting an opp) */
  getOppPreview(): Locator {
    return this.page.locator(".bg-\\[\\#F7F5FA\\].border.rounded-lg").first();
  }

  /** Remove the linked opportunity by clicking the X button on the preview card */
  async removeOppLink() {
    await this.page
      .getByRole("button", { name: /Remove linked opportunity/i })
      .click();
  }

  /** Get all attendee rows (checkboxes with labels) in the calendar attendees section */
  getAttendeeRows(): Locator {
    return this.page
      .locator('[data-testid="attendee-row"]')
      .or(
        this.page
          .locator("label")
          .filter({ has: this.page.locator('input[type="checkbox"]') })
      );
  }

  /** Get all follow-up task rows */
  getTaskRows(): Locator {
    return this.page.locator(".border.border-\\[\\#E2DEEC\\].rounded-lg.p-3");
  }

  /** Fill in the last (empty) task row with a title and optionally set priority */
  async addTask(opts: { title: string; priority?: string }) {
    const taskRows = this.getTaskRows();
    const lastRow = taskRows.last();
    await lastRow.locator('input[type="text"]').fill(opts.title);
    if (opts.priority) {
      await lastRow.getByRole("button", { name: opts.priority }).click();
    }
  }

  /** Click "+ Add another task" to append a new empty task row */
  async clickAddAnotherTask() {
    await this.page.getByText("+ Add another task").click();
  }

  /** Click "Save & Close" */
  async save() {
    await this.saveButton.click();
  }

  /** Click "Skip" to close the modal without saving */
  async skip() {
    await this.skipButton.click();
  }

  /** Check whether the Save & Close button is currently disabled */
  async isSaveDisabled(): Promise<boolean> {
    return this.saveButton.isDisabled();
  }
}
