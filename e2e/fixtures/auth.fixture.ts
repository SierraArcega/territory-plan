/**
 * Auth fixture — loads saved storageState for authenticated test sessions.
 *
 * Usage in tests:
 *   import { test, expect } from "../fixtures";
 *   // All tests automatically get an authenticated browser context
 */

import { test as base } from "@playwright/test";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, "..", ".auth", "user.json");

export const test = base.extend({
  // Override the default storageState to use our saved auth file.
  // This is already configured in playwright.config.ts via `use.storageState`,
  // but this fixture provides a convenient place to add per-test auth logic
  // (e.g., different user roles) in the future.
  storageState: [AUTH_FILE, { scope: "test" as const }],
});

export { expect } from "@playwright/test";
