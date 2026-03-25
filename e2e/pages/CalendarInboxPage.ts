/**
 * Page Object Model: Calendar Inbox
 *
 * Encapsulates the calendar inbox section that shows pending calendar events
 * with smart suggestions. Located within the activities view.
 *
 * Component references:
 *   - CalendarInbox.tsx — main container, connect banner, empty state
 *   - CalendarEventCard.tsx — individual event cards with confirm/dismiss
 *   - CalendarConnectBanner.tsx — shown when not connected
 */

import { type Page, type Locator } from "@playwright/test";

export class CalendarInboxPage {
  readonly page: Page;

  // Connect banner
  readonly connectBanner: Locator;
  readonly connectBannerButton: Locator;
  readonly connectedSuccessBanner: Locator;

  // Inbox header
  readonly inboxHeader: Locator;
  readonly pendingCountBadge: Locator;

  // Batch actions
  readonly batchConfirmBar: Locator;
  readonly batchConfirmButton: Locator;

  // Empty state
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;

    // CalendarConnectBanner
    this.connectBanner = page.locator('text="Sync your Google Calendar"');
    this.connectBannerButton = page.locator(
      '.rounded-xl >> button:has-text("Connect")'
    );

    // Success banner after connecting
    this.connectedSuccessBanner = page.locator(
      'text="Calendar connected! Review your synced meetings below."'
    );

    // Inbox header
    this.inboxHeader = page.locator('text="Calendar Inbox"');
    this.pendingCountBadge = page.locator(
      ".bg-\\[\\#F37167\\].rounded-full"
    );

    // Batch confirm bar
    this.batchConfirmBar = page.locator('text="strong matches"');
    this.batchConfirmButton = page.locator(
      'button:has-text("Confirm All")'
    );

    // Empty state
    this.emptyState = page.locator(
      'text="All caught up — no new meetings to review"'
    );
  }

  /** Navigate to activities page where the calendar inbox lives */
  async goto() {
    await this.page.goto("/");
    await this.page.waitForLoadState("domcontentloaded");
  }

  /** Get all visible event cards */
  getEventCards(): Locator {
    // CalendarEventCard wraps content in a div with border-l-4
    return this.page.locator(".border-l-4");
  }

  /** Get a specific event card by its title text */
  getEventByTitle(title: string): Locator {
    return this.page.locator(`.border-l-4:has-text("${title}")`);
  }

  /** Get the confidence label text for an event */
  async getConfidenceLabel(eventTitle: string): Promise<string | null> {
    const card = this.getEventByTitle(eventTitle);
    // Confidence labels: "Strong match", "Possible match", "No match found"
    const suggestion = card.locator(".bg-\\[\\#C4E7E6\\]\\/30");
    if (!(await suggestion.isVisible())) return null;
    const text = await suggestion.locator("span").last().innerText();
    return text.trim();
  }

  /** Get the suggested district name for an event */
  async getSuggestedDistrict(eventTitle: string): Promise<string | null> {
    const card = this.getEventByTitle(eventTitle);
    const suggestion = card.locator(".bg-\\[\\#C4E7E6\\]\\/30");
    if (!(await suggestion.isVisible())) return null;
    return suggestion.innerText();
  }

  /** Click the Confirm button on a specific event card */
  async confirmEvent(eventTitle: string) {
    const card = this.getEventByTitle(eventTitle);
    await card.locator('button:has-text("Confirm")').first().click();
  }

  /** Click Edit & Confirm on a specific event card */
  async editAndConfirmEvent(eventTitle: string) {
    const card = this.getEventByTitle(eventTitle);
    await card.locator('button:has-text("Edit & Confirm")').click();
  }

  /** Dismiss a specific event */
  async dismissEvent(eventTitle: string) {
    const card = this.getEventByTitle(eventTitle);
    await card.locator('button:has-text("Dismiss")').click();
  }

  /** Click the batch confirm button */
  async batchConfirmHighConfidence() {
    await this.batchConfirmButton.click();
  }

  /** Check if the inbox is empty (all caught up) */
  async isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  /** Check if the connect banner is showing */
  async showsConnectBanner(): Promise<boolean> {
    return this.connectBanner.isVisible();
  }

  /** Get the pending count from the badge */
  async getPendingCount(): Promise<number> {
    if (!(await this.pendingCountBadge.isVisible())) return 0;
    const text = await this.pendingCountBadge.innerText();
    return parseInt(text, 10) || 0;
  }

  /** Check for an error banner */
  getErrorBanner(): Locator {
    return this.page.locator('text="reconnect"');
  }

  /** Wait for events to load (inbox loading spinner disappears) */
  async waitForEvents() {
    // Wait for the loading spinner to disappear
    await this.page
      .locator(".animate-spin")
      .first()
      .waitFor({ state: "hidden", timeout: 10_000 })
      .catch(() => {
        // Spinner may not appear if data loads fast
      });
  }
}
