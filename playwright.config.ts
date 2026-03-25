import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for Territory Plan Builder.
 *
 * Usage:
 *   npm run test:e2e          — headless Chromium
 *   npm run test:e2e:headed   — headed Chromium (visible browser)
 *   npm run test:e2e:ui       — interactive Playwright UI
 */
export default defineConfig({
  testDir: "./e2e/tests",
  outputDir: "e2e/test-results",

  /* Global setup: authenticates a test user and saves cookies */
  globalSetup: "./e2e/global-setup.ts",

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Limit parallel workers on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter */
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],

  /* Shared settings for all projects */
  use: {
    baseURL: "http://localhost:3005",
    storageState: "e2e/.auth/user.json",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Start the dev server before running tests */
  webServer: {
    command: "npm run dev",
    port: 3005,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
