/**
 * Page Object Model: Calendar Inbox
 *
 * IMPORTANT: Calendar inbox is not yet exposed in the main UI navigation.
 * The CalendarInbox and CalendarEventCard components exist but are not
 * wired into the settings panel or any accessible route.
 *
 * This POM is a placeholder for when the calendar inbox is integrated.
 * For now, calendar sync tests should focus on API-level verification.
 */

import { type Page, type Locator } from "@playwright/test";

export class CalendarInboxPage {
  readonly page: Page;
  readonly connectBanner: Locator;
  readonly inboxHeader: Locator;
  readonly batchConfirmBar: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.connectBanner = page.locator('text="Sync your Google Calendar"');
    this.inboxHeader = page.locator('text="Calendar Inbox"');
    this.batchConfirmBar = page.locator('text="strong matches"');
    this.emptyState = page.locator('text="All caught up"');
  }

  async goto() {
    // Calendar inbox not yet accessible via UI navigation
    await this.page.goto("/");
    await this.page.waitForLoadState("domcontentloaded");
  }

  getEventCards(): Locator {
    return this.page.locator(".border-l-4");
  }

  getEventByTitle(title: string): Locator {
    return this.page.locator(`.border-l-4:has-text("${title}")`);
  }

  async getConfidenceLabel(_eventTitle: string): Promise<string | null> {
    return null; // Not yet accessible
  }

  async confirmEvent(eventTitle: string) {
    const card = this.getEventByTitle(eventTitle);
    await card.locator('button:has-text("Confirm")').first().click();
  }

  async dismissEvent(eventTitle: string) {
    const card = this.getEventByTitle(eventTitle);
    await card.locator('button:has-text("Dismiss")').click();
  }

  async batchConfirmHighConfidence() {
    await this.batchConfirmBar.locator('button:has-text("Confirm All")').click();
  }

  async isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  async waitForEvents() {
    await this.page
      .locator(".animate-spin")
      .first()
      .waitFor({ state: "hidden", timeout: 10_000 })
      .catch(() => {});
  }
}
