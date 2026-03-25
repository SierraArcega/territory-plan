/**
 * Global setup: authenticates once before all E2E tests.
 *
 * Uses Supabase signInWithPassword on a pre-created test account,
 * then saves the browser cookies/localStorage to e2e/.auth/user.json
 * so every test can reuse the session via storageState.
 *
 * Required env vars:
 *   E2E_USER_EMAIL    — test user email
 *   E2E_USER_PASSWORD — test user password
 */

import { chromium, type FullConfig } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const AUTH_DIR = path.join(__dirname, ".auth");
const AUTH_FILE = path.join(AUTH_DIR, "user.json");

export default async function globalSetup(config: FullConfig) {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    console.warn(
      "\n⚠ E2E_USER_EMAIL and E2E_USER_PASSWORD not set.\n" +
        "  Skipping auth setup — tests requiring auth will fail.\n" +
        "  Create a test user in Supabase and set these env vars.\n"
    );
    // Write an empty storage state so Playwright doesn't error
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    const baseURL =
      config.projects[0]?.use?.baseURL || "http://localhost:3005";
    await page.goto(`${baseURL}/login`);

    // Fill Supabase email/password login form
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for redirect away from login (auth middleware sends to /)
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15_000,
    });

    // Save authenticated state
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    await context.storageState({ path: AUTH_FILE });

    console.log("✓ Auth setup complete — session saved to e2e/.auth/user.json");
  } catch (error) {
    console.error("✗ Auth setup failed:", error);
    // Write empty state so we can still run tests that don't need auth
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
  } finally {
    await browser.close();
  }
}
