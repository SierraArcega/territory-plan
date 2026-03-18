import type { RawVacancy } from "./types";

/**
 * SchoolSpring parser using Playwright.
 *
 * SchoolSpring is a Vue SPA that renders job listings as cards:
 *   <div class="card">
 *     <div class="card-body">
 *       <div class="card-title h5">Job Title</div>
 *       <p class="card-text">District Name</p>
 *       <p class="card-text">City, State</p>
 *       <p class="card-text">Date Posted</p>
 *     </div>
 *   </div>
 *
 * Pagination is via a "More Jobs" button that loads additional cards.
 * Detail pages exist but require dismissing an overlay dialog to access.
 */
export async function parseSchoolSpring(url: string): Promise<RawVacancy[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      userAgent: "TerritoryPlanBuilder/1.0 (vacancy-scanner)",
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(3000);

    // Dismiss any overlay dialogs
    try {
      const overlay = page.locator(".pds-overlay").first();
      if (await overlay.isVisible({ timeout: 1000 })) {
        await page.evaluate(() => {
          document.querySelectorAll(".pds-overlay, pds-dialog").forEach(el => {
            (el as HTMLElement).style.display = "none";
          });
        });
      }
    } catch {
      // No overlay
    }

    // Click "More Jobs" until all listings are loaded
    let clicks = 0;
    while (clicks < 15) {
      try {
        const moreBtn = page.locator('button:has-text("More Jobs")').first();
        if (await moreBtn.isVisible({ timeout: 2000 })) {
          const countBefore = await page.locator(".card-div").count();
          await moreBtn.click({ force: true });
          await page.waitForTimeout(2000);
          const countAfter = await page.locator(".card-div").count();
          clicks++;
          console.log(`[schoolspring] Clicked More Jobs (${clicks}), cards: ${countBefore} → ${countAfter}`);
          if (countAfter <= countBefore) break; // No new cards loaded
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    // Extract job listings from card elements
    const vacancies = await page.evaluate(() => {
      const cards = document.querySelectorAll("#joblist-div .card, .card-div .card");
      const results: Array<{
        title: string;
        texts: string[];
      }> = [];

      cards.forEach(card => {
        const titleEl = card.querySelector(".card-title");
        if (!titleEl) return;

        const title = titleEl.textContent?.trim();
        if (!title || title.length < 5) return;

        // Get all card-text paragraphs
        const textEls = card.querySelectorAll(".card-text");
        const texts = Array.from(textEls).map(el => el.textContent?.trim() ?? "");

        results.push({ title, texts });
      });

      return results;
    });

    console.log(`[schoolspring] Extracted ${vacancies.length} cards from page`);

    // Convert to RawVacancy format
    return vacancies.map(card => {
      const vacancy: RawVacancy = {
        title: card.title,
        sourceUrl: url,
      };

      // Parse card-text fields: typically [district, location, date]
      for (const text of card.texts) {
        if (!text) continue;

        // Date patterns
        if (/^(today|yesterday|\d+ days? ago|\d+ weeks? ago|\d+ months? ago)$/i.test(text)) {
          vacancy.datePosted = text;
          continue;
        }
        if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(text)) {
          vacancy.datePosted = text;
          continue;
        }
        if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(text)) {
          vacancy.datePosted = text;
          continue;
        }

        // Location: "City, State" pattern
        if (/^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z][a-z]+/.test(text)) {
          // This is the city/state line, not the school name
          continue;
        }

        // District name (usually first card-text) — skip, we already have the district
      }

      return vacancy;
    });
  } finally {
    await browser.close();
  }
}
