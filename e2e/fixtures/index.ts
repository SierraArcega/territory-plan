/**
 * Combined test fixtures — merges db and api-mock fixtures into a single
 * `test` export that all spec files import from.
 *
 * Usage:
 *   import { test, expect } from "../fixtures";
 *   test("my test", async ({ page, db, mockGoogleCalendar }) => { ... });
 */

import { mergeTests } from "@playwright/test";
import { test as dbTest } from "./db.fixture";
import { test as apiMockTest } from "./api-mocks.fixture";

export const test = mergeTests(dbTest, apiMockTest);

export { expect } from "@playwright/test";
export type { DbFixture } from "./db.fixture";
export type { GoogleCalendarMock, InterceptedRequest } from "./api-mocks.fixture";
