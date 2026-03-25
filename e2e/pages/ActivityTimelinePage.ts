/**
 * Page Object Model: Activity Timeline
 *
 * Encapsulates the activity timeline view that shows activities grouped by date,
 * with filter chips and source badges.
 *
 * Component references:
 *   - ActivityTimeline.tsx — main container with date groups
 *   - ActivityTimelineItem.tsx — individual activity items with source badge
 *   - ActivityFilterChips.tsx — filter buttons
 */

import { type Page, type Locator } from "@playwright/test";

export class ActivityTimelinePage {
  readonly page: Page;

  // Filter chips
  readonly filterChips: Locator;

  // Timeline content
  readonly timelineContainer: Locator;
  readonly emptyState: Locator;
  readonly loadingSkeleton: Locator;

  constructor(page: Page) {
    this.page = page;

    // ActivityFilterChips — filter buttons at the top
    this.filterChips = page.locator(".space-y-3").first();

    // Timeline
    this.timelineContainer = page.locator(".relative").filter({
      has: page.locator(".w-px.bg-gray-200"),
    });

    // Empty state
    this.emptyState = page.locator('text="No activity yet"');

    // Loading skeleton
    this.loadingSkeleton = page.locator(".animate-pulse").first();
  }

  /** Navigate to the activities page */
  async goto(districtLeaid?: string) {
    const url = districtLeaid
      ? `/?district=${districtLeaid}`
      : "/";
    await this.page.goto(url);
    await this.page.waitForLoadState("domcontentloaded");
  }

  /** Get all visible activity items in the timeline */
  getActivityItems(): Locator {
    // Each ActivityTimelineItem is a flex row with the source circle and card
    return this.page.locator(
      ".border.border-gray-200.rounded-lg.p-3"
    );
  }

  /** Get a specific activity by title text */
  getActivityByTitle(title: string): Locator {
    return this.page.locator(
      `.border.border-gray-200.rounded-lg.p-3:has-text("${title}")`
    );
  }

  /** Check if an activity with the given title exists in the timeline */
  async hasActivity(title: string): Promise<boolean> {
    return this.getActivityByTitle(title).isVisible();
  }

  /** Get the source badge label for an activity (M=manual, C=calendar, G=gmail, S=slack) */
  async getActivitySource(title: string): Promise<string | null> {
    // Find the timeline item row that contains this title
    const row = this.page.locator(`.flex.gap-3:has-text("${title}")`);
    // The source badge is the colored circle with a letter
    const badge = row.locator(".rounded-full.text-white").first();
    if (!(await badge.isVisible())) return null;
    return badge.innerText();
  }

  /** Get the type label (e.g., "Program Check-In") for an activity */
  async getActivityType(title: string): Promise<string | null> {
    const card = this.getActivityByTitle(title);
    const typeLabel = card.locator(".uppercase.tracking-wide").first();
    if (!(await typeLabel.isVisible())) return null;
    return typeLabel.innerText();
  }

  /** Filter by source using the filter chips */
  async filterBySource(source: string) {
    await this.page
      .locator(`button:has-text("${source}")`)
      .first()
      .click();
  }

  /** Check if the timeline is empty */
  async isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  /** Wait for timeline data to load */
  async waitForLoaded() {
    await this.loadingSkeleton
      .waitFor({ state: "hidden", timeout: 10_000 })
      .catch(() => {
        // May not appear if data loads fast
      });
  }
}
