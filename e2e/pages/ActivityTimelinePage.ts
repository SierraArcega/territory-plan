/**
 * Page Object Model: Activities List
 *
 * Activities are accessible via the left sidebar "Activities" link.
 * The page shows activity rows with type emoji, title, status, dates.
 * "New Activity" button opens the activity form.
 */

import { type Page, type Locator } from "@playwright/test";

export class ActivityTimelinePage {
  readonly page: Page;

  // Navigation
  readonly activitiesNavLink: Locator;
  readonly newActivityButton: Locator;

  // Content
  readonly emptyState: Locator;
  readonly loadingSkeleton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Left sidebar "Activities" link
    this.activitiesNavLink = page.locator('a:has-text("Activities"), button:has-text("Activities")').first();

    // "New Activity" or "Log Activity" button
    this.newActivityButton = page.locator(
      'button:has-text("New Activity"), button:has-text("Log Activity"), a:has-text("Log Activity")'
    ).first();

    // Empty state
    this.emptyState = page.locator('text="No activities yet"');

    // Loading skeleton
    this.loadingSkeleton = page.locator(".animate-pulse").first();
  }

  /** Navigate to activities via sidebar */
  async goto() {
    await this.page.goto("/");
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(2_000);

    // Click "Activities" in the left sidebar
    await this.activitiesNavLink.click();
    await this.page.waitForTimeout(1_000);
  }

  /** Get a specific activity by title */
  getActivityByTitle(title: string): Locator {
    return this.page.locator(`text="${title}"`).first();
  }

  /** Check if an activity with the given title exists */
  async hasActivity(title: string): Promise<boolean> {
    return this.getActivityByTitle(title).isVisible();
  }

  /** Get the source badge for an activity */
  async getActivitySource(_title: string): Promise<string | null> {
    return null;
  }

  /** Filter by status */
  async filterByStatus(status: string) {
    await this.page
      .locator(`button:has-text("${status}")`)
      .first()
      .click();
  }

  /** Check if the list is empty */
  async isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  /** Wait for data to load */
  async waitForLoaded() {
    await this.loadingSkeleton
      .waitFor({ state: "hidden", timeout: 10_000 })
      .catch(() => {});
  }
}
