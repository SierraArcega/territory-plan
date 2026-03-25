/**
 * Page Object Model: Calendar Settings
 *
 * IMPORTANT: Calendar settings are not yet exposed in the main UI.
 * The "Settings" icon tab falls back to HomePanel.
 * Calendar-related components exist but are not wired into navigation.
 *
 * This POM is a placeholder for when calendar settings are integrated.
 * For now, tests that need calendar settings should use DB seeding
 * to configure the UserIntegration directly.
 */

import { type Page, type Locator } from "@playwright/test";

export class CalendarSettingsPage {
  readonly page: Page;
  readonly settingsTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.settingsTab = page.locator('button[aria-label="Settings"]');
  }

  /** Navigate to the settings icon tab */
  async goto() {
    await this.page.goto("/");
    await this.page.waitForLoadState("domcontentloaded");
    await this.settingsTab.click();
  }

  /** Check if connected (placeholder — checks DB state via UI when available) */
  async isConnected(): Promise<boolean> {
    // Calendar settings not yet in UI — always returns false
    return false;
  }

  /** Check if settings are locked */
  async isLocked(): Promise<boolean> {
    return true; // Not yet available in UI
  }
}
