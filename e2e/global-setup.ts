/**
 * Global setup: authenticates once before all E2E tests.
 *
 * Strategy:
 * 1. If a valid storageState file already exists, skip setup (reuse session)
 * 2. Otherwise, open a headed browser for manual Google OAuth login
 * 3. Save the cookies/localStorage to e2e/.auth/user.json for all tests
 *
 * To refresh auth: delete e2e/.auth/user.json and re-run tests.
 */

import { chromium, type FullConfig } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const AUTH_DIR = path.join(__dirname, ".auth");
const AUTH_FILE = path.join(AUTH_DIR, "user.json");

function hasValidStorageState(): boolean {
  try {
    if (!fs.existsSync(AUTH_FILE)) return false;
    const data = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
    // Must have at least one cookie to be considered valid
    return Array.isArray(data.cookies) && data.cookies.length > 0;
  } catch {
    return false;
  }
}

export default async function globalSetup(config: FullConfig) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Reuse existing session if cookies are present
  if (hasValidStorageState()) {
    console.log("✓ Reusing existing auth session from e2e/.auth/user.json");
    return;
  }

  console.log(
    "\n🔐 No valid auth session found. Opening browser for manual login...\n" +
      "   Log in with your Google account, then the browser will close automatically.\n"
  );

  const baseURL =
    config.projects[0]?.use?.baseURL || "http://localhost:3005";

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(baseURL);

    // Wait for the user to complete OAuth and get redirected away from /login
    // Give them up to 2 minutes to complete the flow
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 120_000,
    });

    // Wait a moment for any post-login redirects/state to settle
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2_000);

    // Save the authenticated state (cookies + localStorage)
    await context.storageState({ path: AUTH_FILE });
    console.log(
      "✓ Auth setup complete — session saved to e2e/.auth/user.json"
    );
  } catch (error) {
    console.error(
      "✗ Auth setup failed (did you complete the login?):",
      error
    );
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
  } finally {
    await browser.close();
  }
}
