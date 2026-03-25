/**
 * Page Object Model: Calendar Sync Settings
 *
 * Encapsulates the calendar settings section, which lives within the
 * profile/settings page. Provides methods for connection status,
 * sync direction, activity type filters, and reminders.
 *
 * Component references:
 *   - CalendarSyncSettings.tsx — main container
 *   - ConnectionStatusCard.tsx — shows email, sync now, disconnect
 *   - SyncDirectionCard.tsx — one_way / two_way radio
 *   - ActivityTypeFiltersCard.tsx — multi-select activity types
 *   - RemindersCard.tsx — reminder minutes config
 */

import { type Page, type Locator } from "@playwright/test";

export class CalendarSettingsPage {
  readonly page: Page;

  // Connection status
  readonly connectBanner: Locator;
  readonly connectButton: Locator;
  readonly connectedEmail: Locator;
  readonly syncNowButton: Locator;
  readonly disconnectButton: Locator;
  readonly connectionCard: Locator;
  readonly lockedOverlay: Locator;

  // Sync direction
  readonly syncDirectionCard: Locator;
  readonly oneWayRadio: Locator;
  readonly twoWayRadio: Locator;

  constructor(page: Page) {
    this.page = page;

    // Connection status (ConnectionStatusCard or connect banner)
    this.connectBanner = page.locator(
      'text="Connect your Google Calendar"'
    );
    this.connectButton = page.locator('button:has-text("Connect")');
    this.connectionCard = page.locator('h3:has-text("Connection")').locator("..");
    this.connectedEmail = this.connectionCard.locator(
      "p.truncate"
    );
    this.syncNowButton = page.locator('button:has-text("Sync Now")');
    this.disconnectButton = page.locator('button:has-text("Disconnect")');
    this.lockedOverlay = page.locator(
      'text="Connect your calendar to configure sync"'
    );

    // Sync direction (SyncDirectionCard)
    this.syncDirectionCard = page.locator('h3:has-text("Sync Direction")').locator("..");
    this.oneWayRadio = page.locator('input[name="sync-direction"][value="one_way"]');
    this.twoWayRadio = page.locator('input[name="sync-direction"][value="two_way"]');
  }

  /** Navigate to the settings page with calendar settings visible */
  async goto() {
    await this.page.goto("/settings");
    await this.page.waitForLoadState("domcontentloaded");
  }

  /** Check if the calendar is currently connected */
  async isConnected(): Promise<boolean> {
    // If the connection card with email is visible, we're connected
    const connectionHeader = this.page.locator('h3:has-text("Connection")');
    return connectionHeader.isVisible();
  }

  /** Check if the connect banner is showing (not connected) */
  async showsConnectBanner(): Promise<boolean> {
    return this.connectBanner.isVisible();
  }

  /** Check if settings are locked (shows overlay when disconnected) */
  async isLocked(): Promise<boolean> {
    return this.lockedOverlay.isVisible();
  }

  /** Get the connected Google account email */
  async getConnectionEmail(): Promise<string> {
    return this.connectedEmail.innerText();
  }

  /** Click Sync Now */
  async triggerSync() {
    await this.syncNowButton.click();
  }

  /** Set sync direction to one_way or two_way */
  async setSyncDirection(direction: "one_way" | "two_way") {
    const label =
      direction === "one_way"
        ? this.page.locator('text="One-way (App → Calendar)"')
        : this.page.locator('text="Two-way sync"');
    await label.click();
  }

  /** Get current sync direction */
  async getSyncDirection(): Promise<"one_way" | "two_way"> {
    const isOneWay = await this.oneWayRadio.isChecked();
    return isOneWay ? "one_way" : "two_way";
  }

  /** Wait for the "Saved" confirmation text to appear */
  async waitForSaved() {
    await this.page.locator('text="Saved"').waitFor({ state: "visible" });
  }
}
